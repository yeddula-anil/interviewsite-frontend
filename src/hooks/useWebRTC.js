'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * ✅ useWebRTC Hook (Final Stable Version)
 * Fixes:
 *  - "Failed to access media devices" / NotFoundError
 *  - Offer created before media ready
 *  - PeerConnection closing mid-init
 */
export function useWebRTC({ signaling, isOfferer, onRemoteStream }) {
  const pcRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStream = useRef(null);
  const initializedRef = useRef(false);

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [started, setStarted] = useState(false);
  const [pcReady, setPcReady] = useState(false);

  const safeSend = useCallback(
    (type, data) => {
      if (!signaling?.send || typeof signaling.send !== 'function') {
        console.warn('⚠️ Tried to send before signaling ready:', type);
        return;
      }
      console.log(`📤 Sending ${type}`);
      signaling.send(type, data);
    },
    [signaling]
  );

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    console.log('🎬 Initializing WebRTC...');
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject',
        },
      ],
    });
    pcRef.current = pc;

    pc.ontrack = (event) => {
      console.log('🎥 Remote stream received');
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        remoteVideoRef.current.play?.().catch(() => {});
      }
      onRemoteStream?.(event.streams[0]);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) safeSend('candidate', event.candidate);
    };

    pc.onconnectionstatechange = () => {
      console.log('🔗 Connection state:', pc.connectionState);
    };

    setPcReady(true);

    // 🎥 Get media safely
    (async () => {
      try {
        console.log('🔎 Checking devices...');
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasVideo = devices.some((d) => d.kind === 'videoinput');
        const hasAudio = devices.some((d) => d.kind === 'audioinput');

        if (!hasVideo && !hasAudio) {
          throw new Error('No camera or microphone detected.');
        }

        const constraints = {
          video: hasVideo ? { width: 1280, height: 720 } : false,
          audio: hasAudio,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        localStream.current = stream;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          await localVideoRef.current.play?.().catch(() => {});
        }

        stream.getTracks().forEach((track) => {
          if (pcRef.current?.signalingState !== 'closed') {
            pc.addTrack(track, stream);
          }
        });

        console.log('✅ Local media ready');
        setStarted(true);
      } catch (err) {
        console.error('❌ Failed to access media devices:', err);
        alert(
          'Camera/Mic access failed. Please allow permissions and reload the page.'
        );
      }
    })();

    const handleUnload = () => {
      console.log('🧹 Closing WebRTC (tab closed)');
      pcRef.current?.close();
      localStream.current?.getTracks().forEach((t) => t.stop());
    };

    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      console.log('⚙️ Skipping PC close on re-render');
    };
  }, [safeSend, onRemoteStream]);

  const handleSignal = useCallback(
    async ({ type, data }) => {
      const pc = pcRef.current;
      if (!pc) return;

      switch (type.toLowerCase()) {
        case 'offer':
          console.log('📩 Offer received');
          await pc.setRemoteDescription(new RTCSessionDescription(data));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          safeSend('answer', answer);
          break;

        case 'answer':
          console.log('📩 Answer received');
          await pc.setRemoteDescription(new RTCSessionDescription(data));
          break;

        case 'candidate':
          console.log('📩 ICE candidate received');
          try {
            await pc.addIceCandidate(new RTCIceCandidate(data));
          } catch (err) {
            console.warn('⚠️ Failed to add ICE candidate:', err);
          }
          break;

        default:
          console.log(`ℹ️ Unknown signal type: ${type}`);
      }
    },
    [safeSend]
  );

  const start = useCallback(async () => {
    if (!isOfferer || !started || !pcReady) {
      console.log('⏳ Waiting for PC and media...');
      return;
    }

    const pc = pcRef.current;
    if (!pc || pc.signalingState === 'closed') {
      console.warn('⚠️ Cannot create offer: PC closed');
      return;
    }

    console.log('🧠 Creating and sending offer...');
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    safeSend('offer', offer);
  }, [isOfferer, started, pcReady, safeSend]);

  const toggleMic = () => {
    const enabled = !micOn;
    localStream.current?.getAudioTracks().forEach((t) => (t.enabled = enabled));
    setMicOn(enabled);
  };

  const toggleCam = () => {
    const enabled = !camOn;
    localStream.current?.getVideoTracks().forEach((t) => (t.enabled = enabled));
    setCamOn(enabled);
  };

  const toggleScreenShare = async () => {
    if (!screenSharing) {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];
      const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === 'video');
      sender?.replaceTrack(screenTrack);
      screenTrack.onended = () => toggleScreenShare();
      setScreenSharing(true);
    } else {
      const camTrack = localStream.current?.getVideoTracks()[0];
      const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === 'video');
      sender?.replaceTrack(camTrack);
      setScreenSharing(false);
    }
  };

  return {
    localVideoRef,
    remoteVideoRef,
    handleSignal,
    micOn,
    camOn,
    toggleMic,
    toggleCam,
    toggleScreenShare,
    start,
    localStream,
  };
}
