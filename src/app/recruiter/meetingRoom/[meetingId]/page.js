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

const RecruiterRoom = ({ userName = 'Recruiter' }) => {
  const params = useParams();
  const roomId = String(params.meetingId || '');

  // UI states
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [editorOpen, setEditorOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);
  const [remoteCamOn, setRemoteCamOn] = useState(false);
  const [editorMaximized, setEditorMaximized] = useState(false);

  // Chat states
  const [chatMessages, setChatMessages] = useState([
    { id: 1, sender: 'System', text: 'Welcome to the meeting!' },
  ]);
  const [chatInput, setChatInput] = useState('');

  // Video & WebRTC refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const pc = useRef(null);
  const stompClient = useRef(null);
  const startedRef = useRef(false); // prevent multiple offers

  // 🧩 Initialize WebSocket + WebRTC
  useEffect(() => {
    if (!roomId) return;

    const socket = new SockJS(`${process.env.NEXT_PUBLIC_API_URL}/ws`);
    const client = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      debug: (msg) => console.log('STOMP:', msg),
      onConnect: () => {
        console.log('✅ Connected to WebSocket');

        // Subscribe to signaling topic
        client.subscribe(`/topic/signal/${roomId}`, (msg) => {
          const signal = JSON.parse(msg.body);
          console.log('📩 Received signal:', signal.type, 'from', signal.sender);
          handleSignal(signal);
        });

        // Recruiter announces presence
        sendSignal('join', `${userName} joined the meeting`);
      },
    });

    stompClient.current = client;
    client.activate();

    // Setup WebRTC
    pc.current = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        {
          urls: 'turn:relay1.expressturn.com:3478',
          username: 'efree',
          credential: 'efree',
        },
      ],
      iceCandidatePoolSize: 8,
    });

    pc.current.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('🧊 Local ICE candidate → sending');
        sendSignal('candidate', event.candidate);
      }
    };

    pc.current.onconnectionstatechange = () => {
      console.log('🔗 PC state:', pc.current.connectionState);
    };

    pc.current.ontrack = (event) => {
      console.log('🎥 Remote track received');
      if (remoteVideoRef.current && !remoteVideoRef.current.srcObject) {
        remoteVideoRef.current.srcObject = event.streams[0];
        const play = remoteVideoRef.current.play?.();
        if (play && typeof play.then === 'function') play.catch(() => {});
      }
      setRemoteCamOn(true);
    };

    return () => {
      try {
        client.deactivate();
        pc.current.close();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // 🧠 Initialize local stream and create offer
  const initLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      localVideoRef.current.srcObject = stream;
      const play = localVideoRef.current.play?.();
      if (play && typeof play.then === 'function') play.catch(() => {});
      stream.getTracks().forEach((track) => pc.current.addTrack(track, stream));

      const offer = await pc.current.createOffer();
      await pc.current.setLocalDescription(offer);
      sendSignal('offer', offer);
      console.log('📤 Offer sent');
    } catch (err) {
      console.error('Error accessing media devices:', err);
    }
  };

  // 📨 Send signaling messages
  const sendSignal = (type, data) => {
    if (!stompClient.current || !stompClient.current.connected) return;
    const signalMessage = {
      sender: userName,
      type,
      data,
      role: 'recruiter',
    };
    stompClient.current.publish({
      destination: `/app/signal/${roomId}`,
      body: JSON.stringify(signalMessage),
    });
    console.log('📤 Sent signal:', type);
  };

  // 🧩 Handle incoming WebRTC & chat signals
  const handleSignal = async (signal) => {
    if (signal.sender === userName) return; // ignore own messages
    const data = signal.data;

    switch (signal.type) {
      case 'join':
        if (signal.role === 'candidate' && !startedRef.current) {
          console.log('🎥 Candidate joined — creating offer...');
          startedRef.current = true;
          await initLocalStream();
        }
        break;

      case 'answer':
        try {
          await pc.current.setRemoteDescription(new RTCSessionDescription(data));
          console.log('✅ Answer received and set');
        } catch (e) {
          console.error('Failed to set remote answer:', e);
        }
        break;

      case 'candidate':
        try {
          await pc.current.addIceCandidate(new RTCIceCandidate(data));
          console.log('✅ Added ICE candidate');
        } catch (e) {
          console.error('ICE Candidate error:', e);
        }
        break;

      case 'chat': {
        const messageText =
          typeof signal.data === 'string'
            ? signal.data
            : signal.data?.text || JSON.stringify(signal.data);
        console.log(`💬 Chat received from ${signal.sender}:`, messageText);
        setChatMessages((prev) => [
          ...prev,
          { id: Date.now(), sender: signal.sender, text: messageText },
        ]);
        break;
      }

      default:
        console.warn('Unknown signal type:', signal.type);
    }
  };

  // 💬 Chat send
  const sendChat = () => {
    const text = chatInput.trim();
    if (!text) return;
    sendSignal('chat', text);
    setChatMessages((prev) => [...prev, { id: Date.now(), sender: userName, text }]);
    setChatInput('');
  };

  // 🎤 Mic toggle
  const toggleMic = () => {
    const stream = localVideoRef.current?.srcObject;
    if (stream) stream.getAudioTracks().forEach((t) => (t.enabled = !micOn));
    setMicOn((p) => !p);
  };

  // 🎥 Camera toggle
  const toggleCam = () => {
    const stream = localVideoRef.current?.srcObject;
    if (stream) stream.getVideoTracks().forEach((t) => (t.enabled = !camOn));
    setCamOn((p) => !p);
  };

  // 🖥️ Screen share toggle
  const toggleScreenShare = async () => {
    if (!screenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        const sender = pc.current.getSenders().find((s) => s.track && s.track.kind === 'video');
        if (sender) {
          sender.replaceTrack(screenTrack);
          screenTrack.onended = () => toggleScreenShare();
          setScreenSharing(true);
        }
      } catch (err) {
        console.error('Screen share error:', err);
      }
    } else {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const videoTrack = stream.getVideoTracks()[0];
      const sender = pc.current.getSenders().find((s) => s.track && s.track.kind === 'video');
      if (sender) {
        sender.replaceTrack(videoTrack);
        setScreenSharing(false);
      }
    }
  };

  // 🚪 Leave meeting
  const leaveMeeting = () => {
    sendSignal('leave', `${userName} left the meeting`);
    try {
      stompClient.current?.deactivate();
      pc.current?.close();
    } catch {}
    window.location.href = '/';
  };

  const toggleEditor = () => {
    setEditorOpen((prev) => {
      if (prev) setEditorMaximized(false);
      return !prev;
    });
  };

  // 🖼️ UI (unchanged)
  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 flex flex-col">
      <div className="flex-1 flex gap-3 overflow-hidden rounded-lg border border-gray-700 p-2">
        {/* Code Editor */}
        {editorOpen && (
          <div className={`${editorMaximized ? 'w-full' : 'w-1/4'} bg-gray-800 border border-gray-700 flex flex-col transition-all duration-300`}>
            <div className="p-2 bg-gray-700 flex items-center justify-between text-sm font-medium">
              <span>Code Editor</span>
              <button onClick={() => setEditorMaximized((prev) => !prev)} className="p-1 rounded hover:bg-gray-600">
                {editorMaximized ? <FaCompress /> : <FaExpand />}
              </button>
            </div>
            <textarea placeholder="// Write your code here..." className="flex-1 bg-gray-900 text-white p-3 text-sm outline-none resize-none" />
          </div>
        )}

        {/* Video Section */}
        {!editorMaximized && (
          <div className="relative bg-black flex-1 flex flex-col items-center justify-center rounded-lg border border-gray-700">
            {remoteCamOn ? (
              <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover rounded-lg" />
            ) : (
              <div className="flex flex-col items-center justify-center text-gray-500">
                <FaUserCircle size={120} />
                <p className="text-lg mt-2">Waiting for candidate...</p>
              </div>
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

        {/* Chat Section */}
        {!editorMaximized && chatOpen && (
          <div className="w-1/4 bg-gray-800 border border-gray-700 flex flex-col rounded-lg">
            <div className="p-2 bg-gray-700 font-medium text-sm text-center">Chat</div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`p-2 rounded ${msg.sender === userName ? 'bg-teal-800/30 ml-auto' : 'bg-gray-700/50'}`}>
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
              <button onClick={sendChat} className="ml-2 p-2 bg-teal-600 rounded hover:bg-teal-700"><FaPaperPlane /></button>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex justify-between items-center mt-4">
        <button onClick={toggleEditor} className="bg-gray-800 hover:bg-gray-700 text-sm px-3 py-2 rounded flex items-center gap-2">
          <FaCode /> {editorOpen ? 'Close Editor' : 'Open Editor'}
        </button>

        <div className="flex justify-center gap-4">
          <button onClick={toggleMic} className={`p-3 rounded-full border ${micOn ? 'border-teal-400 text-teal-400' : 'border-red-500 text-red-500'}`} title={micOn ? 'Mute' : 'Unmute'}>
            {micOn ? <FaMicrophone /> : <FaMicrophoneSlash />}
          </button>

          <button onClick={toggleCam} className={`p-3 rounded-full border ${camOn ? 'border-teal-400 text-teal-400' : 'border-red-500 text-red-500'}`} title={camOn ? 'Turn camera off' : 'Turn camera on'}>
            {camOn ? <FaVideo /> : <FaVideoSlash />}
          </button>

          <button onClick={toggleScreenShare} className={`p-3 rounded-full border ${screenSharing ? 'border-teal-400 text-teal-400' : 'border-gray-400 text-gray-400'}`} title="Toggle screen share">
            <FaDesktop />
          </button>

          <button onClick={leaveMeeting} className="p-3 rounded-full bg-red-600 hover:bg-red-700" title="Leave Meeting">
            <FaPhoneSlash />
          </button>
        </div>

        <button onClick={() => setChatOpen((prev) => !prev)} className="bg-gray-800 hover:bg-gray-700 text-sm px-3 py-2 rounded flex items-center gap-2">
          <FaComments /> {chatOpen ? 'Close Chat' : 'Open Chat'}
        </button>
      </div>
    </div>
  );
};

export default RecruiterRoom;
