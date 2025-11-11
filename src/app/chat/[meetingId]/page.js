'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Client as StompClient } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { useAuth } from '@/context/AuthProvider'; // adapt if your auth hook path differs

/**
 * MeetingWebRTC - single-file WebRTC + STOMP chat (DataChannel)
 *
 * Assumptions:
 * - Backend STOMP endpoint available at `${process.env.NEXT_PUBLIC_API_URL}/ws` using SockJS.
 * - Backend REST join endpoint: POST `${process.env.NEXT_PUBLIC_API_URL}/api/rooms/${meetingId}/join`
 *   which returns { isOfferer: boolean, participants, count, ... }
 * - Signaling messages are JSON { type: 'offer'|'answer'|'candidate'|'chat', data: any, sender }
 *
 * Usage: render <MeetingWebRTC /> inside your meeting page. It reads meetingId from route and user from useAuth.
 */

export default function MeetingWebRTC() {
  const { meetingId } = useParams();
  const { user } = useAuth(); // your existing hook; fallback to prompt if not present
  const username = user?.username || (typeof window !== 'undefined' ? localStorage.getItem('tempUser') : null);

  const [status, setStatus] = useState('idle');
  const [role, setRole] = useState(null); // 'offerer' | 'answerer'
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [remoteConnected, setRemoteConnected] = useState(false);

  const stompRef = useRef(null);
  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const remoteCandidatesRef = useRef([]);
  const isIceGatheringRef = useRef(false);

  // STUN servers - public Google and free ones. Adjust as needed.
  const RTC_CONFIG = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      // add TURN if you have one: { urls: 'turn:turn.example.com', username: 'user', credential: 'pass' }
    ],
  };

  // helper: push message
  const pushMessage = (m) => setMessages((s) => [...s, m]);

  // tiny helper to prompt username if absent (keeps single-file)
  useEffect(() => {
    if (!username) {
      const nm = prompt('Enter name for meeting (temporary)') || `User${Math.floor(Math.random()*9000)+100}`;
      localStorage.setItem('tempUser', nm);
      window.location.reload();
    }
  }, [username]);

  // Create RTCPeerConnection
  function createPeerConnection() {
    const pc = new RTCPeerConnection(RTC_CONFIG);

    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      // send candidate over STOMP
      sendSignal('candidate', e.candidate);
    };

    pc.ondatachannel = (ev) => {
      // answerer will receive the data channel here
      const ch = ev.channel;
      dcRef.current = ch;
      setupDataChannel(ch);
    };

    pc.onconnectionstatechange = () => {
      const st = pc.connectionState || pc.iceConnectionState;
      console.log('[pc] connection state:', st);
      if (st === 'connected' || st === 'completed') setRemoteConnected(true);
      if (st === 'disconnected' || st === 'failed' || st === 'closed') setRemoteConnected(false);
    };

    return pc;
  }

  // Setup event handlers for data channel
  function setupDataChannel(ch) {
    ch.onopen = () => {
      console.log('[dc] open');
      pushMessage({ sender: 'system', text: 'Data channel open' });
      setConnected(true);
    };
    ch.onclose = () => {
      console.log('[dc] closed');
      pushMessage({ sender: 'system', text: 'Data channel closed' });
      setConnected(false);
    };
    ch.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        if (parsed?.type === 'chat') {
          pushMessage({ sender: parsed.sender || 'peer', text: parsed.text });
        } else {
          // generic payload
          pushMessage({ sender: 'peer', text: typeof parsed === 'string' ? parsed : JSON.stringify(parsed) });
        }
      } catch {
        pushMessage({ sender: 'peer', text: e.data });
      }
    };
    ch.onerror = (err) => console.error('[dc] error', err);
  }

  // STOMP publish helper
  function sendSignal(type, data) {
    const client = stompRef.current;
    if (!client || !client.connected) {
      console.warn('stomp not connected');
      return;
    }
    const payload = {
      type,
      data,
      sender: username,
    };
    client.publish({
      destination: `/app/signal/${meetingId}`,
      body: JSON.stringify(payload),
    });
  }

  // Handle incoming STOMP signal
  async function handleSignal(msg) {
    if (!msg) return;
    let body;
    try {
      body = typeof msg === 'string' ? JSON.parse(msg) : msg;
    } catch (e) {
      console.warn('invalid signal body', msg);
      return;
    }
    const { type, data, sender } = body;
    if (sender === username) return; // ignore our own signals

    console.log('[signal] got', type, sender);

    const pc = pcRef.current;

    if (type === 'offer') {
      // answerer: set remote desc and create answer
      await pc.setRemoteDescription(new RTCSessionDescription(data));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSignal('answer', pc.localDescription);
    } else if (type === 'answer') {
      // offerer: set remote description
      await pc.setRemoteDescription(new RTCSessionDescription(data));
    } else if (type === 'candidate') {
      // add ICE candidate (if pc ready)
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data));
      } catch (err) {
        console.warn('addIceCandidate error', err);
        // if not ready, store and consume later
        remoteCandidatesRef.current.push(data);
      }
    } else if (type === 'chat') {
      // chat message via signaling (fallback)
      pushMessage({ sender: sender || 'peer', text: data?.text ?? JSON.stringify(data) });
    }
  }

  // Create offer flow (offerer)
  async function createAndSendOffer() {
    const pc = pcRef.current = createPeerConnection();

    // create data channel
    const dc = pc.createDataChannel('chat');
    dcRef.current = dc;
    setupDataChannel(dc);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    // send via STOMP
    sendSignal('offer', pc.localDescription);
  }

  // Called when we know we are offerer/answerer
  async function startWebRTC(asOfferer) {
    setStatus(asOfferer ? 'acting as OFFERER' : 'acting as ANSWERER');

    if (asOfferer) {
      await createAndSendOffer();
    } else {
      // answerer: create pc (ondatachannel will set up data channel)
      pcRef.current = createPeerConnection();
      // If any candidates were buffered (unlikely here), try to add later
    }
  }

  // Join room and connect STOMP
  useEffect(() => {
    if (!meetingId || !username) return;

    let client = null;
    let sub = null;
    let aborted = false;

    async function connectAndJoin() {
      setStatus('connecting signaling...');
      client = new StompClient({
        webSocketFactory: () => new SockJS(`${process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')}/ws`),
        reconnectDelay: 2000,
        // debug: (str) => console.log('[stomp]', str),
      });

      client.onConnect = async () => {
        console.log('[stomp] connected');
        setStatus('connected to signaling');

        // subscribe to signals for this meeting
        sub = client.subscribe(`/topic/signal/${meetingId}`, (m) => {
          try {
            const body = JSON.parse(m.body);
            handleSignal(body);
          } catch (e) {
            console.error('failed parse stomp body', e);
          }
        });

        // Now join the room via backend to determine offerer/answerer
        try {
          setStatus('joining room...');
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '')}/api/rooms/${meetingId}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: username }),
            credentials: 'include',
          });

          if (!res.ok) {
            const t = await res.text();
            throw new Error(`join failed: ${res.status} ${t}`);
          }

          const data = await res.json();
          console.log('[join] response', data);

          // server's RoomController returns { isOfferer, participants, count }
          // if it returns isOfferer === true -> create offer; else wait for offer.
          const isOfferer = !!data.isOfferer;
          setRole(isOfferer ? 'offerer' : 'answerer');

          // start webRTC flow
          startWebRTC(isOfferer);

        } catch (err) {
          console.error('join room error', err);
          setStatus('failed to join room: ' + (err.message || err));
        }
      };

      client.onStompError = (frame) => {
        console.error('[stomp] error', frame);
      };

      client.activate();
      stompRef.current = client;
    }

    connectAndJoin();

    return () => {
      aborted = true;
      try {
        // cleanup
        stompRef.current?.deactivate();
      } catch {}
      try {
        pcRef.current?.close();
      } catch {}
      try {
        dcRef.current?.close();
      } catch {}
      stompRef.current = null;
      pcRef.current = null;
      dcRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meetingId, username]);

  // convenience: send chat over datachannel (if open), otherwise use signaling fallback
  function sendChatMessage() {
    if (!text.trim()) return;
    const payload = { type: 'chat', sender: username, text: text.trim(), ts: Date.now() };
    if (dcRef.current && dcRef.current.readyState === 'open') {
      dcRef.current.send(JSON.stringify(payload));
      pushMessage({ sender: 'me', text: text.trim() });
      setText('');
      return;
    }
    // fallback: publish via STOMP
    sendSignal('chat', { text: text.trim() });
    pushMessage({ sender: 'me', text: text.trim() });
    setText('');
  }

  return (
    <div className="p-3 bg-gray-900 text-white rounded-md max-w-md">
      <div className="mb-2 text-xs text-gray-300">
        <strong>Meeting:</strong> {meetingId} &nbsp;|&nbsp; <strong>User:</strong> {username || '—'}
      </div>

      <div className="mb-2 text-sm">
        <span className="inline-block px-2 py-1 rounded bg-gray-800 text-xs mr-2">Status: {status}</span>
        <span className="inline-block px-2 py-1 rounded bg-gray-800 text-xs">Role: {role || '—'}</span>
        <span className="inline-block px-2 py-1 rounded bg-gray-800 text-xs ml-2">Remote: {remoteConnected ? 'connected' : '—'}</span>
      </div>

      <div className="border border-gray-700 rounded p-2 mb-2 h-48 overflow-auto bg-black/30">
        {messages.length === 0 ? (
          <div className="text-gray-400 text-sm">No messages yet — chat opens when data channel connects.</div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`mb-1 ${m.sender === 'me' ? 'text-teal-300' : m.sender === 'system' ? 'text-yellow-300' : 'text-gray-200'}`}>
              <span className="text-xs text-gray-400">{m.sender}: </span>
              <span className="text-sm">{m.text}</span>
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
          placeholder="Type message..."
          className="flex-1 px-3 py-2 rounded bg-gray-800 border border-gray-700 outline-none text-sm"
        />
        <button onClick={sendChatMessage} className="px-3 py-2 rounded bg-teal-600 hover:bg-teal-700 text-sm">
          Send
        </button>
      </div>

      <div className="mt-3 text-xs text-gray-500">
        Notes: This component handles peer-to-peer signaling over STOMP and a DataChannel for chat.
      </div>
    </div>
  );
}
