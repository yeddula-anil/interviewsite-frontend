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
  FaRegCircle,
  FaToggleOn,
  FaToggleOff,
} from 'react-icons/fa';
import { useParams, useRouter } from 'next/navigation';
import {
  StreamVideo,
  StreamVideoClient,
  StreamCall,
  useCallStateHooks,
  ParticipantView,
} from '@stream-io/video-react-sdk';

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
    return <div className="min-h-screen flex items-center justify-center">Initializing call...</div>;
  }

  const { camera } = camState;
  const { microphone } = micState;
  const { screenShare, startScreenShare, stopScreenShare } = screenShareState;

  // ✅ detect remote participant correctly
  const otherParticipants = participants.filter((p) => !p.isLocalParticipant);
  const remoteParticipant = otherParticipants.length ? otherParticipants[0] : null;

  // Local fallback preview
  const localVideoRef = useRef(null);
  const [fallbackPreviewVisible, setFallbackPreviewVisible] = useState(false);

  // Chat + editor
  const [chatMessages, setChatMessages] = useState([{ id: 1, sender: 'System', text: 'Welcome!' }]);
  const [chatInput, setChatInput] = useState('');
  const [code, setCode] = useState('// Start coding here...\n');
  const [editorOpen, setEditorOpen] = useState(true);
  const [editorMaximized, setEditorMaximized] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  const sendChat = () => {
    const text = chatInput.trim();
    if (!text) return;
    setChatMessages((prev) => [...prev, { id: Date.now(), sender: username, text }]);
    setChatInput('');
  };

  const leaveMeeting = async () => {
    try {
      if (recording) stopLocalRecording();
      if (screenShare?.isEnabled) await stopScreenShare().catch(() => {});
      await call?.leave();
      await call?.client?.disconnectUser();
    } catch (e) {
      console.warn('Leave error', e);
    } finally {
      sessionStorage.removeItem('prejoin');
      window.location.href = '/';
    }
  };

  // ✅ Fixed toggles (republishes if needed)
  const handleMicToggle = async () => {
    try {
      if (microphone?.isEnabled) {
        await call.microphone.disable();
      } else {
        await call.microphone.enable();
        await call.publishMicrophone?.().catch(() => {});
      }
    } catch (err) {
      console.error('toggle microphone error', err);
      alert('Unable to toggle microphone. Check permissions.');
    }
  };

  const handleCameraToggle = async () => {
    try {
      if (camera?.isEnabled) {
        await call.camera.disable();
      } else {
        await call.camera.enable();
        await call.publishCamera?.().catch(() => {});
      }
    } catch (err) {
      console.error('toggle camera error', err);
      alert('Unable to toggle camera. Check permissions.');
    }
  };

  // ✅ Reliable screen sharing
  const handleScreenShareToggle = async () => {
    try {
      if (screenShare?.isEnabled) {
        await stopScreenShare();
      } else {
        await call.startScreenShare?.();
      }
    } catch (err) {
      console.error('screen share error', err);
      alert('Screen sharing failed. Ensure HTTPS and allow permissions.');
    }
  };

  // ✅ Local fallback preview if SDK doesn’t attach video immediately
  useEffect(() => {
    let fallbackStream = null;
    let interval = null;
    let mounted = true;

    const attachPreview = async () => {
      try {
        const vt = localParticipant?.videoTrack;
        const track = vt?.mediaStreamTrack || vt?.mediaStream?.getVideoTracks?.()?.[0];
        if (track && localVideoRef.current) {
          const stream = new MediaStream([track]);
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.muted = true;
          localVideoRef.current.playsInline = true;
          localVideoRef.current.play().catch(() => {});
          setFallbackPreviewVisible(true);
          return true;
        }
        return false;
      } catch (err) {
        return false;
      }
    };

    const init = async () => {
      const ok = await attachPreview();
      if (!ok) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false }).catch(() => null);
        if (stream && mounted && localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.muted = true;
          localVideoRef.current.play().catch(() => {});
          fallbackStream = stream;
          setFallbackPreviewVisible(true);
        }
        interval = setInterval(() => {
          attachPreview().then((s) => {
            if (s && interval) {
              clearInterval(interval);
              interval = null;
            }
          });
        }, 700);
      }
    };

    init();
    return () => {
      mounted = false;
      if (interval) clearInterval(interval);
      if (fallbackStream) fallbackStream.getTracks().forEach((t) => t.stop());
    };
  }, [localParticipant]);

  // ✅ Recording (best effort)
  const startLocalRecording = async () => {
    try {
      const merged = new MediaStream();
      const addTrack = (track) => track && merged.addTrack(track);

      const lv = localParticipant?.videoTrack;
      const la = localParticipant?.audioTrack;
      addTrack(lv?.mediaStreamTrack);
      addTrack(la?.mediaStreamTrack);

      if (remoteParticipant) {
        const rv = remoteParticipant?.videoTrack;
        const ra = remoteParticipant?.audioTrack;
        addTrack(rv?.mediaStreamTrack);
        addTrack(ra?.mediaStreamTrack);
      }

      if (!merged.getTracks().length) {
        alert('No available tracks to record.');
        return;
      }

      const rec = new MediaRecorder(merged, { mimeType: 'video/webm; codecs=vp9' });
      recordedChunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size && recordedChunksRef.current.push(e.data);
      rec.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        console.log('Recording done, size:', blob.size);
        alert('Recording finished. Implement upload if needed.');
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
      console.log('Recording started');
    } catch (err) {
      console.error('startLocalRecording', err);
      alert('Recording failed.');
    }
  };

  const stopLocalRecording = () => {
    try {
      recorderRef.current?.stop();
      setRecording(false);
    } catch (err) {
      console.error('stopLocalRecording', err);
    }
  };

  // --- UI ---
  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 flex flex-col">
      <div className="flex-1 flex gap-3 overflow-hidden rounded-lg border border-gray-700 p-2">
        {/* === Code Editor === */}
        {editorOpen && (
          <div className={`${editorMaximized ? 'w-full' : 'w-1/3'} bg-gray-800 border border-gray-700 flex flex-col transition-all duration-300`}>
            <div className="p-2 bg-gray-700 flex items-center justify-between text-sm font-medium">
              <span>Code Editor</span>
              <button onClick={() => setEditorMaximized((p) => !p)} className="p-1 rounded hover:bg-gray-600 cursor-pointer">
                {editorMaximized ? <FaCompress /> : <FaExpand />}
              </button>
            </div>
            <Suspense fallback={<div className="p-4 text-gray-400">Loading Editor...</div>}>
              <Editor height="100%" theme="vs-dark" value={code} onChange={(c) => setCode(c ?? code)} options={{ fontSize: 14, minimap: { enabled: false } }} />
            </Suspense>
          </div>
        )}

        {/* === Video Section === */}
        {!editorMaximized && (
          <div className="relative bg-black flex-1 flex flex-col items-center justify-center rounded-lg border border-gray-700 overflow-hidden">
            {/* ✅ Waiting Overlay */}
           {(!remoteParticipant || (!remoteParticipant.videoTrack && !remoteParticipant.audioTrack)) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm text-gray-300 z-[10]">
                <div className="flex flex-col items-center space-y-4">
                  <div className="animate-pulse text-xl font-medium">
                    Waiting for the other participant to join...
                  </div>
                  <div className="flex items-center space-x-2 text-sm text-gray-400">
                    <div className="w-3 h-3 bg-teal-400 rounded-full animate-ping"></div>
                    <span>Once they join, your interview will begin automatically.</span>
                  </div>
                </div>
              </div>
            )}



            <div className="w-full h-full relative">
              {remoteParticipant ? (
                <div className="w-full h-full overflow-hidden relative">
                  {remoteParticipant.videoTrack ? (
                    <ParticipantView participant={remoteParticipant} className="w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white text-2xl font-semibold">
                      {remoteParticipant?.user?.name || remoteParticipant?.user?.id}
                    </div>
                  )}
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

            {/* Local PIP */}
            <div className="absolute right-4 bottom-4 w-40 h-28 rounded overflow-hidden border border-gray-700 bg-gray-900 z-[50] shadow-lg">
              {localParticipant && (
                <div className="relative w-full h-full">
                  {localParticipant.videoTrack ? (
                    <>
                      <ParticipantView participant={localParticipant} className="w-full h-full" />
                      <video ref={localVideoRef} style={{ display: fallbackPreviewVisible ? 'block' : 'none' }} muted playsInline />
                    </>
                  ) : (
                    <video ref={localVideoRef} className="w-full h-full object-cover" muted playsInline />
                  )}
                  <div className="absolute left-2 bottom-1 text-xs text-white bg-black/50 px-2 py-0.5 rounded">
                    {localParticipant?.user?.name || username}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* === Chat === */}
        {!editorMaximized && chatOpen && (
          <div className="w-1/4 bg-gray-800 border border-gray-700 flex flex-col rounded-lg">
            <div className="p-2 bg-gray-700 font-medium text-sm text-center">Chat</div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender === username ? 'justify-end' : 'justify-start'}`}>
                  <div className={`p-2 rounded-lg max-w-[75%] ${msg.sender === username ? 'bg-teal-700 text-white rounded-br-none' : 'bg-gray-700 text-gray-100 rounded-bl-none'}`}>
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
        <button onClick={() => setEditorOpen((p) => !p)} className="bg-gray-800 hover:bg-gray-700 text-sm px-3 py-2 rounded flex items-center gap-2 cursor-pointer">
          <FaCode /> {editorOpen ? 'Close Editor' : 'Open Editor'}
        </button>

        <div className="flex justify-center gap-4 items-center">
          {/* Mic */}
          <button onClick={handleMicToggle} className={`p-3 rounded-full border ${microphone?.isEnabled ? 'border-teal-400 text-teal-400' : 'border-red-500 text-red-500'} cursor-pointer`}>
            {microphone?.isEnabled ? <FaMicrophone /> : <FaMicrophoneSlash />}
          </button>

          {/* Camera */}
          <button onClick={handleCameraToggle} className={`p-3 rounded-full border ${camera?.isEnabled ? 'border-teal-400 text-teal-400' : 'border-red-500 text-red-500'} cursor-pointer`}>
            {camera?.isEnabled ? <FaVideo /> : <FaVideoSlash />}
          </button>

          {/* Screen share */}
          <button onClick={handleScreenShareToggle} className={`p-3 rounded-full border ${screenShare?.isEnabled ? 'border-teal-400 text-teal-400 bg-teal-900/30' : 'border-gray-400 text-gray-400'} cursor-pointer`}>
            <FaDesktop />
          </button>

          {/* Recording */}
          <button onClick={() => (recording ? stopLocalRecording() : startLocalRecording())} className={`p-3 rounded-full border ${recording ? 'border-teal-400 text-teal-400' : 'border-gray-600 text-gray-600'} cursor-pointer`}>
            <FaRegCircle />
          </button>

          {/* Auto Scoring */}
          <button onClick={() => setAutoScoring((v) => !v)} className="p-2 rounded text-sm bg-gray-800 hover:bg-gray-700 flex items-center gap-2 cursor-pointer">
            {autoScoring ? <FaToggleOn className="text-teal-400" /> : <FaToggleOff className="text-gray-400" />}
            <span className="text-xs">{autoScoring ? 'Auto Scoring ON' : 'Auto Scoring OFF'}</span>
          </button>

          {/* Leave */}
          <button onClick={leaveMeeting} className="p-3 rounded-full bg-red-600 hover:bg-red-700 cursor-pointer">
            <FaPhoneSlash />
          </button>
        </div>

        <button onClick={() => setChatOpen((p) => !p)} className="bg-gray-800 hover:bg-gray-700 text-sm px-3 py-2 rounded flex items-center gap-2 cursor-pointer">
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

    const username = `${prejoin.role || 'candidate'}-${prejoin.name || 'Guest'}`;

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
          user: { id: username, name: prejoin.name },
          token,
        });

        const callInstance = clientInstance.call('default', prejoin.meetingId);
        await callInstance.join({ create: true });

        // ensure tracks ready
        await callInstance.camera.createTrack?.().catch(() => {});
        await callInstance.microphone.createTrack?.().catch(() => {});

        if (prejoin.camOn !== false) await callInstance.camera.enable().catch(() => {});
        if (prejoin.micOn !== false) await callInstance.microphone.enable().catch(() => {});

        if (mounted) {
          setClient(clientInstance);
          setCall(callInstance);
          setTimeout(() => setIsConnecting(false), 400);
        }
      } catch (err) {
        console.error('init error', err);
        setIsConnecting(false);
      }
    })();

    return () => {
      mounted = false;
      call?.leave?.();
      client?.disconnectUser?.();
    };
  }, [meetingId, router]);

  if (isConnecting) {
    return <div className="flex items-center justify-center min-h-screen text-gray-400 text-lg">Connecting to meeting...</div>;
  }

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <CallUI call={call} username={JSON.parse(sessionStorage.getItem('prejoin'))?.name || 'Guest'} autoScoring={autoScoring} setAutoScoring={setAutoScoring} />
      </StreamCall>
    </StreamVideo>
  );
};

export default MeetingRoom;
