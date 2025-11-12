'use client';
import React, { useEffect, useState, lazy, Suspense, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  StreamVideoClient,
  StreamVideo,
  StreamCall,
  ParticipantView,
  useCallStateHooks,
} from '@stream-io/video-react-sdk';
import axios from 'axios';
import {
  FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash,
  FaPhoneSlash, FaComments, FaCode, FaExpand, FaCompress,
  FaPaperPlane, FaCircle, FaStop, FaSpinner
} from 'react-icons/fa';
import { useAuth } from '@/context/AuthProvider';
import { Client as StompClient } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import axiosInstance from '@/utils/axiosInstance';
import toast from 'react-hot-toast';
const Editor = lazy(() => import('@monaco-editor/react'));

/**
 * Single-file MeetingRoom:
 * - keeps Stream initialization & UI as before
 * - inlines WebRTC DataChannel + STOMP matchmaking/signaling
 * - integrates chat + editor sync with DataChannel (fallback to STOMP)
 *
 * Notes:
 * - backend endpoints used:
 *   POST /api/matchmaking/join  body: { username, meetingId }
 *   POST /api/matchmaking/leave body: { username }
 *   POST /completed-meetings/{meetingId} for saving recording
 * - requires axiosInstance to include credentials/cookies as in your project
 */

export default function MeetingRoom() {
  const { meetingId } = useParams();
  const [client, setClient] = useState(null);
  const [call, setCall] = useState(null);
  const [status, setStatus] = useState('🔄 Initializing...');
  const [error, setError] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!meetingId || !user) {
      setStatus(!user ? '⏳ Waiting for user...' : '⚠️ No meeting ID found.');
      return;
    }

    const username = user.username;
    const userId = user.id;
    let streamClient, callInstance;

    const init = async () => {
      try {
        setStatus('📡 Fetching Stream token...');
        const res = await axios.get(`/api/stream/token?user_id=${encodeURIComponent(userId)}`);
        const token = res.data?.token;
        if (!token) throw new Error('No token returned from backend');

        const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
        if (!apiKey) throw new Error('Missing Stream API Key');
        streamClient = new StreamVideoClient({ apiKey, options: { disable_location_hint: true } });

        setStatus('👤 Connecting user...');
        await streamClient.connectUser({ id: userId, name: username }, token);
        setStatus('✅ Stream user connected');

        setStatus('🎥 Joining call...');
        callInstance = streamClient.call('default', meetingId);
        await callInstance.join({ create: true });

        setClient(streamClient);
        setCall(callInstance);
        setStatus('✅ Connected to meeting');
      } catch (err) {
        console.error('❌ Stream init error:', err);
        setError(err.message || String(err));
        setStatus('❌ Failed to initialize');
      }
    };

    init();

    return () => {
      (async () => {
        try {
          await callInstance?.stopRecording?.();
          await callInstance?.leave();
          await streamClient?.disconnectUser();
        } catch {}
      })();
    };
  }, [meetingId, user]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-red-500 space-y-3">
        <p className="text-xl font-semibold">❌ Stream Initialization Failed</p>
        <p>{error}</p>
        <p className="text-gray-400">Check browser console for details.</p>
      </div>
    );
  }

  if (!client || !call) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-gray-300 space-y-2">
        <p className="text-lg animate-pulse">{status}</p>
        <p className="text-sm opacity-60">(Open console for logs)</p>
      </div>
    );
  }

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <CallUI call={call} meetingId={meetingId} username={user.username} user={user} />
      </StreamCall>
    </StreamVideo>
  );
}

