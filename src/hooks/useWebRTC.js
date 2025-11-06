'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * useWebRTC Hook
 * ------------------------
 * Handles peer connection setup, offer/answer exchange,
 * and ICE candidate handling between two users.
 */
export function useWebRTC({ sendSignal, isOfferer }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const [started, setStarted] = useState(false);

  const pendingCandidates = useRef([]);

  // ✅ Safe wrapper to send signaling messages
  const safeSend = useCallback(
    (type, data) => {
      if (typeof sendSignal !== 'function') {
        console.warn(`⚠️ Tried to send before signaling ready: ${type}`);
        return;
      }
      console.log(`📤 Sending ${type}`);
      sendSignal(type, data);
    },
    [sendSignal]
  );

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

    // Local media setup
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play?.().catch(() => {});
        }
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        console.log('✅ Local media ready');
      })
      .catch((err) => {
        console.error('❌ Failed to access camera/mic:', err);
      });

    // Remote track
    pc.ontrack = (event) => {
      console.log('🎥 Remote track received');
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        remoteVideoRef.current.play?.().catch(() => {});
      }
    };

    // Send ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        safeSend('candidate', event.candidate);
      } else {
        console.log('✅ ICE candidate gathering complete');
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('🔗 Connection state:', pc.connectionState);
    };

    setStarted(true);
    return () => pc.close();
  }, [safeSend]);

  // Handle incoming signaling messages
  const handleSignal = async ({ type, data }) => {
    const pc = pcRef.current;
    if (!pc) return;

    switch (type.toLowerCase()) {
      case 'offer': {
        console.log('📩 Offer received');
        await pc.setRemoteDescription(new RTCSessionDescription(data));

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        safeSend('answer', answer);

        // Apply queued ICE candidates
        for (const c of pendingCandidates.current) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(c));
          } catch (err) {
            console.warn('ICE apply failed:', err);
          }
        }
        pendingCandidates.current = [];
        break;
      }

      case 'answer': {
        console.log('📩 Answer received');
        await pc.setRemoteDescription(new RTCSessionDescription(data));

        // Apply queued ICE candidates
        for (const c of pendingCandidates.current) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(c));
          } catch (err) {
            console.warn('ICE apply failed:', err);
          }
        }
        pendingCandidates.current = [];
        break;
      }

      case 'candidate': {
        console.log('📩 Candidate received');
        const candidate = new RTCIceCandidate(data);
        if (pc.remoteDescription) {
          await pc.addIceCandidate(candidate);
        } else {
          console.log('🧊 Queued ICE candidate');
          pendingCandidates.current.push(candidate);
        }
        break;
      }

      default:
        console.log(`ℹ️ Unknown signal type: ${type}`);
    }
  };

  // Offerer creates the offer
  useEffect(() => {
    if (!isOfferer || !started) return;

    const pc = pcRef.current;
    const createOffer = async () => {
      console.log('🧠 Creating and sending offer...');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      safeSend('offer', offer);
    };

    // Slight delay to ensure signaling connection is ready
    const timeout = setTimeout(createOffer, 1000);
    return () => clearTimeout(timeout);
  }, [isOfferer, started, safeSend]);

  return { localVideoRef, remoteVideoRef, handleSignal };
}
