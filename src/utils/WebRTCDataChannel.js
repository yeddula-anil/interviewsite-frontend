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

  // --- ICE Config ---
  const RTC_CONFIG = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  // --- Send signaling message via STOMP ---
  const sendSignal = useCallback(
    (payload) => {
      if (!stompRef.current?.connected) return;
      stompRef.current.publish({
        destination: `/app/signal/${meetingId}`,
        body: JSON.stringify(payload),
      });
    },
    [meetingId]
  );

  // --- Create PeerConnection ---
  const createPeerConnection = useCallback(() => {
    if (pcRef.current) return pcRef.current;
    const pc = new RTCPeerConnection(RTC_CONFIG);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal({
          type: 'candidate',
          candidate: event.candidate,
          sender: nameRef.current,
        });
      }
    };

    pc.ondatachannel = (event) => {
      const channel = event.channel;
      dcRef.current = channel;
      setupDataChannel(channel);
    };

    pcRef.current = pc;
    return pc;
  }, [sendSignal]);

  // --- DataChannel setup ---
  const setupDataChannel = (channel) => {
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
      } catch {
        pushMessage({ sender: 'remote', text: event.data });
      }
    };
  };

  // --- Send chat + code ---
  const sendChat = (text) => {
    const msg = { type: 'chat', sender: nameRef.current, text };
    if (dcRef.current?.readyState === 'open') {
      dcRef.current.send(JSON.stringify(msg));
    }
    pushMessage({ sender: nameRef.current, text });
  };

  const sendCode = (codeValue) => {
    const msg = { type: 'code', sender: nameRef.current, code: codeValue };
    if (dcRef.current?.readyState === 'open') {
      dcRef.current.send(JSON.stringify(msg));
    }
  };

  // --- Handle incoming signaling messages ---
  const handleSignal = useCallback(
    async (message) => {
      if (!message.body) return;
      const data = JSON.parse(message.body);

      // Ignore messages from self
      if (data.sender === nameRef.current) return;

      const pc = createPeerConnection();

      switch (data.type?.toLowerCase()) {
        case 'offer': {
          console.log('📡 Received offer → Sending answer...');
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignal({
            type: 'answer',
            sdp: pc.localDescription,
            sender: nameRef.current,
          });
          break;
        }

        case 'answer': {
          console.log('📡 Received answer → Completing connection...');
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          break;
        }

        case 'candidate': {
          try {
            if (data.candidate?.sdpMid && data.candidate?.sdpMLineIndex !== null) {
              await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            }
          } catch (err) {
            console.warn('⚠️ Failed to add ICE candidate', err);
          }
          break;
        }

        default:
          break;
      }
    },
    [createPeerConnection, sendSignal]
  );

  // --- Initialize WebRTC + STOMP ---
  useEffect(() => {
    if (!meetingId) return;

    (async () => {
      try {
        // 1️⃣ Join room
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

        // 2️⃣ Connect STOMP
        const stomp = new StompClient({
          webSocketFactory: () => new SockJS(`${process.env.NEXT_PUBLIC_API_URL}/ws`),
          reconnectDelay: 3000,
        });

        stomp.onConnect = async () => {
          console.log('✅ Connected to signaling server');
          stomp.subscribe(`/topic/signal/${meetingId}`, handleSignal);

          const pc = createPeerConnection();

          // --- If this user is offerer ---
          if (isOffererRef.current) {
            console.log('🟢 Acting as Offerer — waiting for second user before sending offer...');

            const checkForSecondUser = async () => {
              try {
                const res = await axiosInstance.get(`/rooms`);
                const roomData = res.data[meetingId];
                const count = roomData ? Object.keys(roomData).length : 0;

                if (count >= 2) {
                  console.log('👥 Second participant detected — sending offer now...');
                  const dataChannel = pc.createDataChannel('code-chat');
                  setupDataChannel(dataChannel);

                  const offer = await pc.createOffer({
                    offerToReceiveAudio: false,
                    offerToReceiveVideo: false,
                  });
                  await pc.setLocalDescription(offer);

                  sendSignal({
                    type: 'offer',
                    sdp: pc.localDescription,
                    sender: nameRef.current,
                  });
                } else {
                  setTimeout(checkForSecondUser, 1500);
                }
              } catch (err) {
                console.error('⚠️ Error checking participants:', err);
                setTimeout(checkForSecondUser, 1500);
              }
            };

            checkForSecondUser();
          }
        };

        stomp.activate();
        stompRef.current = stomp;
      } catch (err) {
        console.error('❌ WebRTC init error', err);
      }
    })();

    // --- Cleanup on leave ---
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

  return { connected, messages, code, setCode, sendChat, sendCode };
}
