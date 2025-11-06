'use client';
import { useEffect, useRef, useState } from 'react';

export function useWebRTC({ sendSignal, isOfferer }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pcRef = useRef(null);
  const [started, setStarted] = useState(false);
  const pendingCandidates = useRef([]);

  // Initialize peer connection safely
  useEffect(() => {
    if (pcRef.current) return; // prevent duplicate

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

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play?.().catch(() => {});
        }
        stream.getTracks().forEach((track) => {
          if (pcRef.current) pcRef.current.addTrack(track, stream);
        });
        console.log('✅ Local media ready');
      })
      .catch((err) => {
        console.error('❌ Failed to get user media:', err);
      });

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
        remoteVideoRef.current.play?.().catch(() => {});
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && sendSignal) {
        sendSignal('candidate', event.candidate);
      }
    };

    pc.onconnectionstatechange = () =>
      console.log('🔗 Connection state:', pc.connectionState);

    setStarted(true);

    return () => {
      pcRef.current?.close();
      pcRef.current = null;
    };
  }, [sendSignal]);

  const handleSignal = async (msg) => {
    const pc = pcRef.current;
    if (!pc) {
      console.warn('⚠️ handleSignal called before pcRef ready');
      return;
    }

    const { type, data } = msg;
    if (!type) return;

    switch (type.toLowerCase()) {
      case 'offer':
        await pc.setRemoteDescription(new RTCSessionDescription(data));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendSignal('answer', answer);
        break;
      case 'answer':
        await pc.setRemoteDescription(new RTCSessionDescription(data));
        break;
      case 'candidate':
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(data));
        } else {
          pendingCandidates.current.push(data);
        }
        break;
    }
  };

  // Create offer when ready
  useEffect(() => {
    if (!isOfferer || !started) return;
    const pc = pcRef.current;
    if (!pc) return;

    const makeOffer = async () => {
      console.log('🧠 Creating offer...');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sendSignal('offer', offer);
    };

    setTimeout(makeOffer, 800);
  }, [isOfferer, started, sendSignal]);

  return { localVideoRef, remoteVideoRef, handleSignal };
}
