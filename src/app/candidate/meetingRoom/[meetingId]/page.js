'use client';
import React, { useState, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import {
  FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash,
  FaDesktop, FaPhoneSlash, FaComments, FaCode,
  FaUserCircle, FaExpand, FaCompress, FaPaperPlane
} from 'react-icons/fa';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import axiosInstance from '@/utils/axiosInstance';

const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

const MeetingRoom = ({ userName: propName = 'User' }) => {
  const params = useParams();
  const roomId = String(params.meetingId || '');
  const userName = useRef(`${propName}-${Math.floor(Math.random() * 10000)}`).current;

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
  const [code, setCode] = useState('// Start coding here...\n');
  const [isConnecting, setIsConnecting] = useState(true);

  // Refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const pc = useRef(null);
  const stompClient = useRef(null);
  const connectedRef = useRef(false);
  const joinedRef = useRef(false);
  const isOfferer = useRef(false); // Candidate never sends offer
  const offerCreated = useRef(false);
  const pendingCandidates = useRef([]);
  const codeUpdateTimeout = useRef(null);

  // 🔹 Join Room Once
  useEffect(() => {
    if (!roomId || joinedRef.current) return;
    joinedRef.current = true;

    const joinRoom = async () => {
      try {
        const res = await axiosInstance.post(`/rooms/${roomId}/join`, {
          name: userName,
          role: 'CANDIDATE',
        });
        console.log('🧩 Joined room:', res.data);
        await setupConnection();
      } catch (err) {
        console.error('❌ Room join failed:', err.response?.data || err.message);
      }
    };

    joinRoom();
    return () => leaveCleanup();
  }, [roomId, userName]);

  // ⚙️ Setup WebRTC + STOMP
  const setupConnection = async () => {
    if (pc.current) return;
    setIsConnecting(true);

    pc.current = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        {
          urls: 'turn:relay1.expressturn.com:3478',
          username: 'efree',
          credential: 'efree',
        },
      ],
    });

    // 👇 Pre-create transceivers
    pc.current.addTransceiver('video', { direction: 'sendrecv' });
    pc.current.addTransceiver('audio', { direction: 'sendrecv' });

    pc.current.onconnectionstatechange = () => {
      console.log('🔗 Connection state:', pc.current.connectionState);
      if (pc.current.connectionState === 'connected') {
        console.log('✅ Peer connected');
        setIsConnecting(false);
      } else if (
        pc.current.connectionState === 'failed' ||
        pc.current.connectionState === 'disconnected'
      ) {
        console.warn('⚠️ Connection failed/disconnected');
        setIsConnecting(true);
      }
    };

    pc.current.onicecandidate = (event) => {
      if (event.candidate) sendSignal('CANDIDATE', event.candidate.toJSON());
    };

    pc.current.ontrack = (event) => {
      console.log('🎥 Remote track received');
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        remoteVideoRef.current.play?.().catch(() => {});
      }
      setRemoteCamOn(true);
      setIsConnecting(false);
    };

    // 🧩 Local Media Setup
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: 30 },
        audio: true,
      });
      localStreamRef.current = stream;
      stream.getTracks().forEach((t) => pc.current.addTrack(t, stream));
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play?.().catch(() => {});
      }
    } catch (err) {
      console.error('❌ Media access error:', err);
      alert('Please allow camera and microphone permissions.');
      return;
    }

    // 🧠 STOMP Setup
    const socket = new SockJS(`${process.env.NEXT_PUBLIC_API_URL}/ws`);
    const client = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 3000,
      debug: (msg) => console.log('🧠 STOMP:', msg),
      onConnect: () => {
        connectedRef.current = true;
        console.log('✅ STOMP connected');

        client.subscribe(`/topic/signal/${roomId}`, (msg) => {
          try {
            const signal = JSON.parse(msg.body);
            if (signal.sender === userName) return;
            handleSignal(signal);
          } catch (e) {
            console.error('❌ Parse error:', e);
          }
        });

        sendSignal('JOIN', { name: userName });
      },
      onWebSocketError: (e) => console.error('❌ WebSocket error:', e),
      onStompError: (frame) =>
        console.error('❌ STOMP frame error:', frame.headers['message']),
    });

    stompClient.current = client;
    client.activate();
  };

  // 📨 Send Signal
  const sendSignal = (type, data) => {
    if (!connectedRef.current || !stompClient.current?.connected) return;
    stompClient.current.publish({
      destination: `/app/signal/${roomId}`,
      body: JSON.stringify({ sender: userName, type, data }),
    });
  };

  // 📡 Handle Incoming Signals
  const handleSignal = async (signal) => {
    const type = signal.type?.toUpperCase();
    const data = signal.data;

    switch (type) {
      case 'OFFER':
        console.log('📩 Offer received');
        await handleOffer(data);
        break;
      case 'ANSWER':
        if (!pc.current.remoteDescription) {
          console.log('📩 Answer received');
          await pc.current.setRemoteDescription(new RTCSessionDescription(data));
          await processPendingCandidates();
          setIsConnecting(false);
        }
        break;
      case 'CANDIDATE':
        if (pc.current.remoteDescription) {
          await pc.current.addIceCandidate(new RTCIceCandidate(data));
        } else {
          pendingCandidates.current.push(data);
        }
        break;
      case 'CHAT':
        setChatMessages((prev) => [
          ...prev,
          { id: Date.now(), sender: signal.sender, text: data },
        ]);
        break;
      case 'CODE':
        setCode(data);
        break;
      default:
        console.warn('⚠️ Unknown signal:', type);
    }
  };

  // 💡 Answer to Offer
  const handleOffer = async (offer) => {
    try {
      if (pc.current.signalingState !== 'stable') {
        await pc.current.setLocalDescription({ type: 'rollback' });
      }
      await pc.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.current.createAnswer();
      await pc.current.setLocalDescription(answer);
      sendSignal('ANSWER', answer);
      await processPendingCandidates();
    } catch (err) {
      console.error('Answer error:', err);
    }
  };

  const processPendingCandidates = async () => {
    for (const c of pendingCandidates.current) {
      try {
        await pc.current.addIceCandidate(new RTCIceCandidate(c));
      } catch (err) {
        console.error('ICE add error:', err);
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

  // 💻 Code Sync
  const handleCodeChange = (newCode) => {
    setCode(newCode);
    clearTimeout(codeUpdateTimeout.current);
    codeUpdateTimeout.current = setTimeout(() => sendSignal('CODE', newCode), 300);
  };

  // 🎤 Mic / 🎥 Cam
  const toggleMic = () => {
    const s = localStreamRef.current;
    if (s) s.getAudioTracks().forEach((t) => (t.enabled = !micOn));
    setMicOn((p) => !p);
  };

  const toggleCam = () => {
    const s = localStreamRef.current;
    if (s) s.getVideoTracks().forEach((t) => (t.enabled = !camOn));
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
        }
      } catch (err) {
        console.error('Screen share error:', err);
      }
    } else {
      const cam = localStreamRef.current;
      const track = cam.getVideoTracks()[0];
      const sender = pc.current.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) await sender.replaceTrack(track);
      setScreenSharing(false);
    }
  };

  // 📴 Leave
  const leaveMeeting = () => {
    sendSignal('LEAVE', `${userName} left`);
    leaveCleanup();
    window.location.href = '/';
  };

  const leaveCleanup = () => {
    stompClient.current?.deactivate();
    pc.current?.close();
    localStreamRef.current?.getTracks()?.forEach((t) => t.stop());
  };

  // 🎨 Toggle Editor
  const toggleEditor = () => {
    setEditorOpen((p) => {
      if (p) setEditorMaximized(false);
      return !p;
    });
  };

  // 🧩 UI (unchanged)
  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 flex flex-col">
      <div className="flex-1 flex gap-3 overflow-hidden rounded-lg border border-gray-700 p-2">
        {editorOpen && (
          <div
            className={`${editorMaximized ? 'w-full' : 'w-1/3'} bg-gray-800 border border-gray-700 flex flex-col transition-all duration-300`}
          >
            <div className="p-2 bg-gray-700 flex items-center justify-between text-sm font-medium">
              <span>Code Editor</span>
              <button onClick={() => setEditorMaximized((p) => !p)} className="p-1 rounded hover:bg-gray-600">
                {editorMaximized ? <FaCompress /> : <FaExpand />}
              </button>
            </div>
            <Editor
              height="100%"
              theme="vs-dark"
              language="javascript"
              value={code}
              onChange={handleCodeChange}
              options={{ fontSize: 14, minimap: { enabled: false }, automaticLayout: true }}
            />
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
              <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover rounded-lg" />
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
                <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
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
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender === userName ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`p-2 rounded-lg max-w-[75%] ${
                      msg.sender === userName
                        ? 'bg-teal-700 text-white self-end rounded-br-none'
                        : 'bg-gray-700 text-gray-100 self-start rounded-bl-none'
                    }`}
                  >
                    <div className="text-xs text-gray-300 font-medium mb-1">{msg.sender}</div>
                    <div className="text-sm">{msg.text}</div>
                  </div>
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
              <button onClick={sendChat} className="ml-2 p-2 bg-teal-600 rounded hover:bg-teal-700">
                <FaPaperPlane />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center mt-4">
        <button onClick={toggleEditor} className="bg-gray-800 hover:bg-gray-700 text-sm px-3 py-2 rounded flex items-center gap-2">
          <FaCode /> {editorOpen ? 'Close Editor' : 'Open Editor'}
        </button>

        <div className="flex justify-center gap-4">
          <button onClick={toggleMic} className={`p-3 rounded-full border ${micOn ? 'border-teal-400 text-teal-400' : 'border-red-500 text-red-500'}`}>
            {micOn ? <FaMicrophone /> : <FaMicrophoneSlash />}
          </button>
          <button onClick={toggleCam} className={`p-3 rounded-full border ${camOn ? 'border-teal-400 text-teal-400' : 'border-red-500 text-red-500'}`}>
            {camOn ? <FaVideo /> : <FaVideoSlash />}
          </button>
          <button onClick={toggleScreenShare} className={`p-3 rounded-full border ${screenSharing ? 'border-teal-400 text-teal-400' : 'border-gray-400 text-gray-400'}`}>
            <FaDesktop />
          </button>
          <button onClick={leaveMeeting} className="p-3 rounded-full bg-red-600 hover:bg-red-700">
            <FaPhoneSlash />
          </button>
        </div>

        <button onClick={() => setChatOpen((p) => !p)} className="bg-gray-800 hover:bg-gray-700 text-sm px-3 py-2 rounded flex items-center gap-2">
          <FaComments /> {chatOpen ? 'Close Chat' : 'Open Chat'}
        </button>
      </div>
    </div>
  );
};

export default MeetingRoom;
