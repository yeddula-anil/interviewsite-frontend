'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

export function useWebRTC({ signaling, isOfferer }) {
  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [code, setCode] = useState('// Start coding...\n');
  const remoteDescSet = useRef(false);

  const safeSendSignal = useCallback((type, data) => {
    if (!signaling?.send) return;
    signaling.send(type, data);
  }, [signaling]);

  useEffect(() => {
    console.log('🧠 Initializing WebRTC...');
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    pcRef.current = pc;

    if (isOfferer) {
      console.log('🟢 Acting as Offerer');
      const dc = pc.createDataChannel('data');
      setupChannel(dc);
    } else {
      console.log('🟠 Acting as Answerer');
      pc.ondatachannel = (e) => setupChannel(e.channel);
    }

    pc.onicecandidate = (e) => {
      if (e.candidate) safeSendSignal('candidate', e.candidate);
    };

    function setupChannel(channel) {
      dcRef.current = channel;
      channel.onopen = () => console.log('✅ DataChannel open');
      channel.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'chat') setMessages((p) => [...p, msg.payload]);
        if (msg.type === 'code') setCode(msg.payload);
      };
    }

    return () => {
      pc.close();
      console.log('🧹 Closed WebRTC');
    };
  }, [isOfferer, safeSendSignal]);

  const handleSignal = useCallback(async ({ type, data }) => {
    const pc = pcRef.current;
    if (!pc) return;

    switch (type) {
      case 'offer':
        await pc.setRemoteDescription(new RTCSessionDescription(data));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        safeSendSignal('answer', answer);
        break;
      case 'answer':
        await pc.setRemoteDescription(new RTCSessionDescription(data));
        remoteDescSet.current = true;
        break;
      case 'candidate':
        const cand = new RTCIceCandidate(data);
        await pc.addIceCandidate(cand);
        break;
    }
  }, [safeSendSignal]);

  const start = useCallback(async () => {
    if (!isOfferer) return;
    const pc = pcRef.current;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    safeSendSignal('offer', offer);
  }, [isOfferer, safeSendSignal]);

  const sendChat = (text, sender) => {
    if (dcRef.current?.readyState === 'open') {
      const msg = { id: Date.now(), sender, text };
      dcRef.current.send(JSON.stringify({ type: 'chat', payload: msg }));
      setMessages((prev) => [...prev, msg]);
    }
  };

  const sendCode = (codeText) => {
    if (dcRef.current?.readyState === 'open') {
      dcRef.current.send(JSON.stringify({ type: 'code', payload: codeText }));
    }
  };

  return { handleSignal, start, messages, sendChat, code, sendCode, setCode };
}
