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
  FaCircle,
  FaStop,
} from 'react-icons/fa';
import { useParams, useRouter } from 'next/navigation';
import {
  StreamVideo,
  StreamCall,
  useCallStateHooks,
  ParticipantView,
} from '@stream-io/video-react-sdk';
import { initStreamCall } from '@/utils/StreamHelper';
import { useSignaling } from '@/hooks/useSignaling';
import { useWebRTC } from '@/hooks/useWebRTC';

const Editor = lazy(() => import('@monaco-editor/react'));

const CallUI = ({ call, username, isRecruiter, autoScoring, setAutoScoring, roomId }) => {
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
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Initializing call...
      </div>
    );
  }

  const { camera } = camState;
  const { microphone } = micState;
  const { screenShare, startScreenShare, stopScreenShare } = screenShareState;

  // Only treat a remote as "joined" if actually present and connected
  const otherParticipants = participants.filter(
    (p) => !p.isLocalParticipant && p.state === 'joined'
  );
  const remoteParticipant = otherParticipants.length ? otherParticipants[0] : null;

  const localVideoRef = useRef(null);
  const chatContainerRef = useRef(null);

  const [fallbackPreviewVisible, setFallbackPreviewVisible] = useState(false);
  const [editorOpen, setEditorOpen] = useState(true);
  const [editorMaximized, setEditorMaximized] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [micEnabled, setMicEnabled] = useState(microphone?.isEnabled ?? true);
  const [camEnabled, setCamEnabled] = useState(camera?.isEnabled ?? true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordTimer, setRecordTimer] = useState(0);

  // Signaling & WebRTC integration
  const { connected, send } = useSignaling({
    roomId,
    userName: username,
    onMessage: (msg) => handleSignal(msg),
  });

  const { handleSignal, start, messages, sendChat, code, sendCode, setCode } = useWebRTC({
    signaling: { send },
    isOfferer: isRecruiter,
  });

  useEffect(() => {
    if (connected && isRecruiter) start();
  }, [connected, isRecruiter, start]);

  // Local video setup
  useEffect(() => {
    let fallbackStream = null;
    const attachPreview = async () => {
      try {
        const vt = localParticipant?.videoTrack;
        const track = vt?.mediaStreamTrack || vt?.mediaStream?.getVideoTracks?.()?.[0];
        if (track && localVideoRef.current) {
          const stream = new MediaStream([track]);
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.muted = true;
          await localVideoRef.current.play().catch(() => {});
          setFallbackPreviewVisible(true);
        }
      } catch {}
    };
    attachPreview();
    return () => {
      if (fallbackStream) fallbackStream.getTracks().forEach((t) => t.stop());
    };
  }, [localParticipant, camEnabled]);

  // Scroll chat to bottom on new message
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Recording timer
  useEffect(() => {
    let timer;
    if (isRecording) {
      timer = setInterval(() => setRecordTimer((prev) => prev + 1), 1000);
    } else {
      setRecordTimer(0);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  const formatTime = (sec) => {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  const toggleRecording = async () => {
    if (!call) return;
    try {
      if (isRecording) {
        await call.stopRecording();
        setIsRecording(false);
      } else {
        await call.startRecording();
        setIsRecording(true);
      }
    } catch (err) {
      console.error('Recording error:', err);
    }
  };

  const toggleMic = async () => {
    const next = !micEnabled;
    setMicEnabled(next);
    try {
      next ? await call.microphone.enable() : await call.microphone.disable();
    } catch {
      setMicEnabled(!next);
    }
  };

  const toggleCam = async () => {
    const next = !camEnabled;
    setCamEnabled(next);
    try {
      next ? await call.camera.enable() : await call.camera.disable();
    } catch {
      setCamEnabled(!next);
    }
  };

  const leaveMeeting = async () => {
    try {
      await call.leave();
      await call.client.disconnectUser();
    } catch {}
    sessionStorage.removeItem('prejoin');
    window.location.href = `/${(sessionStorage.getItem('prejoin')?.role || 'candidate').toLowerCase()}/schedule`;
  };

  // Layout
  const layoutClasses = () => {
    if (!editorOpen && !chatOpen) return 'w-full';
    if (editorOpen && !chatOpen) return 'w-2/3';
    if (!editorOpen && chatOpen) return 'w-3/4';
    return 'flex-1';
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col overflow-hidden">
      {/* === Top layout === */}
      <div className="flex-1 flex gap-3 overflow-hidden p-2 pb-2">
        {/* === LEFT: Editor === */}
        {editorOpen && (
          <div
            className={`${
              editorMaximized ? 'fixed inset-0 z-50 w-full h-full' : 'w-1/3'
            } bg-gray-800 border border-gray-700 flex flex-col transition-all duration-300`}
          >
            <div className="p-2 bg-gray-700 flex items-center justify-between text-sm font-medium">
              <span>Code Editor</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditorMaximized(!editorMaximized)}
                  className="p-1 rounded hover:bg-gray-600 cursor-pointer"
                >
                  {editorMaximized ? <FaCompress /> : <FaExpand />}
                </button>
                <button
                  onClick={() => setEditorOpen(false)}
                  className="p-1 rounded hover:bg-gray-600 cursor-pointer"
                >
                  Close
                </button>
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
                options={{ fontSize: 14, minimap: { enabled: false }, smoothScrolling: true }}
              />
            </Suspense>
          </div>
        )}

        {/* === CENTER: Video Section === */}
        {!editorMaximized && (
          <div
            className={`${layoutClasses()} relative bg-black flex flex-col items-center justify-center rounded-lg border border-gray-700 overflow-hidden`}
          >
            {/* Remote Participant */}
            {remoteParticipant ? (
              remoteParticipant.videoTrack?.isEnabled ? (
                <ParticipantView participant={remoteParticipant} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-800 text-5xl font-bold text-gray-300">
                  {remoteParticipant.user?.name?.[0]?.toUpperCase() || 'U'}
                </div>
              )
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-lg">
                Waiting for the other participant to join...
              </div>
            )}

            {/* Local PiP */}
            {localParticipant && (
              <div className="absolute right-4 bottom-4 w-40 h-28 rounded overflow-hidden border border-gray-700 bg-gray-900 z-10 flex items-center justify-center">
                {camEnabled ? (
                  <ParticipantView participant={localParticipant} className="w-full h-full" />
                ) : (
                  <div className="flex items-center justify-center w-full h-full bg-gray-800 text-3xl font-bold text-gray-300">
                    {username[0]?.toUpperCase() || 'U'}
                  </div>
                )}
                <div className="absolute left-2 bottom-1 text-xs bg-black/50 px-2 py-0.5 rounded">
                  {username}
                </div>
              </div>
            )}
          </div>
        )}

        {/* === RIGHT: Chat === */}
        {!editorMaximized && chatOpen && (
          <div className="w-1/4 bg-gray-800 border border-gray-700 flex flex-col rounded-lg">
            <div className="p-2 bg-gray-700 font-medium text-sm text-center flex justify-between">
              <span>Chat</span>
              <button
                onClick={() => setChatOpen(false)}
                className="text-xs px-2 py-0.5 bg-gray-600 hover:bg-gray-500 rounded cursor-pointer"
              >
                Close
              </button>
            </div>
            <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-3 space-y-3">
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
                    <div className="text-sm break-words">{msg.text}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex p-2 border-t border-gray-700">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === 'Enter' && chatInput.trim() && sendChat(chatInput, username) && setChatInput('')
                }
                placeholder="Type a message..."
                className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm outline-none"
              />
              <button
                onClick={() => chatInput.trim() && sendChat(chatInput, username) && setChatInput('')}
                className="ml-2 p-2 bg-teal-600 rounded hover:bg-teal-700 cursor-pointer"
              >
                <FaPaperPlane />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* === Bottom Controls === */}
      <div className="flex justify-between items-center p-3 bg-gray-900 border-t border-gray-800">
        <button
          onClick={() => setEditorOpen(!editorOpen)}
          className="bg-gray-800 hover:bg-gray-700 text-sm px-3 py-2 rounded flex items-center gap-2 cursor-pointer"
        >
          <FaCode /> {editorOpen ? 'Close Editor' : 'Open Editor'}
        </button>

        <div className="flex justify-center gap-4 items-center">
          <button
            onClick={toggleMic}
            className={`p-3 rounded-full border cursor-pointer ${
              micEnabled ? 'border-teal-400 text-teal-400' : 'border-red-500 text-red-500'
            }`}
          >
            {micEnabled ? <FaMicrophone /> : <FaMicrophoneSlash />}
          </button>

          <button
            onClick={toggleCam}
            className={`p-3 rounded-full border cursor-pointer ${
              camEnabled ? 'border-teal-400 text-teal-400' : 'border-red-500 text-red-500'
            }`}
          >
            {camEnabled ? <FaVideo /> : <FaVideoSlash />}
          </button>

          <button
            onClick={async () =>
              screenShare?.isEnabled ? await stopScreenShare() : await startScreenShare()
            }
            className={`p-3 rounded-full border cursor-pointer ${
              screenShare?.isEnabled
                ? 'border-teal-400 text-teal-400 bg-teal-900/30'
                : 'border-gray-400 text-gray-400'
            }`}
          >
            <FaDesktop />
          </button>

          {/* Record button */}
          <button
            onClick={toggleRecording}
            className={`p-3 rounded-full border cursor-pointer ${
              isRecording ? 'border-red-500 text-red-500' : 'border-gray-400 text-gray-400'
            }`}
          >
            {isRecording ? <FaStop /> : <FaCircle />}
          </button>
          {isRecording && (
            <span className="text-red-500 text-sm font-mono">{formatTime(recordTimer)}</span>
          )}

          {isRecruiter && (
            <button
              onClick={() => setAutoScoring((v) => !v)}
              className="p-2 rounded text-sm bg-gray-800 hover:bg-gray-700 flex items-center gap-2 cursor-pointer"
            >
              {autoScoring ? <FaToggleOn className="text-teal-400" /> : <FaToggleOff className="text-gray-400" />}
              <span className="text-xs">{autoScoring ? 'Auto Scoring ON' : 'Auto Scoring OFF'}</span>
            </button>
          )}

          <button
            onClick={leaveMeeting}
            className="p-3 rounded-full bg-red-600 hover:bg-red-700 cursor-pointer"
          >
            <FaPhoneSlash />
          </button>
        </div>

        <button
          onClick={() => setChatOpen(!chatOpen)}
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
    if (!meetingId) return;

    let isMounted = true;
    let callInstance = null;
    let clientInstance = null;

    const initCall = async () => {
      try {
        const prejoin = JSON.parse(sessionStorage.getItem('prejoin') || '{}');
        if (!prejoin?.meetingId) {
          router.push('/');
          return;
        }

        console.log(`🚀 Initializing call for meeting: ${prejoin.meetingId}`);

        const { clientInstance: c, callInstance: callObj } = await initStreamCall(prejoin);
        if (!isMounted) return;

        clientInstance = c;
        callInstance = callObj;

        setClient(c);
        setCall(callObj);
        setIsConnecting(false);

        // ✅ Register beforeunload (browser close/reload)
        const handleUnload = async () => {
          try {
            console.log('🧹 Auto-disconnecting before unload...');
            if (callObj) await callObj.leave();
            if (c) await c.disconnectUser();
          } catch (err) {
            console.warn('⚠️ Auto-disconnect failed:', err);
          }
        };

        window.addEventListener('beforeunload', handleUnload);
        window.addEventListener('unload', handleUnload);

        // ✅ Also handle route change
        router.events?.on?.('routeChangeStart', handleUnload);

        // Cleanup for this instance
        return () => {
          window.removeEventListener('beforeunload', handleUnload);
          window.removeEventListener('unload', handleUnload);
          router.events?.off?.('routeChangeStart', handleUnload);
        };
      } catch (err) {
        console.error('❌ init error', err);
        setIsConnecting(false);
      }
    };

    initCall();

    // ✅ Final cleanup when meetingId changes or unmounts
    return () => {
      isMounted = false;
      (async () => {
        try {
          console.log('🧹 Cleaning up call on unmount...');
          if (callInstance) await callInstance.leave();
          if (clientInstance) await clientInstance.disconnectUser();
        } catch (err) {
          console.warn('⚠️ Cleanup failed:', err);
        }
      })();
    };
  }, [meetingId]);


  if (isConnecting) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-400 text-lg">
        Connecting to meeting...
      </div>
    );
  }

  const prejoin = JSON.parse(sessionStorage.getItem('prejoin')) || {};
  const username = prejoin?.name || 'Guest';
  const isRecruiter = prejoin?.role === 'RECRUITER';

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <CallUI
          call={call}
          username={username}
          isRecruiter={isRecruiter}
          autoScoring={autoScoring}
          setAutoScoring={setAutoScoring}
          roomId={meetingId}
        />
      </StreamCall>
    </StreamVideo>
  );
};

export default MeetingRoom;
