'use client';

import React, { useEffect, useState, lazy, Suspense, useRef } from 'react';
import {
  FaMicrophone,
  FaMicrophoneSlash,
  FaVideo,
  FaVideoSlash,
  FaDesktop,
  FaPhoneSlash,
  FaComments,
  FaCode,
  FaExpand,
  FaCompress,
  FaPaperPlane,
  FaToggleOn,
  FaToggleOff,
} from 'react-icons/fa';
import { useParams, useRouter } from 'next/navigation';
import {
  StreamVideo,
  StreamCall,
  useCallStateHooks,
  ParticipantView,
} from '@stream-io/video-react-sdk';
import { initStreamCall } from '@/utils/StreamHelper';

const Editor = lazy(() => import('@monaco-editor/react'));

const CallUI = ({ call, username, autoScoring, setAutoScoring }) => {
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

  if (!camState || !micState || !screenShareState) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Initializing call...</div>;
  }

  const { camera } = camState;
  const { microphone } = micState;
  const { screenShare, startScreenShare, stopScreenShare } = screenShareState;

  const otherParticipants = participants.filter((p) => !p.isLocalParticipant);
  const remoteParticipant = otherParticipants.length ? otherParticipants[0] : null;

  const localVideoRef = useRef(null);
  const [fallbackPreviewVisible, setFallbackPreviewVisible] = useState(false);

  // Local fallback preview (ensures video always visible)
  useEffect(() => {
    let fallbackStream = null;
    let mounted = true;

    const attachPreview = async () => {
      try {
        const vt = localParticipant?.videoTrack;
        const track = vt?.mediaStreamTrack || vt?.mediaStream?.getVideoTracks?.()?.[0];
        if (track && localVideoRef.current) {
          const stream = new MediaStream([track]);
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.muted = true;
          localVideoRef.current.play().catch(() => {});
          setFallbackPreviewVisible(true);
        }
      } catch {
        return;
      }
    };

    attachPreview();
    return () => {
      mounted = false;
      if (fallbackStream) fallbackStream.getTracks().forEach((t) => t.stop());
    };
  }, [localParticipant]);

  // === UI State ===
  const [editorOpen, setEditorOpen] = useState(true);
  const [editorMaximized, setEditorMaximized] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [messages, setMessages] = useState([{ id: 1, sender: 'System', text: 'Welcome!' }]);
  const [chatInput, setChatInput] = useState('');
  const [code, setCode] = useState('// Start coding here...\n');

  const sendChat = () => {
    if (chatInput.trim()) {
      setMessages((prev) => [...prev, { id: Date.now(), sender: username, text: chatInput }]);
      setChatInput('');
    }
  };

  const leaveMeeting = async () => {
    try {
      await call.leave();
      await call.client.disconnectUser();
    } catch {}
    sessionStorage.removeItem('prejoin');
    window.location.href = '/';
  };

  // === FULL UI ===
  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 flex flex-col">
      {/* === Top layout: Editor | Video | Chat === */}
      <div className="flex-1 flex gap-3 overflow-hidden rounded-lg border border-gray-700 p-2">
        {/* === LEFT: Editor === */}
        {editorOpen && (
          <div className={`${editorMaximized ? 'w-full' : 'w-1/3'} bg-gray-800 border border-gray-700 flex flex-col transition-all duration-300`}>
            <div className="p-2 bg-gray-700 flex items-center justify-between text-sm font-medium">
              <span>Code Editor</span>
              <button onClick={() => setEditorMaximized((p) => !p)} className="p-1 rounded hover:bg-gray-600 cursor-pointer">
                {editorMaximized ? <FaCompress /> : <FaExpand />}
              </button>
            </div>
            <Suspense fallback={<div className="p-4 text-gray-400">Loading Editor...</div>}>
              <Editor height="100%" theme="vs-dark" value={code} onChange={(v) => setCode(v ?? code)} options={{ fontSize: 14, minimap: { enabled: false } }} />
            </Suspense>
          </div>
        )}

        {/* === CENTER: Video Section === */}
        {!editorMaximized && (
          <div className="relative bg-black flex-1 flex flex-col items-center justify-center rounded-lg border border-gray-700 overflow-hidden">
            {!remoteParticipant && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-gray-300 z-[10]">
                Waiting for the other participant to join...
              </div>
            )}

            {remoteParticipant ? (
              <ParticipantView participant={remoteParticipant} className="w-full h-full object-cover" />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-lg">
                Waiting for another participant...
              </div>
            )}

            {/* === Local PiP === */}
            <div className="absolute right-4 bottom-4 w-40 h-28 rounded overflow-hidden border border-gray-700 bg-gray-900 z-[50] shadow-lg">
              {localParticipant ? (
                <>
                  <ParticipantView participant={localParticipant} className="w-full h-full" />
                  {fallbackPreviewVisible && (
                    <video ref={localVideoRef} className="w-full h-full object-cover absolute top-0 left-0" muted playsInline />
                  )}
                  <div className="absolute left-2 bottom-1 text-xs text-white bg-black/50 px-2 py-0.5 rounded">
                    {localParticipant?.user?.name || username}
                  </div>
                </>
              ) : (
                <video ref={localVideoRef} className="w-full h-full object-cover" muted playsInline />
              )}
            </div>
          </div>
        )}

        {/* === RIGHT: Chat === */}
        {!editorMaximized && chatOpen && (
          <div className="w-1/4 bg-gray-800 border border-gray-700 flex flex-col rounded-lg">
            <div className="p-2 bg-gray-700 font-medium text-sm text-center">Chat</div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {messages.map((msg) => (
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
              <button onClick={sendChat} className="ml-2 p-2 bg-teal-600 rounded hover:bg-teal-700 cursor-pointer">
                <FaPaperPlane />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* === Bottom Controls === */}
      <div className="flex justify-between items-center mt-4">
        {/* Toggle Editor */}
        <button
          onClick={() => setEditorOpen((p) => !p)}
          className="bg-gray-800 hover:bg-gray-700 text-sm px-3 py-2 rounded flex items-center gap-2 cursor-pointer"
        >
          <FaCode /> {editorOpen ? 'Close Editor' : 'Open Editor'}
        </button>

        {/* Controls */}
        <div className="flex justify-center gap-4 items-center">
          {/* Mic */}
          <button
            onClick={async () =>
              microphone?.isEnabled ? await call.microphone.disable() : await call.microphone.enable()
            }
            className={`p-3 rounded-full border ${
              microphone?.isEnabled ? 'border-teal-400 text-teal-400' : 'border-red-500 text-red-500'
            }`}
          >
            {microphone?.isEnabled ? <FaMicrophone /> : <FaMicrophoneSlash />}
          </button>

          {/* Camera */}
          <button
            onClick={async () =>
              camera?.isEnabled ? await call.camera.disable() : await call.camera.enable()
            }
            className={`p-3 rounded-full border ${
              camera?.isEnabled ? 'border-teal-400 text-teal-400' : 'border-red-500 text-red-500'
            }`}
          >
            {camera?.isEnabled ? <FaVideo /> : <FaVideoSlash />}
          </button>

          {/* Screen Share */}
          <button
            onClick={async () =>
              screenShare?.isEnabled ? await stopScreenShare() : await startScreenShare()
            }
            className={`p-3 rounded-full border ${
              screenShare?.isEnabled ? 'border-teal-400 text-teal-400 bg-teal-900/30' : 'border-gray-400 text-gray-400'
            }`}
          >
            <FaDesktop />
          </button>

          {/* Auto Scoring */}
          <button
            onClick={() => setAutoScoring((v) => !v)}
            className="p-2 rounded text-sm bg-gray-800 hover:bg-gray-700 flex items-center gap-2 cursor-pointer"
          >
            {autoScoring ? <FaToggleOn className="text-teal-400" /> : <FaToggleOff className="text-gray-400" />}
            <span className="text-xs">{autoScoring ? 'Auto Scoring ON' : 'Auto Scoring OFF'}</span>
          </button>

          {/* Leave */}
          <button onClick={leaveMeeting} className="p-3 rounded-full bg-red-600 hover:bg-red-700 cursor-pointer">
            <FaPhoneSlash />
          </button>
        </div>

        {/* Toggle Chat */}
        <button
          onClick={() => setChatOpen((p) => !p)}
          className="bg-gray-800 hover:bg-gray-700 text-sm px-3 py-2 rounded flex items-center gap-2 cursor-pointer"
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
  const [client, setClient] = useState(null);
  const [call, setCall] = useState(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [autoScoring, setAutoScoring] = useState(false);

  useEffect(() => {
    let mounted = true;
    const prejoin = JSON.parse(sessionStorage.getItem('prejoin') || '{}');
    if (!prejoin?.meetingId) {
      router.push('/');
      return;
    }

    let callInstance = null;
    let clientInstance = null;

    (async () => {
      try {
        const { clientInstance: c, callInstance: call } = await initStreamCall(prejoin);
        if (mounted) {
          clientInstance = c;
          callInstance = call;
          setClient(c);
          setCall(call);
          setIsConnecting(false);
        }
      } catch (err) {
        console.error('init error', err);
        setIsConnecting(false);
      }
    })();

    // ✅ Auto cleanup on tab close or browser back
    const handleCleanup = async () => {
      try {
        if (callInstance) await callInstance.leave();
        if (clientInstance) await clientInstance.disconnectUser();
        console.log('[MeetingRoom] Cleaned up on unload/navigation');
      } catch (err) {
        console.warn('Cleanup error:', err);
      }
    };

    // Fires when tab closes, refreshes, or navigates away
    window.addEventListener('beforeunload', handleCleanup);

    // Fires when user clicks browser back or forward
    window.addEventListener('popstate', handleCleanup);

    return () => {
      mounted = false;
      handleCleanup();
      window.removeEventListener('beforeunload', handleCleanup);
      window.removeEventListener('popstate', handleCleanup);
    };
  }, [meetingId, router]);


  if (isConnecting) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-400 text-lg">
        Connecting to meeting...
      </div>
    );
  }

  const username = JSON.parse(sessionStorage.getItem('prejoin'))?.name || 'Guest';

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <CallUI call={call} username={username} autoScoring={autoScoring} setAutoScoring={setAutoScoring} />
      </StreamCall>
    </StreamVideo>
  );
};

export default MeetingRoom;
