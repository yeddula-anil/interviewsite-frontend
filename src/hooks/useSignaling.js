'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';

/**
 * Signaling Hook (STOMP over SockJS)
 * - Subscribes to /topic/signal/{roomId}
 * - Exposes send(type, data) and disconnect()
 * - Emits onMessage for messages from other peers
 * - Sends a `join` message after connected
 */
export function useSignaling({ roomId, userName, onMessage }) {
  const [connected, setConnected] = useState(false);

  const stompClient = useRef(null);
  const subscriptionRef = useRef(null);
  const connectedRef = useRef(false);
  const joinedRef = useRef(false);
  const activatedRef = useRef(false); // prevent double activate in Next dev/hot reload

  const wsUrl = `${process.env.NEXT_PUBLIC_API_URL}/ws`;

  const send = useCallback((type, data) => {
    const client = stompClient.current;
    if (!connectedRef.current || !client?.connected) {
      console.warn('[useSignaling] Dropped send (not connected):', type, data);
      return;
    }
    const payload = {
      type: String(type || '').toLowerCase(), // backend normalizes to UPPER; we handle case-insensitively in the app
      data,
      sender: userName,
      ts: Date.now(),
    };
    try {
      client.publish({
        destination: `/app/signal/${roomId}`,
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error('[useSignaling] publish failed:', err);
    }
  }, [roomId, userName]);

  const disconnect = useCallback(async () => {
    const client = stompClient.current;
    if (!client) return;
    try {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
      connectedRef.current = false;
      setConnected(false);
      joinedRef.current = false;
      activatedRef.current = false;
      await client.deactivate(); // graceful DISCONNECT
    } catch (err) {
      console.warn('[useSignaling] deactivate error:', err);
    } finally {
      stompClient.current = null;
    }
  }, []);

  useEffect(() => {
    if (!roomId || !userName) return;
    if (activatedRef.current) return; // already activated in this mount

    const socket = new SockJS(wsUrl);
    const client = new Client({
      webSocketFactory: () => socket,
      // Heartbeats help keep managed proxies/load balancers happy
      heartbeatIncoming: 10000, // expect server heartbeats
      heartbeatOutgoing: 10000, // send heartbeats
      reconnectDelay: 5000,     // auto-reconnect
      debug: (msg) => console.log('[STOMP]', msg),

      onConnect: () => {
        connectedRef.current = true;
        setConnected(true);

        // Subscribe first (avoid offer race)
        subscriptionRef.current = client.subscribe(`/topic/signal/${roomId}`, (frame) => {
          try {
            const msg = JSON.parse(frame.body);
            if (msg.sender === userName) return; // ignore own echoes
            onMessage?.(msg);
          } catch (e) {
            console.error('[useSignaling] Invalid JSON from broker:', e, frame?.body);
          }
        });

        // Then announce presence
        if (!joinedRef.current) {
          joinedRef.current = true;
          send('join', { name: userName });
        }
      },

      onWebSocketError: (e) => {
        console.error('[STOMP] WebSocket error:', e);
      },

      onStompError: (frame) => {
        console.error('[STOMP] Broker error:', frame?.headers?.message, frame?.body);
      },

      onDisconnect: () => {
        console.log('[STOMP] Disconnected');
      }
    });

    stompClient.current = client;
    activatedRef.current = true;
    client.activate();

    // Clean up on unmount
    return () => {
      disconnect();
    };
  }, [roomId, userName, wsUrl, onMessage, send, disconnect]);

  return { connected, send, disconnect };
}
