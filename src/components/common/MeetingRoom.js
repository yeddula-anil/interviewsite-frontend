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
    return <div className="min-h-screen flex items-center justify-center">Initializing call...</div>;
  }

  const { camera } = camState;
  const { microphone } = micState;
  const { screenShare, startScreenShare, stopScreenShare } = screenShareState;

  const otherParticipants = participants.filter((p) => !p.isLocalParticipant);
  const remoteParticipant = otherParticipants.length ? otherParticipants[0] : null;

  const localVideoRef = useRef(null);
  const [fallbackPreviewVisible, setFallbackPreviewVisible] = useState(false);

  // Local fallback camera preview
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

  // === UI ===
  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 flex flex-col">
      <div className="flex-1 flex gap-3 overflow-hidden rounded-lg border border-gray-700 p-2">
        {/* === Video Section === */}
        <div className="relative bg-black flex-1 flex flex-col items-center justify-center rounded-lg border border-gray-700 overflow-hidden">
          {!remoteParticipant && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-gray-300 z-[10]">
              Waiting for the other participant to join...
            </div>
          )}

          {remoteParticipant && (
            <ParticipantView participant={remoteParticipant} className="w-full h-full object-cover" />
          )}

          {/* Local picture-in-picture */}
          <div className="absolute right-4 bottom-4 w-40 h-28 rounded overflow-hidden border border-gray-700 bg-gray-900 z-[50] shadow-lg">
            {localParticipant && (
              <>
                <ParticipantView participant={localParticipant} className="w-full h-full" />
                <div className="absolute left-2 bottom-1 text-xs text-white bg-black/50 px-2 py-0.5 rounded">
                  {localParticipant?.user?.name || username}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* === Bottom Controls === */}
      <div className="flex justify-center items-center gap-4 mt-4">
        {/* Mic */}
        <button
          onClick={async () =>
            microphone?.isEnabled ? await call.microphone.disable() : await call.microphone.enable()
          }
          className={`p-3 rounded-full border ${
            microphone?.isEnabled ? 'border-teal-400 text-teal-400' : 'border-red-500 text-red-500'
          } cursor-pointer`}
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
          } cursor-pointer`}
        >
          {camera?.isEnabled ? <FaVideo /> : <FaVideoSlash />}
        </button>

        {/* Screen share */}
        <button
          onClick={async () =>
            screenShare?.isEnabled ? await stopScreenShare() : await startScreenShare()
          }
          className={`p-3 rounded-full border ${
            screenShare?.isEnabled
              ? 'border-teal-400 text-teal-400 bg-teal-900/30'
              : 'border-gray-400 text-gray-400'
          } cursor-pointer`}
        >
          <FaDesktop />
        </button>

        {/* Leave */}
        <button
          onClick={async () => {
            await call.leave();
            await call.client.disconnectUser();
            sessionStorage.removeItem('prejoin');
            window.location.href = '/';
          }}
          className="p-3 rounded-full bg-red-600 hover:bg-red-700 cursor-pointer"
        >
          <FaPhoneSlash />
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

    (async () => {
      try {
        const { clientInstance, callInstance } = await initStreamCall(prejoin);
        if (mounted) {
          setClient(clientInstance);
          setCall(callInstance);
          setIsConnecting(false);
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
        <CallUI
          call={call}
          username={username}
          autoScoring={autoScoring}
          setAutoScoring={setAutoScoring}
        />
      </StreamCall>
    </StreamVideo>
  );
};

export default MeetingRoom;
