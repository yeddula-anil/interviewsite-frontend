'use client';
import React, { useEffect, useState, lazy, Suspense, useRef } from 'react';
import {
  FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash,
  FaDesktop, FaPhoneSlash, FaComments, FaCode,
  FaExpand, FaCompress, FaPaperPlane, FaRegCircle
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

/**
 * CallUI
 * - remote video fills container (object-cover)
 * - local PIP at bottom-right
 * - name overlays bottom-left
 * - controls wired to hooks (mic/cam/screenShare)
 */
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
  const camState = useCameraState();
  const micState = useMicrophoneState();
  const screenShareState = useScreenShareState();

  // safety: in rare cases hooks may be called outside a call context
  if (!camState || !micState || !screenShareState) {
    return <div className="min-h-screen flex items-center justify-center">Call context not ready.</div>;
  }

  const { camera, toggleCamera } = camState;
  const { microphone, toggleMicrophone } = micState;
  const { screenShare, toggleScreenShare } = screenShareState;

  const [chatMessages, setChatMessages] = useState([{ id: 1, sender: 'System', text: 'Welcome!' }]);
  const [chatInput, setChatInput] = useState('');
  const [code, setCode] = useState('// Start coding here...\n');
  const [editorOpen, setEditorOpen] = useState(true);
  const [editorMaximized, setEditorMaximized] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [recordingSupported] = useState(false); // placeholder — server/cloud needed

  const sendChat = () => {
    const text = chatInput.trim();
    if (!text) return;
    setChatMessages((prev) => [...prev, { id: Date.now(), sender: username, text }]);
    setChatInput('');
  };

  // remote participant (first non-local)
  const remoteParticipant = participants.find((p) => !p.isLocalParticipant) || null;

  // leave / cleanup
  const leaveMeeting = async () => {
    try {
      await call?.leave();
      await call?.client?.disconnectUser();
    } catch (err) {
      console.error('Leave error:', err);
    }
    sessionStorage.removeItem('prejoin');
    // keep client behaviour consistent with your app — go home
    window.location.href = '/';
  };

  // Styling notes:
  // - We expect ParticipantView to take container sizing; add className props;
  //   if SDK doesn't forward className to inner video, that'll still render
  //   but you may need to patch SDK usage; this is the usual approach.
  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 flex flex-col">
      <div className="flex-1 flex gap-3 overflow-hidden rounded-lg border border-gray-700 p-2">
        {/* LEFT: Editor */}
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

        {/* CENTER: Video area */}
        {!editorMaximized && (
          <div className="relative bg-black flex-1 flex flex-col items-center justify-center rounded-lg border border-gray-700 overflow-hidden">
            {/* Waiting overlay */}
            {!remoteParticipant && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60 text-gray-300 text-lg z-10">
                Waiting for the other participant to join...
              </div>
            )}

            {/* remote video should cover the whole area */}
            <div className="w-full h-full relative">
              {remoteParticipant ? (
                // try to force the participant view to fill and use object-fit: cover
                <div className="w-full h-full overflow-hidden">
                  <ParticipantView
                    participant={remoteParticipant}
                    className="w-full h-full"
                    // NOTE: If ParticipantView accepts style props for video,
                    // you could pass style={{ objectFit: 'cover' }} — depends on SDK
                  />
                  {/* Name overlay bottom-left */}
                  <div className="absolute left-4 bottom-4 z-20 bg-black/50 px-3 py-1 rounded text-sm font-medium text-white">
                    {remoteParticipant?.user?.name || remoteParticipant?.user?.id}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400 text-lg">
                  Waiting for another participant to join...
                </div>
              )}
            </div>

            {/* Local PIP bottom-right */}
            <div className="absolute right-4 bottom-4 w-40 h-28 rounded overflow-hidden border border-gray-700 bg-gray-900 z-30 shadow-lg">
              {localParticipant ? (
                <div className="relative w-full h-full">
                  <ParticipantView
                    participant={localParticipant}
                    className="w-full h-full"
                  />
                  <div className="absolute left-2 bottom-1 text-xs text-white bg-black/50 px-2 py-0.5 rounded">
                    {localParticipant?.user?.name || localParticipant?.user?.id || username}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* RIGHT: Chat */}
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

      {/* Controls bar */}
      <div className="flex justify-between items-center mt-4">
        <button
          onClick={() => setEditorOpen((p) => !p)}
          className="bg-gray-800 hover:bg-gray-700 text-sm px-3 py-2 rounded flex items-center gap-2"
        >
          <FaCode /> {editorOpen ? 'Close Editor' : 'Open Editor'}
        </button>

        <div className="flex justify-center gap-4 items-center">
          <button
            onClick={toggleMicrophone}
            className={`p-3 rounded-full border ${microphone.isEnabled ? 'border-teal-400 text-teal-400' : 'border-red-500 text-red-500'}`}
            title={microphone.isEnabled ? 'Mute' : 'Unmute'}
          >
            {microphone.isEnabled ? <FaMicrophone /> : <FaMicrophoneSlash />}
          </button>

          <button
            onClick={toggleCamera}
            className={`p-3 rounded-full border ${camera.isEnabled ? 'border-teal-400 text-teal-400' : 'border-red-500 text-red-500'}`}
            title={camera.isEnabled ? 'Turn camera off' : 'Turn camera on'}
          >
            {camera.isEnabled ? <FaVideo /> : <FaVideoSlash />}
          </button>

          <button
            onClick={toggleScreenShare}
            className={`p-3 rounded-full border ${screenShare.isEnabled ? 'border-teal-400 text-teal-400' : 'border-gray-400 text-gray-400'}`}
            title={screenShare.isEnabled ? 'Stop sharing' : 'Start screen share'}
          >
            <FaDesktop />
          </button>

          {/* Recording - placeholder */}
          <button
            onClick={() => {
              if (!recordingSupported) {
                // give user guidance for next step
                alert('Recording is not configured. Use server/cloud recording (Stream Cloud Recording or your own media server).');
              }
            }}
            className={`p-3 rounded-full border ${recordingSupported ? 'border-teal-400 text-teal-400' : 'border-gray-600 text-gray-600'}`}
            title="Record (server-side required)"
            disabled={!recordingSupported}
          >
            <FaRegCircle />
          </button>

          <button onClick={leaveMeeting} className="p-3 rounded-full bg-red-600 hover:bg-red-700" title="Leave call">
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

/**
 * MeetingRoom
 * - reads prejoin from session storage (as you already use)
 * - creates client & call, joins safely
 * - auto disconnect when the user switches tabs (visibilitychange) OR pagehide/beforeunload
 * - uses refs for client & call to ensure cleanup uses current instances
 */
const MeetingRoom = () => {
  const { meetingId } = useParams(); // not strictly used — we rely on prejoin to be consistent
  const router = useRouter();

  const clientRef = useRef(null);
  const callRef = useRef(null);

  const [client, setClient] = useState(null);
  const [call, setCall] = useState(null);
  const [isConnecting, setIsConnecting] = useState(true);

  useEffect(() => {
    let mounted = true;
    const prejoin = JSON.parse(sessionStorage.getItem('prejoin') || '{}');

    if (!prejoin?.meetingId) {
      router.push('/');
      return;
    }

    // default role fallback
    const role = prejoin.role || 'candidate';
    const username = `${role}-${prejoin.name || 'Guest'}`;

    (async () => {
      try {
        const res = await fetch('/api/stream/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: username }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error || 'Token fetch failed');
        }

        const { token } = await res.json();

        const clientInstance = StreamVideoClient.getOrCreateInstance({
          apiKey: process.env.NEXT_PUBLIC_STREAM_API_KEY,
          user: { id: username, name: prejoin.name || username },
          token,
        });

        // keep refs so cleanup outside effect has access
        clientRef.current = clientInstance;

        const callInstance = clientInstance.call('default', prejoin.meetingId);
        callRef.current = callInstance;

        // try join normally, fallback to create:true
        try {
          await callInstance.join();
        } catch {
          await callInstance.join({ create: true, timeout: 10000 });
        }

        // limit to two participants
        try {
          const members = await callInstance.queryMembers({});
          const count = (members?.members || []).length;
          if (count > 2) {
            alert('This interview room is full.');
            await callInstance.leave();
            await clientInstance.disconnectUser();
            router.push('/');
            return;
          }
        } catch (qErr) {
          console.warn('queryMembers failed', qErr);
        }

        if (!mounted) return;

        setClient(clientInstance);
        setCall(callInstance);
        setIsConnecting(false);

        // Apply mic/cam states from prejoin
        try {
          if (prejoin.micOn === false) await callInstance.microphone.disable();
          if (prejoin.camOn === false) await callInstance.camera.disable();
        } catch (stateErr) {
          console.warn('apply prejoin state failed', stateErr);
        }
      } catch (err) {
        console.error('❌ Stream init error:', err);
        setIsConnecting(false);
        // optionally route home or show UI
      }
    })();

    // cleanup function uses refs (safe)
    const cleanup = async () => {
      try {
        await callRef.current?.leave();
      } catch (e) {}
      try {
        await clientRef.current?.disconnectUser();
      } catch (e) {}
      callRef.current = null;
      clientRef.current = null;
    };

    // auto-disconnect when page is hidden (tab switch) or unload
    const handleVisibility = () => {
      if (document.hidden) {
        // user switched tab or minimized
        cleanup();
      }
    };

    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', cleanup);
    window.addEventListener('pagehide', cleanup);

    return () => {
      mounted = false;
      cleanup();
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', cleanup);
      window.removeEventListener('pagehide', cleanup);
    };
  }, [meetingId, router]);

  if (isConnecting) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-400 text-lg">
        Connecting to meeting...
      </div>
    );
  }

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <CallUI call={call} username={client?.user?.name || 'Guest'} />
      </StreamCall>
    </StreamVideo>
  );
};

export default MeetingRoom;
