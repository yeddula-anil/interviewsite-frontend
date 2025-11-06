'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * useWebRTC — robust version
 * - Queues ICE candidates until remoteDescription is set
 * - Defers offer until PC + media ready
 * - Uses multiple reliable STUN servers for network traversal.
 * - Emits connection events you can use to hide "Connecting..."
 */
export function useWebRTC({ signaling, isOfferer, onRemoteStream, onConnectionChange }) {
  const pcRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStream = useRef(null);

  // readiness + state
  const initializedRef = useRef(false);
  const [started, setStarted] = useState(false);
  const [pcReady, setPcReady] = useState(false);

  // candidate queue until remoteDescription is set
  const remoteDescSetRef = useRef(false);
  const candidateQueueRef = useRef([]);

  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);

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

    // [!FIX] Updated ICE configuration: Removed unreliable public TURN servers 
    // and added multiple reliable STUN servers for robust peer-to-peer connection.
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        // For production, you would deploy your own reliable TURN server here.
      ],
      // Optional: force relay when debugging strict NATs
      // iceTransportPolicy: 'all', // or 'relay'
    });
    pcRef.current = pc;

    pc.ontrack = (event) => {
      console.log('🎥 Remote stream received');
      const stream = event.streams[0];
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
        remoteVideoRef.current.play?.().catch(() => {});
      }
      onRemoteStream?.(stream);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        safeSend('candidate', event.candidate);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('🧊 ICE state:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        onConnectionChange?.('connected');
      }
      if (pc.iceConnectionState === 'failed') {
        console.error('ICE connection failed.');
        onConnectionChange?.('failed');
      }
      if (pc.iceConnectionState === 'disconnected') {
        onConnectionChange?.('disconnected');
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('🔗 Connection state:', pc.connectionState);
      onConnectionChange?.(pc.connectionState);
    };

    setPcReady(true);

    // Media setup
    (async () => {
      try {
        console.log('🔎 Checking devices...');
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasVideo = devices.some((d) => d.kind === 'videoinput');
        const hasAudio = devices.some((d) => d.kind === 'audioinput');

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

        // Add tracks AFTER assigning localStream to avoid races
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        console.log('✅ Local media ready');
        setStarted(true);
      } catch (err) {
        console.error('❌ Failed to access media devices:', err);
        // We won't use alert() as it's bad practice in hooks and will be 
        // blocked by the browser in many contexts.
      }
    })();

    // Only close on tab close; don’t flap on re-renders
    const handleUnload = () => {
      try { pcRef.current?.close(); } catch {}
      localStream.current?.getTracks().forEach((t) => t.stop());
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      console.log('⚙️ Skipping PC close on re-render');
    };
  }, [safeSend, onRemoteStream, onConnectionChange]);

  // Handle signaling
  const handleSignal = useCallback(
    async ({ type, data }) => {
      const pc = pcRef.current;
      if (!pc) return;

      switch ((type || '').toLowerCase()) {
        case 'offer': {
          console.log('📩 Offer received');
          await pc.setRemoteDescription(new RTCSessionDescription(data));
          remoteDescSetRef.current = true;

          // Flush any queued candidates
          if (candidateQueueRef.current.length) {
            console.log(`🧊 Applying queued candidates (${candidateQueueRef.current.length})`);
            for (const c of candidateQueueRef.current) {
              try { await pc.addIceCandidate(c); } catch (e) { console.warn('ICE add (queued) failed:', e); }
            }
            candidateQueueRef.current = [];
          }

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          safeSend('answer', answer);
          break;
        }

        case 'answer': {
          console.log('📩 Answer received');
          await pc.setRemoteDescription(new RTCSessionDescription(data));
          remoteDescSetRef.current = true;

          // Flush queued candidates for offerer
          if (candidateQueueRef.current.length) {
            console.log(`🧊 Applying queued candidates (${candidateQueueRef.current.length})`);
            for (const c of candidateQueueRef.current) {
              try { await pc.addIceCandidate(c); } catch (e) { console.warn('ICE add (queued) failed:', e); }
            }
            candidateQueueRef.current = [];
          }
          break;
        }

        case 'candidate': {
          const cand = new RTCIceCandidate(data);
          if (!remoteDescSetRef.current) {
            // Queue until remoteDescription is set
            candidateQueueRef.current.push(cand);
            console.log(`🧊 Queued ICE candidate (${candidateQueueRef.current.length})`);
          } else {
            try {
              await pc.addIceCandidate(cand);
              console.log('🧊 ICE candidate added');
            } catch (err) {
              console.warn('⚠️ Failed to add ICE candidate:', err);
            }
          }
          break;
        }

        default:
          console.log(`ℹ️ Unknown signal type: ${type}`);
      }
    },
    [safeSend]
  );

  // Offerer start (with retry if too early)
  const start = useCallback(async () => {
    const pc = pcRef.current;

    if (!isOfferer) return;
    if (!pc || !pcReady || !started) {
      console.log('⏳ Waiting for PC and media...');
      setTimeout(start, 400);
      return;
    }
    if (pc.signalingState === 'closed') {
      console.warn('⚠️ Cannot create offer: PC closed');
      return;
    }

    // Only create offer if signaling state is 'stable'
    if (pc.signalingState !== 'stable') {
      console.log('Signaling already in progress, skipping start()');
      return;
    }

    console.log('🧠 Creating and sending offer...');
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    safeSend('offer', offer);
  }, [isOfferer, pcReady, started, safeSend]);

  // Controls
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
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === 'video');
        
        if (sender) {
          sender.replaceTrack(screenTrack);
          screenTrack.onended = () => toggleScreenShare(); // Revert on stop
          setScreenSharing(true);
        } else {
          console.warn('Could not find video sender to replace track.');
        }
      } catch (err) {
        console.error('Error starting screen share:', err);
      }
    } else {
      try {
        const camTrack = localStream.current?.getVideoTracks()[0];
        const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === 'video');
        
        if (sender && camTrack) {
          sender.replaceTrack(camTrack);
          setScreenSharing(false);
        } else {
          console.warn('Could not find sender or camera track to revert.');
          // As a fallback, stop the screen track if it exists
          const currentSender = pcRef.current?.getSenders().find((s) => s.track?.kind === 'video');
          currentSender?.track?.stop(); // Stop the screen track
          setScreenSharing(false);
        }
      } catch (err) {
        console.error('Error stopping screen share:', err);
      }
    }
  };

  return {
    localVideoRef,
    remoteVideoRef,
    handleSignal,
    start,
    micOn,
    camOn,
    toggleMic,
    toggleCam,
    toggleScreenShare,
    localStream,
  };
}