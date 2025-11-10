'use client';
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  StreamVideoClient,
  StreamCall,
  StreamVideo,
  ParticipantView,
  useCallStateHooks,
} from '@stream-io/video-react-sdk';
import axios from 'axios';

export default function StreamCallRoom() {
  const { roomId } = useParams();
  const [client, setClient] = useState(null);
  const [call, setCall] = useState(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [status, setStatus] = useState('🔄 Initializing...');

  useEffect(() => {
    if (!roomId) return;
    let streamClient, callInstance;
    const username = `user-${Math.floor(Math.random() * 10000)}`;

    (async () => {
      try {
        console.log(`🚀 Joining Stream call: ${roomId} as ${username}`);
        setStatus('📡 Fetching token...');

        // 1️⃣ Fetch Stream token from backend
        const res = await axios.get(`/api/stream/token?user_id=${encodeURIComponent(username)}`);
        const token = res.data?.token;
        if (!token) throw new Error('❌ No token received from backend');
        console.log('✅ Token fetched successfully');

        // 2️⃣ Initialize Stream client
        console.log('🔑 Stream API Key:', process.env.NEXT_PUBLIC_STREAM_API_KEY);
        if (!process.env.NEXT_PUBLIC_STREAM_API_KEY) throw new Error('❌ Stream API key missing!');
        setStatus('🧠 Connecting to Stream...');

        streamClient = new StreamVideoClient({
          apiKey: process.env.NEXT_PUBLIC_STREAM_API_KEY,
          options: { disable_location_hint: true },
        });

        // 3️⃣ Connect user
        console.log('🧠 Connecting user...');
        await streamClient.connectUser({ id: username, name: username }, token);
        console.log('✅ Stream user connected');
        setStatus('🔗 User connected to Stream');

        // 4️⃣ Join or create call
        console.log('📞 Creating/joining call:', roomId);
        setStatus('🎥 Joining call...');
        callInstance = streamClient.call('default', roomId);
        await callInstance.join({ create: true });
        console.log('🎬 Joined call successfully');

        // ✅ Done
        setClient(streamClient);
        setCall(callInstance);
        setIsConnecting(false);
        setStatus('✅ Connected to meeting');

        // Optional: Timeout if stuck
        setTimeout(() => {
          if (isConnecting) {
            console.warn('⚠️ Stream connection taking too long...');
            setIsConnecting(false);
            setStatus('⚠️ Connection timeout');
          }
        }, 15000);
      } catch (err) {
        console.error('❌ Stream init error:', err);
        setStatus(`❌ ${err.message}`);
        setIsConnecting(false);
      }
    })();

    // Cleanup on unmount
    return () => {
      (async () => {
        try {
          console.log('🧹 Disconnecting Stream client...');
          await callInstance?.leave();
          await streamClient?.disconnectUser();
        } catch (e) {
          console.warn('⚠️ Cleanup failed:', e);
        }
      })();
    };
  }, [roomId]);

  // Loading / error UI
  if (isConnecting) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-gray-300 space-y-3">
        <div className="animate-pulse text-lg">{status}</div>
        <div className="text-sm opacity-70">(Check browser console for more details)</div>
      </div>
    );
  }

  if (!client || !call) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-red-500 text-lg">
        Failed to connect to Stream.
      </div>
    );
  }

  // Main UI
  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <div className="relative flex items-center justify-center min-h-screen bg-black">
          {/* Remote participant */}
          <div className="relative w-[90vw] md:w-[70vw] aspect-video bg-gray-900 rounded-lg overflow-hidden border border-gray-700 flex items-center justify-center">
            <RemoteParticipant />
          </div>

          {/* Local participant (PiP) */}
          <div className="absolute bottom-6 right-6 w-40 h-28 rounded overflow-hidden border border-gray-700 bg-gray-900 z-10">
            <LocalParticipant />
          </div>
        </div>
      </StreamCall>
    </StreamVideo>
  );
}

// === Local & Remote Video Components ===
function RemoteParticipant() {
  const { useParticipants } = useCallStateHooks();
  const participants = useParticipants();
  const remote = participants.find((p) => !p.isLocalParticipant);

  if (!remote)
    return <p className="text-gray-400 text-lg">Waiting for the other participant...</p>;

  return <ParticipantView participant={remote} className="w-full h-full object-cover" />;
}

function LocalParticipant() {
  const { useLocalParticipant } = useCallStateHooks();
  const local = useLocalParticipant();

  if (!local)
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
        Camera not active
      </div>
    );

  return <ParticipantView participant={local} className="w-full h-full object-cover" />;
}
