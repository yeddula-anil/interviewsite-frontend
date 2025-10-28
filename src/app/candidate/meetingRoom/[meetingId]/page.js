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

// 🧩 Lazy load Monaco Editor (prevents SSR crash & speeds up load)
const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

const MeetingRoom = ({ userName = 'Candidate' }) => {
  const params = useParams();
  const roomId = params.meetingId;

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

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pc = useRef(null);
  const stompClient = useRef(null);
  const codeUpdateTimeout = useRef(null);

  // 🔌 WebSocket & WebRTC setup
  useEffect(() => {
    const socket = new SockJS('https://interviewsite-backend.onrender.com/ws');
    stompClient.current = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      debug: (msg) => console.log('STOMP:', msg),
      onConnect: () => {
        console.log('✅ Connected to WebSocket');
        stompClient.current.subscribe(`/topic/signal/${roomId}`, (msg) => {
          const signal = JSON.parse(msg.body);
          handleSignal(signal);
        });
      },
    });
    stompClient.current.activate();

    // 🎥 Setup WebRTC
    pc.current = new RTCPeerConnection();

    pc.current.onicecandidate = (event) => {
      if (event.candidate) sendSignal('candidate', event.candidate);
    };

    pc.current.ontrack = (event) => {
      remoteVideoRef.current.srcObject = event.streams[0];
      setRemoteCamOn(true);
    };

    // 📸 Initialize local media
    const initLocalStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideoRef.current.srcObject = stream;
        stream.getTracks().forEach(track => pc.current.addTrack(track, stream));
      } catch (err) {
        console.error('❌ Media device access error:', err);
      }
    };
    initLocalStream();

    return () => {
      stompClient.current.deactivate();
      pc.current.close();
    };
  }, [roomId]);

  // 🚀 Send messages to server
  const sendSignal = (type, data) => {
    if (!stompClient.current || !stompClient.current.connected) return;
    const signalMessage = {
      sender: userName,
      type,
      data,
      role: 'candidate',
    };
    stompClient.current.publish({
      destination: `/app/signal/${roomId}`,
      body: JSON.stringify(signalMessage),
    });
  };

  // 📡 Handle incoming signals
  const handleSignal = async (signal) => {
    if (signal.sender === userName) return;
    const data = signal.data;

    switch (signal.type) {
      case 'offer':
        await pc.current.setRemoteDescription(new RTCSessionDescription(data));
        const answer = await pc.current.createAnswer();
        await pc.current.setLocalDescription(answer);
        sendSignal('answer', answer);
        break;

      case 'answer':
        await pc.current.setRemoteDescription(new RTCSessionDescription(data));
        break;

      case 'candidate':
        try {
          await pc.current.addIceCandidate(new RTCIceCandidate(data));
        } catch (e) {
          console.error('ICE Candidate error:', e);
        }
        break;

      case 'chat':
        setChatMessages(prev => [...prev, { id: Date.now(), sender: signal.sender, text: data }]);
        break;

      case 'code':
        setCode(data);
        break;

      default:
        console.warn('Unknown signal type:', signal.type);
        break;
    }
  };

  // 💬 Chat send
  const sendChat = () => {
    if (!chatInput.trim()) return;
    sendSignal('chat', chatInput.trim());
    setChatMessages(prev => [...prev, { id: Date.now(), sender: userName, text: chatInput.trim() }]);
    setChatInput('');
  };

  // 💻 Code synchronization (throttled)
  const handleCodeChange = (newCode) => {
    setCode(newCode);
    clearTimeout(codeUpdateTimeout.current);
    codeUpdateTimeout.current = setTimeout(() => {
      sendSignal('code', newCode);
    }, 400);
  };

  // 🔘 Controls
  const toggleMic = () => setMicOn(p => !p);
  const toggleCam = () => setCamOn(p => !p);
  const toggleScreenShare = () => setScreenSharing(p => !p);
  const leaveMeeting = () => (window.location.href = '/');
  const toggleEditor = () => {
    setEditorOpen(prev => {
      if (prev) setEditorMaximized(false);
      return !prev;
    });
  };

  // ============================
  // 🎨 UI SECTION
  // ============================
  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 flex flex-col">
      <div className="flex-1 flex gap-3 overflow-hidden rounded-lg border border-gray-700 p-2">
        {/* 🧠 Monaco Code Editor */}
        {editorOpen && (
          <div
            className={`${
              editorMaximized ? 'w-full' : 'w-1/3'
            } bg-gray-800 border border-gray-700 flex flex-col transition-all duration-300`}
          >
            <div className="p-2 bg-gray-700 flex items-center justify-between text-sm font-medium">
              <span>Code Editor</span>
              <button
                onClick={() => setEditorMaximized(prev => !prev)}
                className="p-1 rounded hover:bg-gray-600"
              >
                {editorMaximized ? <FaCompress /> : <FaExpand />}
              </button>
            </div>
            <Editor
              height="100%"
              theme="vs-dark"
              language="javascript"
              value={code}
              onChange={handleCodeChange}
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                automaticLayout: true,
              }}
            />
          </div>
        )}

        {/* 🎥 Video Section */}
        {!editorMaximized && (
          <div className="relative bg-black flex-1 flex flex-col items-center justify-center rounded-lg border border-gray-700">
            {remoteCamOn ? (
              <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover rounded-lg" />
            ) : (
              <div className="flex flex-col items-center justify-center text-gray-500">
                <FaUserCircle size={120} />
                <p className="text-lg mt-2">Waiting for others...</p>
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

        {/* 💬 Chat Section */}
        {!editorMaximized && chatOpen && (
          <div className="w-1/4 bg-gray-800 border border-gray-700 flex flex-col rounded-lg">
            <div className="p-2 bg-gray-700 font-medium text-sm text-center">Chat</div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {chatMessages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === userName ? 'justify-end' : 'justify-start'}`}
                >
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
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChat()}
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

      {/* 🎛️ Controls */}
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
          <button onClick={leaveMeeting} className="p-3 rounded-full bg-red-600 hover:bg-red-700">
            <FaPhoneSlash />
          </button>
        </div>

        <button
          onClick={() => setChatOpen(prev => !prev)}
          className="bg-gray-800 hover:bg-gray-700 text-sm px-3 py-2 rounded flex items-center gap-2"
        >
          <FaComments /> {chatOpen ? 'Close Chat' : 'Open Chat'}
        </button>
      </div>
    </div>
  );
};

export default MeetingRoom;
