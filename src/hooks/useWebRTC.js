'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * useWebRTC Hook
 * Handles offer/answer, ICE candidates, media setup, and signaling.
 */
export function useWebRTC({ signaling, isOfferer, onRemoteStream }) {
  const pcRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStream = useRef(null);

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [started, setStarted] = useState(false);

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

  // ✅ Setup peer connection
  useEffect(() => {
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
        onRemoteStream?.(event.streams[0]);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        safeSend('candidate', event.candidate);
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('🔗 Connection state:', pc.connectionState);
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        console.warn('⚠️ Peer connection closed.');
      }
    };

    // 🎥 Get local media
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStream.current = stream;

        // ⚙️ Prevent "InvalidStateError" — check if connection still open
        if (!pcRef.current || pcRef.current.signalingState === 'closed') {
          console.warn('⚠️ Skipping addTrack because connection already closed');
          return;
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play?.().catch(() => {});
        }

        stream.getTracks().forEach((track) => {
          if (pcRef.current.signalingState !== 'closed') {
            pc.addTrack(track, stream);
          }
        });

        console.log('✅ Local media ready');
        setStarted(true);
      } catch (err) {
        console.error('❌ Failed to access media devices:', err);
      }
    })();

    // 🧹 Cleanup
    return () => {
      if (pcRef.current?.signalingState !== 'closed') {
        pcRef.current.close();
      }
      localStream.current?.getTracks().forEach((t) => t.stop());
    };
  }, [safeSend, onRemoteStream]);

  // ✅ Handle incoming signals
  const handleSignal = useCallback(
    async ({ type, data }) => {
      const pc = pcRef.current;
      if (!pc) return;

      switch (type.toLowerCase()) {
        case 'offer': {
          console.log('📩 Offer received');
          await pc.setRemoteDescription(new RTCSessionDescription(data));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          safeSend('answer', answer);
          break;
        }
        case 'answer': {
          console.log('📩 Answer received');
          await pc.setRemoteDescription(new RTCSessionDescription(data));
          break;
        }
        case 'candidate': {
          console.log('📩 ICE candidate received');
          try {
            await pc.addIceCandidate(new RTCIceCandidate(data));
          } catch (err) {
            console.warn('⚠️ Failed to add ICE candidate:', err);
          }
          break;
        }
        default:
          console.log(`ℹ️ Unknown signal type: ${type}`);
      }
    },
    [safeSend]
  );

  // ✅ Offerer creates offer after stream ready
  const start = useCallback(async () => {
    if (!isOfferer || !started) return;
    const pc = pcRef.current;
    if (!pc || pc.signalingState === 'closed') {
      console.warn('⚠️ Cannot create offer: Peer connection closed');
      return;
    }
    console.log('🧠 Creating and sending offer...');
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    safeSend('offer', offer);
  }, [isOfferer, started, safeSend]);

  // ✅ Toggle mic
  const toggleMic = () => {
    const enabled = !micOn;
    localStream.current?.getAudioTracks().forEach((t) => (t.enabled = enabled));
    setMicOn(enabled);
  };

  // ✅ Toggle camera
  const toggleCam = () => {
    const enabled = !camOn;
    localStream.current?.getVideoTracks().forEach((t) => (t.enabled = enabled));
    setCamOn(enabled);
  };

  // ✅ Toggle screen sharing
  const toggleScreenShare = async () => {
    if (!screenSharing) {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack = screenStream.getVideoTracks()[0];
      const sender = pcRef.current.getSenders().find((s) => s.track?.kind === 'video');
      sender?.replaceTrack(screenTrack);
      screenTrack.onended = () => toggleScreenShare();
      setScreenSharing(true);
    } else {
      const camTrack = localStream.current.getVideoTracks()[0];
      const sender = pcRef.current.getSenders().find((s) => s.track?.kind === 'video');
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
