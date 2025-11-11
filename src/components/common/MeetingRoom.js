'use client';
import React, { useEffect, useState, lazy, Suspense, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
  FaPaperPlane, FaCircle, FaStop
} from 'react-icons/fa';
import { useWebRTCDataChannel } from '@/utils/WebRTCDataChannel';
import { useAuth } from '@/context/AuthProvider';
const Editor = lazy(() => import('@monaco-editor/react'));

export default function MeetingRoom() {
  const { meetingId } = useParams();
  const router = useRouter();
  const [client, setClient] = useState(null);
  const [call, setCall] = useState(null);
  const [status, setStatus] = useState('🔄 Initializing...');
  const [error, setError] = useState(null);
  const {user}=useAuth()

  useEffect(() => {
  if (!meetingId || !user) {
    setStatus(!user ? '⏳ Waiting for user...' : '⚠️ No meeting ID found.');
    return;
  }

  const username = user.username;
  const userId = user.id; // Ensure this is defined
  let streamClient, callInstance;

  const init = async () => {
    try {
      setStatus('📡 Fetching Stream token...');
      // ✅ Make sure we send the same ID used in connectUser
      const res = await axios.get(`/api/stream/token?user_id=${encodeURIComponent(userId)}`);
      const token = res.data?.token;
      if (!token) throw new Error('No token returned from backend');

      const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
      if (!apiKey) throw new Error('Missing Stream API Key');
      streamClient = new StreamVideoClient({ apiKey, options: { disable_location_hint: true } });

      setStatus('👤 Connecting user...');
      // ✅ ID here must match token user_id
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
      setError(err.message);
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
        <CallUI call={call} meetingId={meetingId} username="User" />
      </StreamCall>
    </StreamVideo>
  );
}

const CallUI = ({ call, meetingId, username }) => {
  const {
    useParticipants,
    useLocalParticipant,
    useCameraState,
    useMicrophoneState
  } = useCallStateHooks();

  const participants = useParticipants();
  const local = useLocalParticipant();
  const camState = useCameraState();
  const micState = useMicrophoneState();

  const [editorOpen, setEditorOpen] = useState(true);
  const [editorMax, setEditorMax] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [recording, setRecording] = useState(false);
  const [recordTime, setRecordTime] = useState(0);
  const [recordingBadge, setRecordingBadge] = useState(false); // 🆕

  const { connected, messages, code, setCode, sendChat, sendCode } = useWebRTCDataChannel(meetingId, username);
  const remote = participants.find(p => !p.isLocalParticipant);
  const chatRef = useRef();

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  // Recording Timer
  useEffect(() => {
    let timer;
    if (recording) timer = setInterval(() => setRecordTime(t => t + 1), 1000);
    else setRecordTime(0);
    return () => clearInterval(timer);
  }, [recording]);

  // Stop recording when user leaves or call disconnects 🆕
  useEffect(() => {
    const handleDisconnect = async () => {
      if (recording) {
        await call.stopRecording();
        setRecording(false);
        setRecordingBadge(false);
      }
    };
    call.on('connection.disconnected', handleDisconnect);
    return () => call.off('connection.disconnected', handleDisconnect);
  }, [recording, call]);

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

 const leave = async () => {
  try {
    if (recording) await call.stopRecording(); // Stop Stream recording safely

    // Leave the call
    await call.leave();

    // Disconnect the Stream client (if available)
    const client = call?.streamClient || call?.client; // ✅ fallback check
    if (client?.disconnectUser) {
      await client.disconnectUser();
    }

    // Navigate away
    window.location.href = '/';
  } catch (err) {
    console.error('⚠️ Error during leave():', err);
    window.location.href = `/${user?.role.toLowerCase()}/schedule`;
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

  // 🆕 Recording logic
  // 🆕 Recording logic
  const toggleRec = async () => {
    if (recording) {
      await call.stopRecording();
      setRecording(false);
      setRecordingBadge(false);
    } else {
      if (participants.length < 2) {
        alert('Recording can start only when both participants are in the meeting!');
        return;
      }

      await call.startRecording();
      setRecording(true);
      setRecordingBadge(true);
    }
  };


  const sendChatMessage = () => {
    if (!chatInput.trim()) return;
    sendChat(chatInput);
    setChatInput('');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col overflow-hidden">
      {/* Top layout */}
      <div className="flex-1 flex gap-3 overflow-hidden p-2">
        {/* Editor */}
        {editorOpen && (
          <div className={`${editorMax ? 'fixed inset-0 z-50 w-full h-full' : 'w-1/3'}
            bg-gray-800 border border-gray-700 flex flex-col`}>
            <div className="p-2 bg-gray-700 flex justify-between items-center">
              <span>Code Editor {connected ? '🟢' : '🔴'}</span>
              <div className="flex gap-2">
                <button onClick={() => setEditorMax(!editorMax)}>{editorMax ? <FaCompress /> : <FaExpand />}</button>
                <button onClick={() => setEditorOpen(false)}>Close</button>
              </div>
            </div>
            <Suspense fallback={<div className="p-4 text-gray-400">Loading Editor...</div>}>
              <Editor
                height="100%"
                theme="vs-dark"
                value={code}
                onChange={(v) => {
                  setCode(v);
                  sendCode(v);
                }}
                options={{ fontSize: 14, minimap: { enabled: false } }}
              />
            </Suspense>
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

            {/* 🆕 Recording Badge */}
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
              <span>Chat {connected ? '🟢' : '🔴'}</span>
              <button onClick={() => setChatOpen(false)}>Close</button>
            </div>
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
          {/* 🆕 Removed screen share */}
          <button onClick={toggleRec} className={`p-3 rounded-full border ${recording ? 'border-red-500' : 'border-gray-400'}`}>
            {recording ? <FaStop /> : <FaCircle />}
          </button>
          <button onClick={leave} className="p-3 bg-red-600 rounded-full"><FaPhoneSlash /></button>
        </div>

        <button onClick={() => setChatOpen(!chatOpen)} className="bg-gray-800 px-3 py-2 rounded flex gap-2 items-center">
          <FaComments /> {chatOpen ? 'Close Chat' : 'Open Chat'}
        </button>
      </div>
    </div>
  );
};
