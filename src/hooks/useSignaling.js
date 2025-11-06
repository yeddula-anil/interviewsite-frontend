'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';

/**
 * Signaling Hook (STOMP over SockJS)
 * - Subscribes to /topic/signal/{roomId}
 * - Exposes send(type, data)
 * - Emits onMessage for messages from other peers
 * - Sends a `join` message after connected
 */
export function useSignaling({ roomId, userName, onMessage }) {
  const [connected, setConnected] = useState(false);
  const stompClient = useRef(null);
  const connectedRef = useRef(false);
  const joinedRef = useRef(false);

  const wsUrl = `${process.env.NEXT_PUBLIC_API_URL}/ws`;

  const send = useCallback((type, data) => {
    if (!connectedRef.current || !stompClient.current?.connected) {
      console.warn('[useSignaling] Tried to send before connected:', type);
      return;
    }
    const payload = { type: String(type || '').toLowerCase(), data, sender: userName };
    stompClient.current.publish({
      destination: `/app/signal/${roomId}`,
      body: JSON.stringify(payload),
    });
  }, [roomId, userName]);

  useEffect(() => {
  if (!roomId || !userName) return;

  if (stompClient.current && connectedRef.current) return; // already connected

  const socket = new SockJS(wsUrl);
  const client = new Client({
    webSocketFactory: () => socket,
    reconnectDelay: 5000,
    debug: (msg) => console.log('[STOMP]', msg),
    onConnect: () => {
      connectedRef.current = true;
      setConnected(true);

      client.subscribe(`/topic/signal/${roomId}`, (frame) => {
        try {
          const msg = JSON.parse(frame.body);
          if (msg.sender === userName) return;
          onMessage?.(msg);
        } catch (e) {
          console.error('[useSignaling] Invalid message:', e);
        }
      });

      if (!joinedRef.current) {
        joinedRef.current = true;
        send('join', { name: userName });
      }
    },
    onWebSocketError: (e) => console.error('[STOMP] WebSocket error:', e),
    onStompError: (frame) => console.error('[STOMP] Error:', frame?.headers?.message),
  });

  stompClient.current = client;
  client.activate();

  // cleanup only when unmounting
  return () => {
    connectedRef.current = false;
    setConnected(false);
    joinedRef.current = false;
    try {
      client.deactivate();
    } catch (err) {
      console.warn('Error deactivating STOMP client:', err);
    }
  };
}, [roomId]); // remove userName and send from dependencies


  return { connected, send };
}
