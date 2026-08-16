'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { Client as StompClient } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import axiosInstance from '@/utils/axiosInstance';
import { useAuth } from '@/context/AuthProvider';

export default function MeetingWebRTC() {
  const { meetingId } = useParams();
  const { user } = useAuth();
  const username = user?.username || 'Guest' + Math.floor(Math.random() * 10000);

  const [status, setStatus] = useState('Initializing...');
  const [role, setRole] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [connected, setConnected] = useState(false);

  const stompRef = useRef(null);
  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const remoteConnectedRef = useRef(false);

  const RTC_CONFIG = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  };

  const pushMessage = (msg) => setMessages((prev) => [...prev, msg]);

  function createPeerConnection() {
    const pc = new RTCPeerConnection(RTC_CONFIG);

    pc.onicecandidate = (event) => {
      if (event.candidate) sendSignal('candidate', event.candidate);
    };

    pc.ondatachannel = (event) => {
      const channel = event.channel;
      dcRef.current = channel;
      setupDataChannel(channel);
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'connected') {
        remoteConnectedRef.current = true;
        pushMessage({ sender: 'system', text: 'Connected with peer ✅' });
      } else if (['disconnected', 'failed', 'closed'].includes(state)) {
        remoteConnectedRef.current = false;
        pushMessage({ sender: 'system', text: 'Peer disconnected ⚠️' });
      }
    };

    return pc;
  }

  function setupDataChannel(channel) {
    channel.onopen = () => {
      pushMessage({ sender: 'system', text: 'Chat ready 🎤' });
      setConnected(true);
    };
    channel.onmessage = (e) => {
      const data = JSON.parse(e.data);
      pushMessage({ sender: data.sender || 'peer', text: data.text });
    };
    channel.onclose = () => {
      setConnected(false);
      pushMessage({ sender: 'system', text: 'Chat closed 🚪' });
    };
  }

  function sendSignal(type, data) {
    const client = stompRef.current;
    if (!client || !client.connected) return;
    const payload = { type, data, sender: username };
    client.publish({
      destination: `/app/signal/${meetingId}`,
      body: JSON.stringify(payload),
    });
  }

  async function handleSignal(msg) {
    const { type, data, sender } = msg;
    if (sender === username) return;
    const pc = pcRef.current;

    if (type === 'offer') {
      await pc.setRemoteDescription(new RTCSessionDescription(data));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendSignal('answer', pc.localDescription);
    } else if (type === 'answer') {
      await pc.setRemoteDescription(new RTCSessionDescription(data));
    } else if (type === 'candidate') {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(data));
      } catch (err) {
        console.error('ICE add error:', err);
      }
    } else if (type === 'chat') {
      pushMessage({ sender, text: data.text });
    }
  }

  async function createAndSendOffer() {
    const pc = (pcRef.current = createPeerConnection());
    const dc = pc.createDataChannel('chat');
    dcRef.current = dc;
    setupDataChannel(dc);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendSignal('offer', pc.localDescription);
  }

  async function startWebRTC(isOfferer) {
    setRole(isOfferer ? 'Offerer' : 'Answerer');
    if (isOfferer) await createAndSendOffer();
    else pcRef.current = createPeerConnection();
  }

  // 🧠 Connect STOMP + Join matchmaking
  useEffect(() => {
    if (!meetingId || !username) return;

    let stompClient;

    const connectAndJoin = async () => {
      setStatus('Connecting signaling...');

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      stompClient = new StompClient({
        webSocketFactory: () => new SockJS(`${apiUrl}/ws`),
        reconnectDelay: 3000,
      });

      stompClient.onConnect = async () => {
        setStatus('Connected to signaling');
        stompClient.subscribe(`/topic/signal/${meetingId}`, (msg) => {
          handleSignal(JSON.parse(msg.body));
        });

        try {
          setStatus('Joining matchmaking...');
          const { data } = await axiosInstance.post(`/matchmaking/join`, {
            username,
            meetingId,
          });

          console.log('[Matchmaking]', data);

          if (data.matched) {
            pushMessage({
              sender: 'system',
              text: `Matched with ${data.isOfferer ? 'Answerer' : 'Offerer'} 🎯`,
            });
          } else {
            pushMessage({ sender: 'system', text: 'Waiting for another participant...' });
          }

          await startWebRTC(data.isOfferer);
          setStatus('WebRTC started');
        } catch (err) {
          console.error('join failed', err);
          setStatus('Join failed: ' + (err.response?.data || err.message));
        }
      };

      stompClient.activate();
      stompRef.current = stompClient;
    };

    connectAndJoin();

    return () => {
      stompRef.current?.deactivate();
      pcRef.current?.close();
      dcRef.current?.close();
    };
  }, [meetingId, username]);

  function sendChat() {
    if (!text.trim()) return;
    const message = { type: 'chat', sender: username, text: text.trim() };
    if (dcRef.current?.readyState === 'open') {
      dcRef.current.send(JSON.stringify(message));
      pushMessage({ sender: 'me', text: text.trim() });
    } else {
      sendSignal('chat', { text: text.trim() });
      pushMessage({ sender: 'me', text: text.trim() });
    }
    setText('');
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-gray-800/70 border border-gray-700 rounded-xl p-4 shadow-md">
        <h2 className="text-lg font-semibold text-teal-400 mb-3 text-center">
          Meeting ID: {meetingId}
        </h2>
        <p className="text-gray-300 text-xs text-center mb-3">
          User: <span className="font-mono text-teal-300">{username}</span>
        </p>

        <div className="text-xs text-gray-400 mb-3 text-center">
          Status: <span className="text-teal-400">{status}</span> | Role:{' '}
          <span className="text-yellow-400">{role || '—'}</span>
        </div>

        <div className="border border-gray-700 rounded p-2 h-48 overflow-y-auto bg-black/30 mb-2">
          {messages.length === 0 ? (
            <p className="text-gray-500 text-sm text-center mt-16">
              Waiting for messages...
            </p>
          ) : (
            messages.map((m, i) => (
              <div
                key={i}
                className={`text-sm mb-1 ${
                  m.sender === 'me'
                    ? 'text-teal-300 text-right'
                    : m.sender === 'system'
                    ? 'text-yellow-400 text-center'
                    : 'text-gray-200 text-left'
                }`}
              >
                {m.sender !== 'system' && (
                  <span className="text-gray-500 text-xs">{m.sender}: </span>
                )}
                {m.text}
              </div>
            ))
          )}
        </div>

        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendChat()}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 rounded bg-gray-900 border border-gray-700 outline-none text-sm"
          />
          <button
            onClick={sendChat}
            disabled={!connected}
            className={`px-3 py-2 rounded text-sm ${
              connected
                ? 'bg-teal-600 hover:bg-teal-700 text-white'
                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
            }`}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
