import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * ⚡ useWebRTCDataChannel — Final stable version
 * - No camera/mic
 * - Uses only WebRTC DataChannel for code & chat
 * - Robust handshake (offer/answer/candidate)
 * - Works with Spring Boot STOMP signaling (/signal/{roomId})
 */
export function useWebRTC({ signaling, isOfferer, onMessage, onConnectionChange }) {
  const pcRef = useRef(null);
  const dcRef = useRef(null);

  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [code, setCode] = useState('');
  const [ready, setReady] = useState(false);

  const remoteDescSetRef = useRef(false);
  const candidateQueueRef = useRef([]);

  // Utility to push messages into local state
  const pushMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  // Safe send over signaling
  const safeSend = useCallback(
    (type, data) => {
      signaling?.send?.(type, data);
    },
    [signaling]
  );

  // Setup PeerConnection
  useEffect(() => {
    if (pcRef.current) return;

    console.log('🎬 Initializing WebRTC DataChannel...');
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) safeSend('candidate', event.candidate);
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log('🔗 Connection state:', state);
      onConnectionChange?.(state);
      if (state === 'connected') setConnected(true);
      if (['disconnected', 'failed', 'closed'].includes(state)) setConnected(false);
    };

    pc.ondatachannel = (event) => {
      console.log('📡 DataChannel received from remote peer');
      const channel = event.channel;
      setupDataChannel(channel);
    };

    pcRef.current = pc;
    setReady(true);
  }, [safeSend, onConnectionChange]);

  // Setup local DataChannel
  const setupDataChannel = (channel) => {
    dcRef.current = channel;

    channel.onopen = () => {
      console.log('🟢 DataChannel connected');
      setConnected(true);
    };

    channel.onclose = () => {
      console.log('🔴 DataChannel disconnected');
      setConnected(false);
    };

    channel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'chat') {
          pushMessage({ sender: data.sender, text: data.text });
        } else if (data.type === 'code') {
          setCode(data.code);
        }
        onMessage?.(data);
      } catch (err) {
        pushMessage({ sender: 'remote', text: event.data });
      }
    };
  };

  // Handle incoming signaling messages
  const handleSignal = useCallback(
    async ({ type, data }) => {
      const pc = pcRef.current;
      if (!pc) return;

      switch ((type || '').toLowerCase()) {
        case 'offer': {
          console.log('📩 Offer received');
          await pc.setRemoteDescription(new RTCSessionDescription(data));
          remoteDescSetRef.current = true;

          // flush queued ICE
          for (const c of candidateQueueRef.current) {
            try {
              await pc.addIceCandidate(c);
            } catch (err) {
              console.warn('ICE add (queued) failed:', err);
            }
          }
          candidateQueueRef.current = [];

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          safeSend('answer', answer);
          break;
        }

        case 'answer': {
          console.log('📩 Answer received');
          await pc.setRemoteDescription(new RTCSessionDescription(data));
          remoteDescSetRef.current = true;

          for (const c of candidateQueueRef.current) {
            try {
              await pc.addIceCandidate(c);
            } catch (err) {
              console.warn('ICE add (queued) failed:', err);
            }
          }
          candidateQueueRef.current = [];
          break;
        }

        case 'candidate': {
          const cand = new RTCIceCandidate(data);
          if (!remoteDescSetRef.current) {
            candidateQueueRef.current.push(cand);
            console.log(`🧊 Queued ICE (${candidateQueueRefRef.current.length})`);
          } else {
            try {
              await pc.addIceCandidate(cand);
            } catch (err) {
              console.warn('ICE add failed:', err);
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

  // Start connection if offerer
  const start = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !ready) {
      console.log('⏳ Waiting for PC readiness...');
      setTimeout(start, 400);
      return;
    }

    if (!isOfferer) return;
    if (pc.signalingState !== 'stable') return;

    console.log('🧠 Creating DataChannel and offer...');
    const dataChannel = pc.createDataChannel('data');
    setupDataChannel(dataChannel);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    safeSend('offer', offer);
  }, [isOfferer, ready, safeSend]);

  // Senders
  const sendChat = (text, sender = 'Me') => {
    const msg = { type: 'chat', sender, text };
    if (dcRef.current?.readyState === 'open') {
      dcRef.current.send(JSON.stringify(msg));
    }
    pushMessage({ sender, text });
  };

  const sendCode = (newCode, sender = 'Me') => {
    const msg = { type: 'code', sender, code: newCode };
    if (dcRef.current?.readyState === 'open') {
      dcRef.current.send(JSON.stringify(msg));
    }
    setCode(newCode);
  };

  return {
    connected,
    handleSignal,
    start,
    sendChat,
    sendCode,
    messages,
    code,
    setCode,
  };
}
