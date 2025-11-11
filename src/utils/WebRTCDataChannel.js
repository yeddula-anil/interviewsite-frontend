import { useEffect, useRef, useState, useCallback } from 'react';
import { Client as StompClient } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import axiosInstance from './axiosInstance';

export function useWebRTCDataChannel(meetingId, username) {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [code, setCode] = useState('');

  const pcRef = useRef(null);
  const dcRef = useRef(null);
  const stompRef = useRef(null);
  const isOffererRef = useRef(false);
  const nameRef = useRef(username || `User-${Math.floor(Math.random() * 9999)}`);

  const pushMessage = useCallback((msg) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const RTC_CONFIG = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  };

  const sendSignal = useCallback(
    (type, data) => {
      if (!stompRef.current?.connected) return;
      const msg = {
        type,
        data,
        sender: nameRef.current,
        role: 'participant',
      };
      stompRef.current.publish({
        destination: `/app/signal/${meetingId}`,
        body: JSON.stringify(msg),
      });
    },
    [meetingId]
  );

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
    channel.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'chat') pushMessage({ sender: data.sender, text: data.text });
        else if (data.type === 'code') setCode(data.code);
      } catch {
        pushMessage({ sender: 'remote', text: e.data });
      }
    };
  };

  const createPeerConnection = useCallback(() => {
    if (pcRef.current) return pcRef.current;
    const pc = new RTCPeerConnection(RTC_CONFIG);

    pc.onicecandidate = (event) => {
      if (event.candidate) sendSignal('candidate', event.candidate);
    };
    pc.ondatachannel = (event) => setupDataChannel(event.channel);

    pcRef.current = pc;
    return pc;
  }, [sendSignal]);

  const handleSignal = useCallback(
    async (message) => {
      if (!message.body) return;
      const data = JSON.parse(message.body);
      if (data.sender === nameRef.current) return;

      const pc = createPeerConnection();

      switch (data.type) {
        case 'offer':
          console.log('📡 Received offer → sending answer...');
          await pc.setRemoteDescription(new RTCSessionDescription(data.data));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignal('answer', pc.localDescription);
          break;

        case 'answer':
          console.log('📡 Received answer → completing connection...');
          await pc.setRemoteDescription(new RTCSessionDescription(data.data));
          break;

        case 'candidate':
          try {
            if (data.data?.sdpMid && data.data?.sdpMLineIndex !== null) {
              await pc.addIceCandidate(new RTCIceCandidate(data.data));
            }
          } catch (err) {
            console.warn('⚠️ Failed to add ICE candidate', err);
          }
          break;

        default:
          break;
      }
    },
    [createPeerConnection, sendSignal]
  );

  useEffect(() => {
    if (!meetingId) return;

    (async () => {
      try {
        const res = await axiosInstance.post(`/rooms/${meetingId}/join`, {
          name: nameRef.current,
          role: 'participant',
        });
        isOffererRef.current = !!res.data?.isOfferer;

        console.log(
          isOffererRef.current
            ? '🟢 Acting as Offerer (first user)'
            : '🟣 Acting as Answerer (second user)'
        );

        const stomp = new StompClient({
          webSocketFactory: () => new SockJS(`${process.env.NEXT_PUBLIC_API_URL}/ws`),
          reconnectDelay: 3000,
        });

        stomp.onConnect = async () => {
          console.log('✅ Connected to signaling server');
          stomp.subscribe(`/topic/signal/${meetingId}`, handleSignal);

          const pc = createPeerConnection();

          if (isOffererRef.current) {
            console.log('🟢 Creating offer...');
            const dataChannel = pc.createDataChannel('code-chat');
            setupDataChannel(dataChannel);

            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            sendSignal('offer', pc.localDescription);
          }
        };

        stomp.activate();
        stompRef.current = stomp;
      } catch (err) {
        console.error('❌ WebRTC init error', err);
      }
    })();

    return () => {
      stompRef.current?.deactivate();
      dcRef.current?.close();
      pcRef.current?.close();
      try {
        axiosInstance.post(`/rooms/${meetingId}/leave`, {
          name: nameRef.current,
        });
      } catch {}
    };
  }, [meetingId, createPeerConnection, handleSignal]);

  const sendChat = (text) => {
    if (!text.trim()) return;
    const msg = { type: 'chat', sender: nameRef.current, text };
    if (dcRef.current?.readyState === 'open') dcRef.current.send(JSON.stringify(msg));
    pushMessage({ sender: nameRef.current, text });
  };

  const sendCode = (value) => {
    const msg = { type: 'code', sender: nameRef.current, code: value };
    if (dcRef.current?.readyState === 'open') dcRef.current.send(JSON.stringify(msg));
  };

  return { connected, messages, code, setCode, sendChat, sendCode };
}
