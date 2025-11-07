'use client';
import React, { useEffect, useState, lazy, Suspense } from 'react';
import {
  FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash,
  FaDesktop, FaPhoneSlash, FaComments, FaCode,
  FaExpand, FaCompress, FaPaperPlane
} from 'react-icons/fa';
import { useParams, useRouter } from 'next/navigation';
import {
  StreamVideo,
  StreamVideoClient,
  StreamCall,
  useCallStateHooks,
  ParticipantView,
} from '@stream-io/video-react-sdk';
import { useAuth } from '@/context/AuthProvider';

const Editor = lazy(() => import('@monaco-editor/react'));

const CallUI = ({ call, username }) => {
  const {
    useParticipants,
    useLocalParticipant,
    useCameraState,
    useMicrophoneState,
    useScreenShareState,
  } = useCallStateHooks();

  const participants = useParticipants();
  const localParticipant = useLocalParticipant();
  const { camera, toggleCamera } = useCameraState();
  const { microphone, toggleMicrophone } = useMicrophoneState();
  const { screenShare, toggleScreenShare } = useScreenShareState();

  const [chatMessages, setChatMessages] = useState([{ id: 1, sender: 'System', text: 'Welcome!' }]);
  const [chatInput, setChatInput] = useState('');
  const [code, setCode] = useState('// Start coding here...\n');
  const [editorOpen, setEditorOpen] = useState(true);
  const [editorMaximized, setEditorMaximized] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);

  const sendChat = () => {
    const text = chatInput.trim();
    if (!text) return;
    setChatMessages((prev) => [...prev, { id: Date.now(), sender: username, text }]);
    setChatInput('');
  };

  // 🚪 Leave and cleanup
  const leaveMeeting = async () => {
    try {
      await call.leave();
      await call.client.disconnectUser();
    } catch (err) {
      console.error('Leave error:', err);
    }
    sessionStorage.removeItem('prejoin');
    window.location.href = '/';
  };

  // 👥 Determine remote participant
  const remoteParticipant = participants.find((p) => !p.isLocalParticipant) || null;

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 flex flex-col">
      <div className="flex-1 flex gap-3 overflow-hidden rounded-lg border border-gray-700 p-2">

        {/* === Code Editor === */}
        {editorOpen && (
          <div className={`${editorMaximized ? 'w-full' : 'w-1/3'} bg-gray-800 border border-gray-700 flex flex-col transition-all duration-300`}>
            <div className="p-2 bg-gray-700 flex items-center justify-between text-sm font-medium">
              <span>Code Editor</span>
              <button onClick={() => setEditorMaximized((p) => !p)} className="p-1 rounded hover:bg-gray-600">
                {editorMaximized ? <FaCompress /> : <FaExpand />}
              </button>
            </div>
            <Suspense fallback={<div className="p-4 text-gray-400">Loading Editor...</div>}>
              <Editor
                height="100%"
                theme="vs-dark"
                value={code}
                onChange={(newCode) => setCode(newCode ?? code)}
                options={{ fontSize: 14, minimap: { enabled: false } }}
              />
            </Suspense>
          </div>
        )}

        {/* === Video Section === */}
        {!editorMaximized && (
          <div className="relative bg-black flex-1 flex flex-col items-center justify-center rounded-lg border border-gray-700">
            {/* Waiting text */}
            {!remoteParticipant && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60 text-gray-300 text-lg">
                Waiting for the other participant to join...
              </div>
            )}
            {/* remote video ui  */}
            <div className="w-full h-full rounded-lg">
              {remoteParticipant ? (
                <ParticipantView participant={remoteParticipant} />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400 text-lg">
                  Waiting for another participant to join...
                </div>
              )}
            </div>


            {/* Local PIP */}
            <div className="absolute right-4 bottom-4 w-40 h-28 rounded overflow-hidden border border-gray-700 bg-gray-900">
              {localParticipant && <ParticipantView participant={localParticipant} />}
            </div>
          </div>
        )}

        {/* === Chat Section === */}
        {!editorMaximized && chatOpen && (
          <div className="w-1/4 bg-gray-800 border border-gray-700 flex flex-col rounded-lg">
            <div className="p-2 bg-gray-700 font-medium text-sm text-center">Chat</div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender === username ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`p-2 rounded-lg max-w-[75%] ${
                      msg.sender === username
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

      {/* === Bottom Controls === */}
      <div className="flex justify-between items-center mt-4">
        <button
          onClick={() => setEditorOpen((p) => !p)}
          className="bg-gray-800 hover:bg-gray-700 text-sm px-3 py-2 rounded flex items-center gap-2"
        >
          <FaCode /> {editorOpen ? 'Close Editor' : 'Open Editor'}
        </button>

        <div className="flex justify-center gap-4">
          <button
            onClick={toggleMicrophone}
            className={`p-3 rounded-full border ${
              microphone.isEnabled ? 'border-teal-400 text-teal-400' : 'border-red-500 text-red-500'
            }`}
          >
            {microphone.isEnabled ? <FaMicrophone /> : <FaMicrophoneSlash />}
          </button>
          <button
            onClick={toggleCamera}
            className={`p-3 rounded-full border ${
              camera.isEnabled ? 'border-teal-400 text-teal-400' : 'border-red-500 text-red-500'
            }`}
          >
            {camera.isEnabled ? <FaVideo /> : <FaVideoSlash />}
          </button>
          <button
            onClick={toggleScreenShare}
            className={`p-3 rounded-full border ${
              screenShare.isEnabled ? 'border-teal-400 text-teal-400' : 'border-gray-400 text-gray-400'
            }`}
          >
            <FaDesktop />
          </button>
          <button onClick={leaveMeeting} className="p-3 rounded-full bg-red-600 hover:bg-red-700">
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

const MeetingRoom = () => {
  const { meetingId } = useParams();
  const router = useRouter();
  const { user, loading } = useAuth();

  const authName = user?.username || user?.name || 'Guest';
  const rolePrefix = user?.role === 'recruiter' ? 'recruiter' : 'candidate';
  const username = `${rolePrefix}-${authName}`;

  const [client, setClient] = useState(null);
  const [call, setCall] = useState(null);
  const [isConnecting, setIsConnecting] = useState(true);

  useEffect(() => {
    if (loading || !meetingId) return;
    let mounted = true;

    (async () => {
      try {
        const res = await fetch('/api/stream/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: username }),
        });
        const { token } = await res.json();

        const clientInstance = StreamVideoClient.getOrCreateInstance({
          apiKey: process.env.NEXT_PUBLIC_STREAM_API_KEY,
          user: { id: username, name: authName },
          token,
        });

        const callInstance = clientInstance.call('default', String(meetingId));

        // 🧠 Safe join logic
        try {
          await callInstance.join();
        } catch {
          await callInstance.join({ create: true });
        }

        // ✅ Limit to two participants
        const members = await callInstance.queryMembers({});
        if (members.members.length > 2) {
          alert('This interview room is full.');
          await callInstance.leave();
          await clientInstance.disconnectUser();
          router.push('/');
          return;
        }

        if (!mounted) return;

        setClient(clientInstance);
        setCall(callInstance);
        setIsConnecting(false);
      } catch (err) {
        console.error('❌ Stream init error:', err);
        setIsConnecting(false);
      }
    })();

    // ✅ Cleanup on unmount or navigation
    const cleanup = async () => {
      if (call) await call.leave();
      if (client) await client.disconnectUser();
    };

    window.addEventListener('beforeunload', cleanup);
    router.events?.on('routeChangeStart', cleanup);

    return () => {
      mounted = false;
      cleanup();
      window.removeEventListener('beforeunload', cleanup);
      router.events?.off('routeChangeStart', cleanup);
    };
  }, [meetingId, username, loading]);

  if (loading || isConnecting) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-400 text-lg">
        Connecting to meeting...
      </div>
    );
  }

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <CallUI call={call} username={username} />
      </StreamCall>
    </StreamVideo>
  );
};

export default MeetingRoom;
