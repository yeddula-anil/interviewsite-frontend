'use client';
import React, { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash,
  FaDesktop, FaPhoneSlash, FaComments, FaCode,
  FaPaperPlane, FaUserCircle, FaExpand, FaCompress
} from 'react-icons/fa';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import Editor from '@monaco-editor/react';
import axiosInstance from '@/utils/axiosInstance';
import { useAuth } from '@/context/AuthContext';

const RecruiterRoom = () => {
  const { user } = useAuth();
  const params = useParams();
  const roomId = String(params.meetingId || '');
  const userName = useRef(user?.name || `User-${Math.floor(Math.random() * 10000)}`).current;

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

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const pc = useRef(null);
  const stompClient = useRef(null);
  const connectedRef = useRef(false);
  const offerCreated = useRef(false);
  const pendingCandidates = useRef([]);
  const isOfferer = useRef(false);
  const joinedRef = useRef(false);

  // 🧩 Join room only once
  useEffect(() => {
    if (!roomId || joinedRef.current) return;
    joinedRef.current = true;

    const joinRoom = async () => {
      try {
        const res = await axiosInstance.post(`/rooms/${roomId}/join`, {
          name: userName,
          role: 'RECRUITER',
        });
        console.log('🧩 Joined room:', res.data);
        if (res.data.count > 1) isOfferer.current = true;
        await setupConnection();
      } catch (err) {
        console.error('❌ Room join failed:', err.response?.data || err.message);
      }
    };

    joinRoom();

    return () => {
      axiosInstance.post(`/rooms/${roomId}/leave`, { name: userName }).catch(() => {});
      stompClient.current?.deactivate();
      pc.current?.close();
      localStreamRef.current?.getTracks()?.forEach((t) => t.stop());
    };
  }, [roomId, userName]);

  // ⚙️ Setup WebRTC + STOMP
  const setupConnection = async () => {
    if (pc.current) return; // prevent multiple inits

    // --- WebRTC setup ---
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

    pc.current.onicecandidate = (event) => {
      if (event.candidate) sendSignal('candidate', event.candidate);
    };

    pc.current.ontrack = (event) => {
      console.log('🎥 Remote track received');
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        remoteVideoRef.current.play?.().catch(() => {});
      }
      setRemoteCamOn(true);
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play?.().catch(() => {});
      }
      stream.getTracks().forEach((t) => pc.current.addTrack(t, stream));
    } catch (err) {
      console.error('❌ Media access error:', err);
      alert('Please allow camera and microphone permissions.');
      return;
    }

    // --- STOMP setup ---
    const socket = new SockJS(`${process.env.NEXT_PUBLIC_API_URL}/ws`);
    const client = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 4000,
      debug: (msg) => console.log('🧠 STOMP:', msg),
      onConnect: () => {
        connectedRef.current = true;
        console.log('✅ Connected to WebSocket');

        client.subscribe(`/topic/signal/${roomId}`, (msg) => {
          try {
            const signal = JSON.parse(msg.body);
            console.log('📩 Received signal:', signal.type, 'from', signal.sender);
            handleSignal(signal);
          } catch (e) {
            console.error('❌ Signal parse error:', e);
          }
        });

        sendSignal('join', { name: userName, time: Date.now() });

        if (isOfferer.current && !offerCreated.current) {
          offerCreated.current = true;
          setTimeout(createOffer, 800); // small delay to ensure both peers are ready
        }
      },
      onWebSocketError: (e) => console.error('❌ WebSocket error:', e),
      onStompError: (frame) => console.error('❌ STOMP frame error:', frame.headers['message']),
    });

    stompClient.current = client;
    client.activate();
  };

  // 📨 Send signal safely
  const sendSignal = (type, data) => {
    if (!connectedRef.current || !stompClient.current?.connected) {
      console.warn('⚠️ STOMP not connected yet, skipping signal:', type);
      return;
    }
    stompClient.current.publish({
      destination: `/app/signal/${roomId}`,
      body: JSON.stringify({ sender: userName, type, data }),
    });
  };

  // 📡 Handle signaling messages
  const handleSignal = async (signal) => {
    const data = signal.data;
    switch (signal.type) {
      case 'offer':
        if (offerCreated.current) return;
        console.log('🔵 Received offer — creating answer');
        await handleOffer(data);
        break;

      case 'answer':
        console.log('✅ Received answer');
        await pc.current.setRemoteDescription(new RTCSessionDescription(data));
        await processPendingCandidates();
        break;

      case 'candidate':
        if (pc.current.remoteDescription) {
          await pc.current.addIceCandidate(new RTCIceCandidate(data));
        } else {
          pendingCandidates.current.push(data);
        }
        break;

      case 'chat':
        setChatMessages((prev) => [...prev, { id: Date.now(), sender: signal.sender, text: data }]);
        break;

      default:
        console.warn('⚠️ Unknown signal type:', signal.type);
    }
  };

  // 💡 WebRTC Offer/Answer
  const createOffer = async () => {
    try {
      const offer = await pc.current.createOffer();
      await pc.current.setLocalDescription(offer);
      sendSignal('offer', offer);
    } catch (err) {
      console.error('Offer error:', err);
    }
  };

  const handleOffer = async (offer) => {
    try {
      await pc.current.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.current.createAnswer();
      await pc.current.setLocalDescription(answer);
      sendSignal('answer', answer);
      await processPendingCandidates();
    } catch (err) {
      console.error('Answer error:', err);
    }
  };

  const processPendingCandidates = async () => {
    for (const c of pendingCandidates.current) {
      await pc.current.addIceCandidate(new RTCIceCandidate(c));
    }
    pendingCandidates.current = [];
  };

  // 💬 Chat
  const sendChat = () => {
    const text = chatInput.trim();
    if (!text) return;
    sendSignal('chat', text);
    setChatMessages((p) => [...p, { id: Date.now(), sender: userName, text }]);
    setChatInput('');
  };

  // 🎤 Mic / 🎥 Cam toggle
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

  // 🖥 Screen share
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

  // 📴 Leave meeting
  const leaveMeeting = () => {
    sendSignal('leave', `${userName} left`);
    stompClient.current?.deactivate();
    pc.current?.close();
    localStreamRef.current?.getTracks()?.forEach((t) => t.stop());
    window.location.href = '/';
  };

  // Toggle Editor
  const toggleEditor = () => {
    setEditorOpen((p) => {
      if (p) setEditorMaximized(false);
      return !p;
    });
  };

  // 🎨 UI (unchanged)
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
                onClick={() => setEditorMaximized((prev) => !prev)}
                className="p-1 rounded hover:bg-gray-600"
              >
                {editorMaximized ? <FaCompress /> : <FaExpand />}
              </button>
            </div>
            <div className="flex-1">
              <Editor
                height="100%"
                theme="vs-dark"
                defaultLanguage="javascript"
                defaultValue="// Write your code here..."
                options={{
                  fontSize: 13,
                  minimap: { enabled: false },
                  automaticLayout: true,
                }}
              />
            </div>
          </div>
        )}

        {!editorMaximized && (
          <div className="relative bg-black flex-1 flex flex-col items-center justify-center rounded-lg border border-gray-700">
            {remoteCamOn ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-gray-500">
                <FaUserCircle size={120} />
                <p className="text-lg mt-2">Waiting for others...</p>
              </div>
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
          onClick={() => setChatOpen((prev) => !prev)}
          className="bg-gray-800 hover:bg-gray-700 text-sm px-3 py-2 rounded flex items-center gap-2"
        >
          <FaComments /> {chatOpen ? 'Close Chat' : 'Open Chat'}
        </button>
      </div>
    </div>
  );
};

export default RecruiterRoom;
