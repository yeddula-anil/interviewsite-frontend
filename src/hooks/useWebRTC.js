'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

export function useWebRTC({ signaling, isOfferer }) {
  const pcRef = useRef(null);
  const dataChannelRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [code, setCode] = useState('// Start coding...\n');
  const remoteDescSetRef = useRef(false);
  const candidateQueueRef = useRef([]);

  const safeSendSignal = useCallback(
    (type, data) => {
      if (!signaling?.send) return console.warn('Signaling not ready');
      signaling.send(type, data);
    },
    [signaling]
  );

  useEffect(() => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });
    pcRef.current = pc;

    if (isOfferer) {
      const dc = pc.createDataChannel('data');
      setupDataChannel(dc);
    } else {
      pc.ondatachannel = (e) => setupDataChannel(e.channel);
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) safeSendSignal('candidate', event.candidate);
    };

    async function setupDataChannel(channel) {
      dataChannelRef.current = channel;

      channel.onopen = () => console.log('📡 Data channel open');
      channel.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'chat') setMessages((prev) => [...prev, msg.payload]);
        if (msg.type === 'code') setCode(msg.payload);
      };
    }

    return () => pc.close();
  }, [isOfferer, safeSendSignal]);

  // handle incoming signaling messages
  const handleSignal = useCallback(
    async ({ type, data }) => {
      const pc = pcRef.current;
      if (!pc) return;

      switch (type) {
        case 'offer': {
          await pc.setRemoteDescription(new RTCSessionDescription(data));
          remoteDescSetRef.current = true;
          if (candidateQueueRef.current.length) {
            for (const c of candidateQueueRef.current) await pc.addIceCandidate(c);
            candidateQueueRef.current = [];
          }
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          safeSendSignal('answer', answer);
          break;
        }

        case 'answer': {
          await pc.setRemoteDescription(new RTCSessionDescription(data));
          remoteDescSetRef.current = true;
          if (candidateQueueRef.current.length) {
            for (const c of candidateQueueRef.current) await pc.addIceCandidate(c);
            candidateQueueRef.current = [];
          }
          break;
        }

        case 'candidate': {
          const cand = new RTCIceCandidate(data);
          if (!remoteDescSetRef.current) candidateQueueRef.current.push(cand);
          else await pc.addIceCandidate(cand);
          break;
        }
      }
    },
    [safeSendSignal]
  );

  // Offerer starts connection
  const start = useCallback(async () => {
    const pc = pcRef.current;
    if (!isOfferer || !pc) return;

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    safeSendSignal('offer', offer);
  }, [isOfferer, safeSendSignal]);

  const sendChat = (text, sender) => {
    if (dataChannelRef.current?.readyState === 'open') {
      const msg = { id: Date.now(), sender, text };
      dataChannelRef.current.send(JSON.stringify({ type: 'chat', payload: msg }));
      setMessages((prev) => [...prev, msg]);
    }
  };

  const sendCode = (codeText) => {
    if (dataChannelRef.current?.readyState === 'open') {
      dataChannelRef.current.send(JSON.stringify({ type: 'code', payload: codeText }));
    }
  };

  return {
    handleSignal,
    start,
    messages,
    sendChat,
    code,
    sendCode,
    setCode,
  };
}
