'use client';
// ✅ FIX: Import lazy and Suspense from React
import React, { useState, useRef, useEffect, lazy, Suspense } from 'react';
// ✅ FIX: Changed from next/navigation to react-router-dom

// ✅ FIX: Removed next/dynamic import
// import dynamic from 'next/dynamic';
import {
  FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash,
  FaDesktop, FaPhoneSlash, FaComments, FaCode,
  FaPaperPlane, FaUserCircle, FaExpand, FaCompress
} from 'react-icons/fa';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import axiosInstance from '@/utils/axiosInstance';
import { useAuth } from '@/context/AuthProvider';
import { useParams } from 'next/navigation';

// ✅ FIX: Use React.lazy for dynamic import
const Editor = lazy(() => import('@monaco-editor/react'));

const RecruiterRoom = () => {
  const { user } = useAuth();
  const params = useParams();
  const roomId = String(params.meetingId || '');
  const userName = useRef(user?.name || `Recruiter-${Math.floor(Math.random() * 1000)}`).current;

  // UI States
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [editorOpen, setEditorOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);
  const [remoteCamOn, setRemoteCamOn] = useState(false);
  const [editorMaximized, setEditorMaximized] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { id: 1, sender: 'System', text: 'Welcome to the meeting!' },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(true);
  const [code, setCode] = useState('// Recruiter: Start typing here...\n');

  // Refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const pc = useRef(null);
  const stompClient = useRef(null);
  const connectedRef = useRef(false);
  const offerCreated = useRef(false);
  const pendingCandidates = useRef([]);
  const joinedRef = useRef(false);
  const codeUpdateTimeout = useRef(null);

  // Recruiter always acts as offerer
  const isOfferer = useRef(true);

  // --- Helpers: logging wrapper
  const log = {
    info: (...a) => console.log('[Recruiter]', ...a),
    warn: (...a) => console.warn('[Recruiter]', ...a),
    err: (...a) => console.error('[Recruiter]', ...a),
  };

  // 🔹 Join Room
  useEffect(() => {
    if (!roomId || joinedRef.current) return;
    joinedRef.current = true;

    (async () => {
      try {
        log.info('Joining room...', { roomId, userName, role: 'RECRUITTER' });
        const res = await axiosInstance.post(`/rooms/${roomId}/join`, {
          name: userName,
          role: 'RECRUITER',
        });
        log.info('🧩 Joined room:', res.data);
        await setupConnection();
      } catch (err) {
        log.err('❌ Room join failed:', err?.response?.data || err?.message);
      }
    })();

    return () => leaveCleanup();
  }, [roomId, userName]);

  // ⚙️ Setup WebRTC + STOMP
  const setupConnection = async () => {
    if (pc.current) return;

    setIsConnecting(true);
    log.info('Setting up RTCPeerConnection (as Offerer)...');

    pc.current = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject',
        },
      ],
    });

    pc.current.onconnectionstatechange = () => {
      log.info('🔗 Connection state:', pc.current.connectionState);
      if (pc.current.connectionState === 'connected') {
        log.info('✅ Peer connected successfully!');
        setIsConnecting(false);
      } else if (['disconnected', 'failed'].includes(pc.current.connectionState)) {
        log.warn('⚠️ Connection lost or failed.');
        setIsConnecting(true);
        offerCreated.current = false;
      }
    };

    pc.current.oniceconnectionstatechange = () => {
      log.info('🧊 ICE state:', pc.current.iceConnectionState);
    };

    pc.current.onicecandidateerror = (e) => {
      log.err('🚨 ICE candidate error:', e);
    };

    pc.current.onicecandidate = (event) => {
      if (event.candidate) {
        log.info('➡️ Local ICE candidate generated, sending...');
        sendSignal('CANDIDATE', event.candidate.toJSON());
      } else {
        log.info('⛔ ICE gathering complete (no more candidates).');
      }
    };

    pc.current.ontrack = (event) => {
      log.info('🎥 Remote track received.', { streams: event.streams?.length });
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        remoteVideoRef.current.play?.().catch(() => {});
      }
      setRemoteCamOn(true);
      setIsConnecting(false);
    };

    // 🧩 Local Media Setup
    try {
      log.info('Requesting local media...');
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      stream.getTracks().forEach((t) => pc.current.addTrack(t, stream));
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play?.().catch(() => {});
      }
      log.info('✅ Local media attached.');
    } catch (err) {
      log.err('❌ Media access error:', err);
      alert('Please allow camera and microphone permissions.');
      return;
    }

    // ---- STOMP ----
    const url = `${process.env.NEXT_PUBLIC_API_URL}/ws`;
    log.info('Connecting STOMP via SockJS:', url);
    const socket = new SockJS(url);
    const client = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 3000,
      debug: (msg) => console.log('🧠 STOMP:', msg),
      onConnect: () => {
        connectedRef.current = true;
        log.info('✅ STOMP connected');

        client.subscribe(`/topic/signal/${roomId}`, (msg) => {
          try {
            const signal = JSON.parse(msg.body);
            if (signal.sender === userName) return; // ignore own
            log.info('📨 Signal received from broker:', signal);
            handleSignal(signal);
          } catch (e) {
            log.err('❌ Signal parse error:', e);
          }
        });

        // Send our own JOIN message
        sendSignal('JOIN', { name: userName });
      },
      onWebSocketError: (e) => log.err('❌ WebSocket error:', e),
      onStompError: (frame) => log.err('❌ STOMP frame error:', frame?.headers?.message),
    });

    stompClient.current = client;
    client.activate();
  };

  // 📨 Send Signal
  const sendSignal = (type, data) => {
    const TYPE = (type || '').toUpperCase();
    if (!connectedRef.current || !stompClient.current?.connected) {
      log.warn('⏳ Tried to send signal before STOMP connected:', TYPE);
      return;
    }
    const payload = { sender: userName, type: TYPE, data };
    stompClient.current.publish({
      destination: `/app/signal/${roomId}`,
      body: JSON.stringify(payload),
    });
  };

  // 📡 Handle Incoming Signals
  const handleSignal = async (signal) => {
    const type = (signal.type || '').toUpperCase();
    const data = signal.data;

    switch (type) {
      case 'ANSWER':
        if (!pc.current.remoteDescription) {
          log.info('📩 Answer received (setting remote description).');
          await pc.current.setRemoteDescription(new RTCSessionDescription(data));
          await processPendingCandidates();
          setIsConnecting(false);
        } else {
          log.warn('⚖️ Answer ignored because remoteDescription already set.');
        }
        break;
      case 'CANDIDATE':
        if (pc.current.remoteDescription) {
          log.info('🧊 Adding remote ICE candidate immediately.');
          await pc.current.addIceCandidate(new RTCIceCandidate(data)).catch((e) => log.err('ICE add error:', e));
        } else {
          log.info('🧊 Queuing ICE candidate until remoteDescription set.');
          pendingCandidates.current.push(data);
        }
        break;
      case 'CHAT':
        setChatMessages((prev) => [...prev, { id: Date.now(), sender: signal.sender, text: data }]);
        break;
      case 'CODE':
        log.info('⌨️ Code received');
        setCode(data);
        break;
      case 'JOIN':
        log.info('👋 Peer joined:', data);
        if (isOfferer.current && !offerCreated.current) {
          offerCreated.current = true;
          log.info('🕒 Peer joined, creating offer...');
          createOffer();
        }
        break;
      case 'LEAVE':
        log.info('👋 Peer left:', data);
        offerCreated.current = false;
        setRemoteCamOn(false);
        setIsConnecting(true); // Wait for new user
        break;
      default:
        log.warn('⚠️ Unknown signal type:', type);
    }
  };

  // 💡 Offer/Answer Handlers
  const createOffer = async () => {
    try {
      if (!pc.current) return;
      if (pc.current.signalingState !== 'stable') {
        log.warn('⚠️ Not stable before createOffer; rolling back first.');
        await pc.current.setLocalDescription({ type: 'rollback' });
      }
      log.info('📝 Creating offer...');
      const offer = await pc.current.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: true,
      });
      await pc.current.setLocalDescription(offer);
      sendSignal('OFFER', offer);
      log.info('✅ Offer created & sent.');
    } catch (err) {
      log.err('❌ Offer creation error:', err);
    }
  };

  const processPendingCandidates = async () => {
    if (!pendingCandidates.current.length) return;
    log.info(`🔄 Processing ${pendingCandidates.current.length} queued ICE candidates...`);
    for (const c of pendingCandidates.current) {
      try {
        await pc.current.addIceCandidate(new RTCIceCandidate(c));
      } catch (err) {
        log.err('ICE add error:', err);
      }
    }
    pendingCandidates.current = [];
  };

  // 💬 Chat
  const sendChat = () => {
    const text = chatInput.trim();
    if (!text) return;
    sendSignal('CHAT', text);
    setChatMessages((prev) => [...prev, { id: Date.now(), sender: userName, text }]);
    setChatInput('');
  };

  // Code change handler
  const handleCodeChange = (newCode) => {
    setCode(newCode);
    clearTimeout(codeUpdateTimeout.current);
    codeUpdateTimeout.current = setTimeout(() => {
      sendSignal('CODE', newCode);
    }, 300);
  };

  // 🎤 Mic / 🎥 Cam
  const toggleMic = () => {
    const stream = localStreamRef.current;
    if (stream) stream.getAudioTracks().forEach((t) => (t.enabled = !micOn));
    setMicOn((p) => !p);
  };

  const toggleCam = () => {
    const stream = localStreamRef.current;
    if (stream) stream.getVideoTracks().forEach((t) => (t.enabled = !camOn));
    setCamOn((p) => !p);
  };

  // 🖥 Screen Share
  const toggleScreenShare = async () => {
    if (!screenSharing) {
      try {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const track = screen.getVideoTracks()[0];
        const sender = pc.current.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(track);
          track.onended = () => toggleScreenShare();
          setScreenSharing(true);
          log.info('🖥️ Screen sharing started.');
        }
      } catch (err) {
        log.err('Screen share error:', err);
      }
    } else {
      const cam = localStreamRef.current;
      const track = cam?.getVideoTracks()?.[0];
      const sender = pc.current.getSenders().find((s) => s.track?.kind === 'video');
      if (sender && track) {
        await sender.replaceTrack(track);
      }
      setScreenSharing(false);
      log.info('🖥️ Screen sharing stopped.');
    }
  };

  // 📴 Leave
  const leaveMeeting = () => {
    sendSignal('LEAVE', `${userName} left`);
    leaveCleanup();
    window.location.href = '/';
  };

  const leaveCleanup = () => {
    try {
      stompClient.current?.deactivate();
    } catch {}
    try {
      pc.current?.close();
    } catch {}
    try {
      localStreamRef.current?.getTracks()?.forEach((t) => t.stop());
    } catch {}
    log.info('🧹 Cleanup complete.');
  };

  // 🎨 Toggle Editor
  const toggleEditor = () => {
    setEditorOpen((p) => {
      if (p) setEditorMaximized(false);
      return !p;
    });
  };

  // 🧩 UI (unchanged, but wired up code editor)
  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 flex flex-col">
      <div className="flex-1 flex gap-3 overflow-hidden rounded-lg border border-gray-700 p-2">
        {editorOpen && (
          <div
            className={`${
              editorMaximized ? 'w-full' : 'w-1/4'
            } bg-gray-800 border border-gray-700 flex flex-col transition-all duration-300`}
          >
            <div className="p-2 bg-gray-700 flex items-center justify-between text-sm font-medium">
              <span>Code Editor</span>
              <button
                onClick={() => setEditorMaximized((p) => !p)}
                className="p-1 rounded hover:bg-gray-600"
              >
                {editorMaximized ? <FaCompress /> : <FaExpand />}
              </button>
            </div>
            <div className="flex-1">
              {/* ✅ FIX: Wrap lazy-loaded component in Suspense */}
              <Suspense fallback={<div className="p-4 text-gray-400">Loading Editor...</div>}>
                <Editor
                  height="100%"
                value={code}
                onChange={handleCodeChange}
                options={{
                  fontSize: 13,
                  minimap: { enabled: false },
                  }}
                />
              </Suspense>
            </div>
          </div>
        )}

        {!editorMaximized && (
          <div className="relative bg-black flex-1 flex flex-col items-center justify-center rounded-lg border border-gray-700">
            {isConnecting && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60 text-gray-300 text-lg">
                Connecting...
              </div>
            )}

            {remoteCamOn && !isConnecting ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              !isConnecting && (
                <div className="flex flex-col items-center justify-center text-gray-500">
                  <FaUserCircle size={120} />
                  <p className="text-lg mt-2">Waiting for others...</p>
                </div>
              )
            )}

            <div className="absolute right-4 bottom-4 w-40 h-28 rounded overflow-hidden border border-gray-700 bg-gray-900">
              {camOn ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <FaUserCircle size={50} />
                </div>
              )}
            </div>
          </div>
        )}

        {!editorMaximized && chatOpen && (
          <div className="w-1/4 bg-gray-800 border border-gray-700 flex flex-col rounded-lg">
            <div className="p-2 bg-gray-700 font-medium text-sm text-center">Chat</div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-2 rounded ${
                    msg.sender === userName ? 'bg-teal-800/30 ml-auto' : 'bg-gray-700/50'
                  }`}
                >
                  <div className="text-xs text-gray-300 font-medium">{msg.sender}</div>
                  <div className="text-sm">{msg.text}</div>
                </div>
              ))}
            </div>
            <div className="flex p-2 border-t border-gray-700">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                placeholder="Type a message..."
                className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm outline-none"
              />
              <button
                onClick={sendChat}
                className="ml-2 p-2 bg-teal-600 rounded hover:bg-teal-700"
              >
                <FaPaperPlane />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center mt-4">
        <button
          onClick={toggleEditor}
          className="bg-gray-800 hover:bg-gray-700 text-sm px-3 py-2 rounded flex items-center gap-2"
        >
          <FaCode /> {editorOpen ? 'Close Editor' : 'Open Editor'}
        </button>

        <div className="flex justify-center gap-4">
          <button
            onClick={toggleMic}
            className={`p-3 rounded-full border ${
              micOn ? 'border-teal-400 text-teal-400' : 'border-red-500 text-red-500'
            }`}
          >
            {micOn ? <FaMicrophone /> : <FaMicrophoneSlash />}
          </button>
          <button
            onClick={toggleCam}
            className={`p-3 rounded-full border ${
              camOn ? 'border-teal-400 text-teal-400' : 'border-red-500 text-red-500'
            }`}
          >
            {camOn ? <FaVideo /> : <FaVideoSlash />}
          </button>
          <button
            onClick={toggleScreenShare}
            className={`p-3 rounded-full border ${
              screenSharing ? 'border-teal-400 text-teal-400' : 'border-gray-400 text-gray-400'
            }`}
          >
            <FaDesktop />
          </button>
          <button
            onClick={leaveMeeting}
            className="p-3 rounded-full bg-red-600 hover:bg-red-700"
          >
            <FaPhoneSlash />
          </button>
        </div>

        <button
          onClick={() => setChatOpen((p) => !p)}
          className="bg-gray-800 hover:bg-gray-700 text-sm px-3 py-2 rounded flex items-center gap-2"
        >
          <FaComments /> {chatOpen ? 'Close Chat' : 'Open Chat'}
        </button>
      </div>
    </div>
  );
};

export default RecruiterRoom;