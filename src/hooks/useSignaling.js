'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';

/**
 * useSignaling Hook
 * Handles STOMP WebSocket connection, message subscription, and safe send.
 */
export function useSignaling({ roomId, userName, onMessage }) {
  const [connected, setConnected] = useState(false);
  const stompClient = useRef(null);
  const connectedRef = useRef(false);
  const joinedRef = useRef(false);
  const connectPromiseRef = useRef(null); // ✅ for awaiting connection

  const wsUrl = `${process.env.NEXT_PUBLIC_API_URL}/ws`;

  // ✅ Safe send method (won’t fail silently)
  const send = useCallback(
    (type, data) => {
      if (!connectedRef.current || !stompClient.current?.connected) {
        console.warn('[useSignaling] Tried to send before connected:', type);
        return;
      }
      const payload = { type: String(type || '').toLowerCase(), data, sender: userName };
      stompClient.current.publish({
        destination: `/app/signal/${roomId}`,
        body: JSON.stringify(payload),
      });
    },
    [roomId, userName]
  );

  // ✅ Wait until STOMP is connected
  const waitForConnection = useCallback(async () => {
    if (connectedRef.current) return true;
    if (!connectPromiseRef.current) {
      connectPromiseRef.current = new Promise((resolve) => {
        const check = setInterval(() => {
          if (connectedRef.current && stompClient.current?.connected) {
            clearInterval(check);
            resolve(true);
          }
        }, 200);
      });
    }
    return connectPromiseRef.current;
  }, []);

  // ✅ STOMP setup
  useEffect(() => {
    if (!roomId || !userName) return;

    const socket = new SockJS(wsUrl);
    const client = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 3000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      debug: (msg) => console.log('[STOMP]', msg),

      onConnect: () => {
        console.log('✅ STOMP connected');
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

      onDisconnect: () => {
        console.warn('[STOMP] Disconnected');
        connectedRef.current = false;
        setConnected(false);
      },

      onWebSocketError: (e) => console.error('[STOMP] WebSocket error:', e),
      onStompError: (frame) => console.error('[STOMP] Error:', frame?.headers?.message),
    });

    stompClient.current = client;
    client.activate();

    return () => {
      console.log('[STOMP] Cleaning up connection...');
      try {
        client.deactivate();
      } catch {}
      connectedRef.current = false;
      joinedRef.current = false;
      setConnected(false);
      connectPromiseRef.current = null;
    };
  }, [roomId, userName, onMessage, wsUrl, send]);

  return { connected, send, waitForConnection };
}
