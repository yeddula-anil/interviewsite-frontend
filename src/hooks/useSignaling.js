'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';

/**
 * useSignaling — Handles STOMP WebSocket signaling for WebRTC.
 */
export function useSignaling({ roomId, userName, onMessage }) {
  const [connected, setConnected] = useState(false);
  const stompClient = useRef(null);
  const connectedRef = useRef(false);
  const wsUrl = `${process.env.NEXT_PUBLIC_API_URL}/ws`;

  // ---- Send message ----
  const send = useCallback(
    (type, data) => {
      if (!connectedRef.current || !stompClient.current) {
        console.warn('[Signaling] Not connected, cannot send');
        return;
      }
      const payload = { type, data, sender: userName };
      try {
        stompClient.current.publish({
          destination: `/app/signal/${roomId}`,
          body: JSON.stringify(payload),
        });
      } catch (err) {
        console.error('[Signaling] Publish failed:', err);
      }
    },
    [roomId, userName]
  );

  useEffect(() => {
    if (!roomId || !userName) return;

    // Prevent duplicate connections
    if (stompClient.current && connectedRef.current) {
      console.log('[Signaling] Already connected — skipping re-init');
      return;
    }

    console.log(`[Signaling] Connecting to room ${roomId} as ${userName}`);

    const socket = new SockJS(wsUrl);
    const client = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 3000, // retry every 3s
      onConnect: () => {
        connectedRef.current = true;
        setConnected(true);
        console.log('✅ STOMP connected');
        client.subscribe(`/topic/signal/${roomId}`, (frame) => {
          try {
            const msg = JSON.parse(frame.body);
            if (msg.sender === userName) return;
            // Safe reference capture (won’t break even if onMessage changes)
            if (typeof onMessage === 'function') onMessage(msg);
          } catch (e) {
            console.error('[Signaling] Invalid message', e);
          }
        });
      },
      onDisconnect: () => {
        console.log('❌ STOMP disconnected');
        connectedRef.current = false;
        setConnected(false);
      },
      onStompError: (frame) => {
        console.error('[STOMP ERROR]', frame.headers['message'], frame.body);
      },
      onWebSocketError: (err) => {
        console.error('[WebSocket Error]', err);
      },
    });

    stompClient.current = client;
    client.activate();

    // Cleanup
    return () => {
      console.log('[Signaling] Cleaning up connection');
      connectedRef.current = false;
      setConnected(false);
      if (stompClient.current) {
        try {
          stompClient.current.deactivate();
          stompClient.current = null;
        } catch (e) {
          console.warn('[Signaling] Error during cleanup', e);
        }
      }
    };
  // ⛔ Removed onMessage from dependencies
  }, [roomId, userName, wsUrl]);

  return { connected, send };
}
