'use client';
import React, { useEffect, useRef, useState, lazy, Suspense, useCallback } from 'react'; // [!FIX] Added useCallback
import {
  FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash,
  FaDesktop, FaPhoneSlash, FaComments, FaCode,
  FaUserCircle, FaExpand, FaCompress, FaPaperPlane
} from 'react-icons/fa';
import { useParams } from 'next/navigation';
import axiosInstance from '@/utils/axiosInstance';
import { useSignaling } from '@/hooks/useSignaling';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useAuth } from '@/context/AuthProvider';

const Editor = lazy(() => import('@monaco-editor/react'));

const MeetingRoom = () => {
  const params = useParams();
  const roomId = String(params.meetingId || '');
  const { user } = useAuth();

  const username = user?.username || `user-${Math.floor(Math.random() * 1000)}`;
  const role = user?.role?.toLowerCase() || 'participant';

  const [isOfferer, setIsOfferer] = useState(false);
  const [ready, setReady] = useState(false);
  const [remoteCamOn, setRemoteCamOn] = useState(false);
  const [editorOpen, setEditorOpen] = useState(true);
  const [editorMaximized, setEditorMaximized] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [chatMessages, setChatMessages] = useState([{ id: 1, sender: 'System', text: 'Welcome!' }]);
  const [chatInput, setChatInput] = useState('');
  const [code, setCode] = useState('// Start coding here...\n');
  const [screenSharing, setScreenSharing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);

  // [!FIX] This ref will break the dependency cycle.
  // We give a stable function to useSignaling that *calls* this ref.
  const webRTCHandlerRef = useRef(null);

  // --- Step 1: Join Room (Unchanged) ---
  useEffect(() => {
    if (!roomId) return;
    (async () => {
      try {
        const res = await axiosInstance.post(`/rooms/${roomId}/join`, {
          name: username,
          role,
        });
        const isOffer = res.data?.isOfferer || false;
        setIsOfferer(isOffer);
        setReady(true);
        console.log(`🧩 Joined room as ${isOffer ? 'offerer' : 'answerer'}`);
      } catch (err) {
        console.error('❌ Join room failed:', err);
      }
    })();

    return () => {
      axiosInstance.post(`/rooms/${roomId}/leave`, { name: username }).catch(() => { });
    };
  }, [roomId, username, role]);


  // --- [!FIX] Step 2: Define the MASTER message handler FIRST ---
  // This one function handles ALL incoming WebSocket messages.
  const handleSignalingMessage = useCallback((msg) => {
    console.log('📩 Received message:', msg.type);
    switch (msg.type) {
      case 'chat':
        setChatMessages((prev) => [...prev, { id: Date.now(), sender: msg.sender, text: msg.data }]);
        break;
      case 'code':
        setCode(msg.data);
        break;
      // All other types are assumed to be WebRTC
      case 'offer':
      case 'answer':
      case 'candidate':
        webRTCHandlerRef.current?.(msg); // Pass to WebRTC hook
        break;
      default:
        console.warn(`Unknown message type: ${msg.type}`);
    }
  }, []); // Empty deps = stable function

  // --- [!FIX] Step 3: Signaling setup ---
  // Pass the REAL handler to the hook *at initialization*.
  const signaling = useSignaling({
    roomId,
    userName: username,
    onMessage: handleSignalingMessage, // [!FIX] Was null
  });

  // --- [!FIX] Step 4: WebRTC setup ---
  const {
    localVideoRef: webRTCLocalVideo,
    remoteVideoRef: webRTCRemoteVideo,
    micOn, camOn,
    toggleMic, toggleCam, toggleScreenShare,
    handleSignal, // This is the function we need
    start,
  } = useWebRTC({
    isOfferer,
    signaling, // Pass the whole object (hook just needs .send)
    onRemoteStream: (remoteStream) => {
      // [!FIX] Simplified. useWebRTC hook already handles setting the video ref.
      console.log('🎥 Remote stream attached!');
      setRemoteCamOn(true);
      setIsConnecting(false);
    },
    // [!FIX] Added connection state handler for robustness
    onConnectionChange: (state) => {
      console.log('🔗 WebRTC Connection State:', state);
      if (state === 'connected' || state === 'completed') {
        setIsConnecting(false);
      }
      if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        setIsConnecting(false);
        setRemoteCamOn(false); // Remote user disconnected
      }
    }
  });

  // --- [!FIX] Step 5: Link WebRTC handler ---
  // Now that we HAVE handleSignal, put it in the ref.
  useEffect(() => {
    webRTCHandlerRef.current = handleSignal;
  }, [handleSignal]);


  // --- [!FIX] Step 6: Start WebRTC ---
  // Simplified: The `start` function from useWebRTC is smart
  // and will wait for media/PC itself. No need for setTimeout.
  useEffect(() => {
    // We must wait for:
    // 1. `ready` (API call to /join finished)
    // 2. `signaling.connected` (WebSocket is open)
    if (ready && signaling.connected) {
      console.log('🚀 Signaling connected, telling WebRTC to start (if offerer)...');
      start(); // `start` from `useWebRTC` will only run if `isOfferer` is true
    }
  }, [ready, signaling.connected, start]);


  // --- [!FIX] Step 7: DELETE redundant local stream attachment ---
  // The `useWebRTC` hook already attaches the local stream to
  // its own `localVideoRef` (which we alias to `webRTCLocalVideo`).
  // This step was unnecessary.


  // --- Step 8: Chat & Code (Unchanged logic, just re-numbered) ---
  const sendChat = () => {
    const text = chatInput.trim();
    if (!text) return;
    signaling.send('chat', text);
    // Add locally because useSignaling ignores our own messages
    setChatMessages((prev) => [...prev, { id: Date.now(), sender: username, text }]);
    setChatInput('');
  };

  const handleCodeChange = (newCode) => {
    setCode(newCode);
    signaling.send('code', newCode);
  };

  // --- Step 9: Leave meeting (Unchanged logic, just re-numbered) ---
  const leaveMeeting = () => {
    signaling.send('leave', `${username} left`);
    signaling.disconnect?.();
    window.location.href = '/';
  };

  // --- UI (Unchanged) ---
  // [!FIX] Your video refs (`webRTCRemoteVideo`, `webRTCLocalVideo`)
  // were already correct in the JSX. No changes needed here.
  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 flex flex-col">
      <div className="flex-1 flex gap-3 overflow-hidden rounded-lg border border-gray-700 p-2">
        {/* Code Editor */}
        {editorOpen && (
          <div
            className={`${editorMaximized ? 'w-full' : 'w-1/3'
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
            <Suspense fallback={<div className="p-4 text-gray-400">Loading Editor...</div>}>
              <Editor
                height="100%"
                theme="vs-dark"
                value={code}
                onChange={handleCodeChange}
                options={{ fontSize: 14, minimap: { enabled: false } }}
              />
            </Suspense>
          </div>
        )}


        {/* Video Section */}
        {!editorMaximized && (
          <div className="relative bg-black flex-1 flex flex-col items-center justify-center rounded-lg border border-gray-700">
            {isConnecting && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60 text-gray-300 text-lg">
                Connecting...
              </div>
            )}

            {remoteCamOn && !isConnecting ? (
              <video
                ref={webRTCRemoteVideo} // This was correct
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
                  ref={webRTCLocalVideo} // This was correct
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


        {/* Chat Section */}
        {!editorMaximized && chatOpen && (
          <div className="w-1/4 bg-gray-800 border border-gray-700 flex flex-col rounded-lg">
            <div className="p-2 bg-gray-700 font-medium text-sm text-center">Chat</div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === username ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`p-2 rounded-lg max-w-[75%] ${msg.sender === username
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

      {/* Bottom Controls */}
      <div className="flex justify-between items-center mt-4">
        <button
          onClick={() => setEditorOpen((p) => !p)}
          className="bg-gray-800 hover:bg-gray-700 text-sm px-3 py-2 rounded flex items-center gap-2"
        >
          <FaCode /> {editorOpen ? 'Close Editor' : 'Open Editor'}
        </button>

        <div className="flex justify-center gap-4">
          <button
            onClick={toggleMic}
            className={`p-3 rounded-full border ${micOn ? 'border-teal-400 text-teal-400' : 'border-red-500 text-red-500'
              }`}
          >
            {micOn ? <FaMicrophone /> : <FaMicrophoneSlash />}
          </button>
          <button
            onClick={toggleCam}
            className={`p-3 rounded-full border ${camOn ? 'border-teal-400 text-teal-400' : 'border-red-500 text-red-500'
              }`}
          >
            {camOn ? <FaVideo /> : <FaVideoSlash />}
          </button>
          <button
            onClick={toggleScreenShare}
            className={`p-3 rounded-full border ${screenSharing ? 'border-teal-400 text-teal-400' : 'border-gray-400 text-gray-400'
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

export default MeetingRoom;