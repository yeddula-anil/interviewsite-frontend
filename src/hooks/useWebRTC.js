'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * WebRTC Hook
 * - First user (count === 1) becomes offerer, but ONLY sends offer after it sees a `join` from peer
 * - Queues ICE candidates until remoteDescription is set
 * - Exposes start/stop and media toggles
 */
export function useWebRTC({ isOfferer, signaling, onRemoteStream }) {
  const pc = useRef(null);
  const localStream = useRef(null);
  const pendingRemoteCandidates = useRef([]);
  const [connectionState, setConnectionState] = useState('new');
  const [iceState, setIceState] = useState('new');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const offerSentRef = useRef(false);
  const startedRef = useRef(false);

  const createPeer = () => {
    const peer = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        // Add your TURN here for production reliability
      ],
    });

    peer.onconnectionstatechange = () => {
      setConnectionState(peer.connectionState);
      if (peer.connectionState === 'failed') {
        // Try ICE restart defensively
        (async () => {
          try {
            const offer = await peer.createOffer({ iceRestart: true });
            await peer.setLocalDescription(offer);
            signaling.send('offer', offer);
          } catch (e) {
            console.warn('[useWebRTC] ICE restart failed:', e);
          }
        })();
      }
    };

    peer.oniceconnectionstatechange = () => setIceState(peer.iceConnectionState);

    peer.onicecandidate = (e) => {
      if (e.candidate) {
        signaling.send('candidate', e.candidate.toJSON());
      }
    };

    peer.ontrack = (evt) => {
      const remoteStream = evt.streams?.[0];
      if (remoteStream) onRemoteStream?.(remoteStream);
    };

    return peer;
  };

  const start = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;

    pc.current = createPeer();

    // local media
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 360 } },
      audio: true,
    });
    localStream.current = stream;
    stream.getTracks().forEach(t => pc.current.addTrack(t, stream));
  }, [onRemoteStream]);

  const stop = useCallback(() => {
    try { pc.current?.close(); } catch {}
    pc.current = null;
    try { localStream.current?.getTracks()?.forEach(t => t.stop()); } catch {}
    startedRef.current = false;
    offerSentRef.current = false;
    pendingRemoteCandidates.current = [];
  }, []);

  // Handle signaling messages from useSignaling
  const handleSignal = useCallback(async (msg) => {
    if (!pc.current) return;
    const type = String(msg.type || '').toLowerCase();
    const data = msg.data;

    switch (type) {
      case 'join': {
        // If we're designated offerer, send offer only AFTER seeing the other peer join
        if (isOfferer && !offerSentRef.current) {
          offerSentRef.current = true; // lock to prevent duplicate offers
          const offer = await pc.current.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          });
          await pc.current.setLocalDescription(offer);
          signaling.send('offer', offer);
        }
        break;
      }

      case 'offer': {
        // We are the answerer
        if (!pc.current.currentRemoteDescription) {
          await pc.current.setRemoteDescription(new RTCSessionDescription(data));
          const answer = await pc.current.createAnswer();
          await pc.current.setLocalDescription(answer);
          signaling.send('answer', answer);

          // Flush queued ICE
          for (const c of pendingRemoteCandidates.current) {
            try { await pc.current.addIceCandidate(new RTCIceCandidate(c)); } catch {}
          }
          pendingRemoteCandidates.current = [];
        }
        break;
      }

      case 'answer': {
        // We are the offerer
        if (!pc.current.currentRemoteDescription) {
          await pc.current.setRemoteDescription(new RTCSessionDescription(data));

          // Flush queued ICE
          for (const c of pendingRemoteCandidates.current) {
            try { await pc.current.addIceCandidate(new RTCIceCandidate(c)); } catch {}
          }
          pendingRemoteCandidates.current = [];
        }
        break;
      }

      case 'candidate': {
        if (pc.current.currentRemoteDescription) {
          try { await pc.current.addIceCandidate(new RTCIceCandidate(data)); } catch {}
        } else {
          pendingRemoteCandidates.current.push(data);
        }
        break;
      }

      case 'leave': {
        stop();
        break;
      }
    }
  }, [isOfferer, signaling, stop]);

  // media toggles
  const toggleMic = useCallback(() => {
    const s = localStream.current;
    if (s) s.getAudioTracks().forEach(t => (t.enabled = !micOn));
    setMicOn(v => !v);
  }, [micOn]);

  const toggleCam = useCallback(() => {
    const s = localStream.current;
    if (s) s.getVideoTracks().forEach(t => (t.enabled = !camOn));
    setCamOn(v => !v);
  }, [camOn]);

  return {
    start,
    stop,
    pc,
    localStream,
    connectionState,
    iceState,
    micOn, camOn,
    toggleMic, toggleCam,
    handleSignal, // <- pass this to useSignaling onMessage
  };
}