/* ---------------- Call UI with integrated DataChannel + STOMP + Monaco sync ---------------- */
const CallUI = ({ call, meetingId, username, user }) => {
  const { useParticipants, useLocalParticipant } = useCallStateHooks();
  const participants = useParticipants();
  const local = useLocalParticipant();

  // existing UI state
  const [editorOpen, setEditorOpen] = useState(true);
  const [editorMax, setEditorMax] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [recording, setRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [recordingBadge, setRecordingBadge] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // signaling & webrtc state (inlined)
  const stompRef = useRef(null);
  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const [stompConnected, setStompConnected] = useState(false);
  const [isOfferer, setIsOfferer] = useState(null);
  const handleSignalRef = useRef(null);

  // realtime chat/code state
  const [messages, setMessages] = useState([]); // {sender, text}
  const [code, setCode] = useState('// Start coding...');
  const codeSendDebounceRef = useRef(null);

  // snackbar for recording save
  const [showSaveSnackbar, setShowSaveSnackbar] = useState(false);

  // small peer config (no TURN). Add TURN if needed in production.
  const RTC_CONFIG = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
    ],
  };

  /* -------------------- DataChannel helpers -------------------- */
  const pushMessage = useCallback((m) => setMessages(prev => [...prev, m]), []);
  const sendOverDataChannel = useCallback((payload) => {
    try {
      const ch = dcRef.current;
      if (ch && ch.readyState === 'open') {
        ch.send(JSON.stringify(payload));
        return true;
      }
      return false;
    } catch (err) {
      console.warn('dc send failed', err);
      return false;
    }
  }, []);

  // send chat (use DC, fallback to STOMP publish)
  const sendChat = useCallback((text, sender = username) => {
    const payload = { type: 'chat', sender, text, ts: Date.now() };
    const ok = sendOverDataChannel(payload);
    if (!ok) {
      // fallback publish via STOMP
      if (stompRef.current?.connected) {
        stompRef.current.publish({
          destination: `/app/signal/${meetingId}`,
          body: JSON.stringify({ type: 'chat', data: { text }, sender }),
        });
      }
    }
    pushMessage({ sender: 'me', text });
  }, [sendOverDataChannel, meetingId, username, pushMessage]);

  // send code (debounced)
  const sendCode = useCallback((newCode) => {
    // debounce rapid keystrokes
    if (codeSendDebounceRef.current) clearTimeout(codeSendDebounceRef.current);
    codeSendDebounceRef.current = setTimeout(() => {
      const payload = { type: 'code', sender: username, data: { code: newCode }, ts: Date.now() };
      const ok = sendOverDataChannel(payload);
      if (!ok && stompRef.current?.connected) {
        stompRef.current.publish({
          destination: `/app/signal/${meetingId}`,
          body: JSON.stringify(payload),
        });
      }
    }, 200); // 200ms debounce
  }, [sendOverDataChannel, meetingId, username]);

  /* -------------------- RTC / signaling -------------------- */
  // create RTCPeerConnection with handlers
  function createPeerConnection() {
    const pc = new RTCPeerConnection(RTC_CONFIG);

    pc.onicecandidate = (ev) => {
      if (ev.candidate && stompRef.current?.connected) {
        stompRef.current.publish({
          destination: `/app/signal/${meetingId}`,
          body: JSON.stringify({ type: 'candidate', data: ev.candidate, sender: username }),
        });
      }
    };

    pc.ondatachannel = (ev) => {
      // answerer receives channel here
      const ch = ev.channel;
      dcRef.current = ch;
      setupDataChannel(ch);
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState || pc.iceConnectionState;
      console.log('[pc] state', state);
    };

    return pc;
  }

  function setupDataChannel(ch) {
    ch.onopen = () => {
      console.log('DataChannel open');
      pushMessage({ sender: 'system', text: 'Data channel open' });
    };
    ch.onclose = () => {
      console.log('DataChannel closed');
      pushMessage({ sender: 'system', text: 'Data channel closed' });
    };
    ch.onerror = (err) => {
      console.error('DataChannel error', err);
    };
    ch.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(ev.data);
        if (parsed.type === 'chat') {
          pushMessage({ sender: parsed.sender || 'peer', text: parsed.text });
        } else if (parsed.type === 'code') {
          // update code without echoing back
          if (typeof parsed.data?.code === 'string') {
            setCode(parsed.data.code);
          }
        } else {
          // generic
          pushMessage({ sender: parsed.sender || 'peer', text: parsed.text || JSON.stringify(parsed) });
        }
      } catch (err) {
        console.warn('failed parse dc message', err);
      }
    };
  }

  // handle incoming STOMP signal object (already parsed)
  async function handleSignal(msg) {
    if (!msg) return;
    const { type, data, sender } = msg;
    if (sender === username) return; // ignore own

    // ensure PC exists
    if (!pcRef.current) pcRef.current = createPeerConnection();

    const pc = pcRef.current;

    try {
      if (type === 'offer') {
        // Answerer flow: set remote, create answer
        await pc.setRemoteDescription(new RTCSessionDescription(data));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        stompRef.current.publish({
          destination: `/app/signal/${meetingId}`,
          body: JSON.stringify({ type: 'answer', data: pc.localDescription, sender: username }),
        });
      } else if (type === 'answer') {
        // Offerer receives answer
        await pc.setRemoteDescription(new RTCSessionDescription(data));
      } else if (type === 'candidate') {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data));
        } catch (err) {
          console.warn('addIceCandidate error (buffering maybe)', err);
        }
      } else if (type === 'chat') {
        pushMessage({ sender: sender || 'peer', text: data?.text ?? JSON.stringify(data) });
      } else if (type === 'code') {
        if (data?.code) setCode(data.code);
      }
    } catch (err) {
      console.error('handleSignal error', err);
    }
  }

  // create offer (offerer)
  async function createAndSendOffer() {
    pcRef.current = createPeerConnection();
    // create data channel
    const ch = pcRef.current.createDataChannel('chat');
    dcRef.current = ch;
    setupDataChannel(ch);

    const offer = await pcRef.current.createOffer();
    await pcRef.current.setLocalDescription(offer);

    // send offer
    stompRef.current.publish({
      destination: `/app/signal/${meetingId}`,
      body: JSON.stringify({ type: 'offer', data: pcRef.current.localDescription, sender: username }),
    });
  }

  // start webRTC flow once isOfferer known & stomp connected
  const startedRef = useRef(false);
  useEffect(() => {
    if (!stompConnected) return;
    if (isOfferer === null) return;
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      try {
        if (isOfferer) {
          await createAndSendOffer();
        } else {
          // answerer: create pc and wait for ondatachannel
          pcRef.current = createPeerConnection();
        }
        // mark ready after small delay
        setTimeout(() => setIsReady(true), 1000);
      } catch (err) {
        console.error('start webrtc error', err);
      }
    })();
  }, [stompConnected, isOfferer]);

  /* -------------------- Matchmaking + STOMP connect -------------------- */
  useEffect(() => {
    if (!meetingId || !username) return;

    let client = null;
    let sub = null;
    let alive = true;

    const connect = async () => {
      client = new StompClient({
        webSocketFactory: () => new SockJS(`${process.env.NEXT_PUBLIC_API_URL}/ws`),
        reconnectDelay: 2000,
      });

      client.onConnect = async () => {
        console.log('✅ Connected to signaling server');
        setStompConnected(true);
        stompRef.current = client;

        // subscribe to signals
        sub = client.subscribe(`/topic/signal/${meetingId}`, (m) => {
          try {
            const body = JSON.parse(m.body);
            handleSignal(body);
          } catch (err) {
            console.error('stomp parse error', err);
          }
        });

        // call matchmaking endpoint to decide offerer
        try {
          const res = await axiosInstance.post(`/matchmaking/join`, { username, meetingId });
          const data = res.data;
          console.log('🎯 Matchmaking response:', data);

          // server returns isOfferer boolean (true for first user)
          if (typeof data.isOfferer !== 'undefined') {
            setIsOfferer(!!data.isOfferer);
          } else if (data.matched) {
            // older variant: if matched true and isOfferer false, set accordingly
            setIsOfferer(!!data.isOfferer);
          } else {
            // if server says waiting, poll until matched (simple)
            const poll = async () => {
              if (!alive) return;
              const r = await axiosInstance.post(`/matchmaking/join`, { username, meetingId });
              if (r.data && (r.data.matched || typeof r.data.isOfferer !== 'undefined')) {
                setIsOfferer(!!r.data.isOfferer);
                return;
              }
              setTimeout(poll, 1500);
            };
            setTimeout(poll, 1500);
          }
        } catch (err) {
          console.error('matchmaking join error', err);
        }
      };

      client.onStompError = (frame) => {
        console.error('STOMP error', frame);
      };

      client.activate();
    };

    connect();

    return () => {
      alive = false;
      try { stompRef.current?.deactivate(); } catch {}
      try { pcRef.current?.close(); } catch {}
      try { dcRef.current?.close(); } catch {}
      // call leave to remove from server waiting list
      try { axiosInstance.post('/matchmaking/leave', { username, meetingId }).catch(()=>{}) } catch {}
      stompRef.current = null;
    };
  }, [meetingId, username]);

  /* -------------------- Recording controls (kept unchanged) -------------------- */
  useEffect(() => {
    let timer;
    if (recording) timer = setInterval(() => setRecordTime(t => t + 1), 1000);
    else setRecordTime(0);
    return () => clearInterval(timer);
  }, [recording]);

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const leave = async () => {
    try {
      if (recording) await call.stopRecording();
      await call.leave();
      const client = call?.streamClient || call?.client;
      if (client?.disconnectUser) await client.disconnectUser();
      window.location.href = `/${user?.role?.toLowerCase() || 'user'}/schedule`;
    } catch (err) {
      console.error('⚠️ Error during leave():', err);
    }
  };

  const toggleMic = async () => {
    setMicOn(v => !v);
    if (micOn) await call.microphone.disable();
    else await call.microphone.enable();
  };

  const toggleCam = async () => {
    setCamOn(v => !v);
    if (camOn) await call.camera.disable();
    else await call.camera.enable();
  };

  const toggleRec = async () => {
    try {
      if (recording) {
        await call.stopRecording();
        setRecording(false);
        setRecordingBadge(false);
        setShowSaveSnackbar(true);
      } else {
        if (participants.length < 2) {
          toast.error('Recording can start only when both participants are in the meeting!');
          return;
        }
        await call.startRecording();
        setRecording(true);
        setRecordingBadge(true);
      }
    } catch (err) {
      toast.error("⚠️ Recording error: " + (err?.message || String(err)));
    }
  };

  const handleSaveRecording = async () => {
    try {
      await axiosInstance.post(`/completed-meetings/${meetingId}`);
      toast.success("✅ Recording saved successfully!");
    } catch (err) {
      console.error("❌ Error saving recording:", err);
      toast.error("⚠️ Failed to save recording.");
    } finally {
      setShowSaveSnackbar(false);
    }
  };

  // auto-hide snackbar
  useEffect(() => {
    if (showSaveSnackbar) {
      const t = setTimeout(() => setShowSaveSnackbar(false), 3000);
      return () => clearTimeout(t);
    }
  }, [showSaveSnackbar]);

  /* -------------------- Editor & Chat UI callbacks -------------------- */
  const handleEditorChange = (v) => {
    setCode(v ?? '');
    sendCode(v ?? '');
  };

  const sendChatMessage = () => {
    if (!chatInput.trim()) return;
    sendChat(chatInput.trim(), username);
    setChatInput('');
  };

  // keep the chat scroll in view (simple)
  const chatRef = useRef();
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  /* -------------------- Render UI (kept same as before, wired chat/editor to local state) -------------------- */
  const remote = participants.find(p => !p.isLocalParticipant);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col overflow-hidden">
      <div className="flex-1 flex gap-3 overflow-hidden p-2">

        {/* Code Editor */}
        {editorOpen && (
          <div className={`${editorMax ? 'fixed inset-0 z-50 w-full h-full' : 'w-1/3'}
            bg-gray-800 border border-gray-700 flex flex-col`}>
            <div className="p-2 bg-gray-700 flex justify-between items-center">
              <span>Code Editor {isReady ? '🟢' : '🔄 Loading...'}</span>
              <div className="flex gap-2">
                <button onClick={() => setEditorMax(!editorMax)}>
                  {editorMax ? <FaCompress /> : <FaExpand />}
                </button>
                <button onClick={() => setEditorOpen(false)}>Close</button>
              </div>
            </div>
            {!isReady ? (
              <div className="flex flex-col items-center justify-center flex-1 text-gray-400">
                <FaSpinner className="animate-spin text-3xl mb-2" />
                Connecting WebRTC...
              </div>
            ) : (
              <Suspense fallback={<div className="p-4 text-gray-400">Loading Editor...</div>}>
                <Editor
                  height="100%"
                  theme="vs-dark"
                  value={code}
                  onChange={handleEditorChange}
                  options={{ fontSize: 14, minimap: { enabled: false } }}
                />
              </Suspense>
            )}
          </div>
        )}

        {/* Video */}
        {!editorMax && (
          <div className="flex-1 bg-black rounded-lg border border-gray-700 relative flex items-center justify-center">
            {remote ? (
              <ParticipantView participant={remote} className="w-full h-full object-cover" />
            ) : (
              <div className="text-gray-400 text-lg">Waiting for participant...</div>
            )}
            {local && (
              <div className="absolute bottom-4 right-4 w-40 h-28 border border-gray-700 rounded bg-gray-900 overflow-hidden">
                {camOn ? (
                  <ParticipantView participant={local} className="w-full h-full" />
                ) : (
                  <div className="flex items-center justify-center text-3xl bg-gray-800 text-gray-300">{username[0]}</div>
                )}
              </div>
            )}
            {recordingBadge && (
              <div className="absolute top-4 left-4 bg-red-600 px-3 py-1 rounded-full flex items-center gap-2 animate-pulse">
                <FaCircle className="text-xs" />
                <span className="font-mono text-sm">Recording... {fmt(recordTime)}</span>
              </div>
            )}
          </div>
        )}

        {/* Chat */}
        {!editorMax && chatOpen && (
          <div className="w-1/4 bg-gray-800 border border-gray-700 rounded flex flex-col">
            <div className="p-2 bg-gray-700 flex justify-between items-center">
              <span>Chat {isReady ? '🟢' : '🔄 Loading...'}</span>
              <button onClick={() => setChatOpen(false)}>Close</button>
            </div>
            {!isReady ? (
              <div className="flex flex-1 items-center justify-center text-gray-400">
                <FaSpinner className="animate-spin text-xl mr-2" /> Connecting WebRTC...
              </div>
            ) : (
              <>
                <div ref={chatRef} className="flex-1 overflow-y-auto p-2 space-y-2">
                  {messages.map((m, i) => (
                    <div key={i} className={`p-2 rounded ${m.sender === username ? 'bg-teal-700 self-end' : 'bg-gray-700'}`}>
                      <p className="text-xs text-gray-300">{m.sender}</p>
                      <p>{m.text}</p>
                    </div>
                  ))}
                </div>
                <div className="flex p-2 border-t border-gray-700">
                  <input
                    className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm outline-none"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                    placeholder="Type a message..."
                  />
                  <button onClick={sendChatMessage} className="ml-2 p-2 bg-teal-600 rounded">
                    <FaPaperPlane />
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="flex justify-between items-center p-3 border-t border-gray-800 bg-gray-900">
        <button onClick={() => setEditorOpen(!editorOpen)} className="bg-gray-800 px-3 py-2 rounded flex gap-2 items-center">
          <FaCode /> {editorOpen ? 'Close Editor' : 'Open Editor'}
        </button>

        <div className="flex gap-4 items-center">
          <button onClick={toggleMic} className={`p-3 rounded-full border ${micOn ? 'border-teal-400' : 'border-red-500'}`}>
            {micOn ? <FaMicrophone /> : <FaMicrophoneSlash />}
          </button>
          <button onClick={toggleCam} className={`p-3 rounded-full border ${camOn ? 'border-teal-400' : 'border-red-500'}`}>
            {camOn ? <FaVideo /> : <FaVideoSlash />}
          </button>
          <button onClick={toggleRec} className={`p-3 rounded-full border ${recording ? 'border-red-500' : 'border-gray-400'}`}>
            {recording ? <FaStop /> : <FaCircle />}
          </button>
          <button onClick={leave} className="p-3 bg-red-600 rounded-full"><FaPhoneSlash /></button>
        </div>

        <button onClick={() => setChatOpen(!chatOpen)} className="bg-gray-800 px-3 py-2 rounded flex gap-2 items-center">
          <FaComments /> {chatOpen ? 'Close Chat' : 'Open Chat'}
        </button>
      </div>

      {/* Snackbar for saving recording */}
      {showSaveSnackbar && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-4 z-50 border border-gray-700">
          <span>Do you want to save this recorded video?</span>
          <div className="flex gap-2">
            <button
              onClick={handleSaveRecording}
              className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1 rounded"
            >
              Yes
            </button>
            <button
              onClick={() => setShowSaveSnackbar(false)}
              className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded"
            >
              No
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
