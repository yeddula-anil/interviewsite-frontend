'use client';
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { StreamVideoClient, StreamCall, StreamVideo, ParticipantView } from '@stream-io/video-react-sdk';
import axios from 'axios';

export default function StreamCallRoom() {
  const { roomId } = useParams();
  const [client, setClient] = useState(null);
  const [call, setCall] = useState(null);
  const [isConnecting, setIsConnecting] = useState(true);

  useEffect(() => {
    if (!roomId) return;

    let streamClient, callInstance;
    const username = `user-${Math.floor(Math.random() * 10000)}`;

    (async () => {
      try {
        console.log(`🚀 Joining Stream call: ${roomId} as ${username}`);

        // 1️⃣ Fetch Stream token from backend
        const res = await axios.get(`/api/stream/token?user_id=${encodeURIComponent(username)}`);
        const token = res.data?.token;
        if (!token) throw new Error('❌ No token received from backend');

        // 2️⃣ Init Stream client
        streamClient = new StreamVideoClient({
          apiKey: process.env.NEXT_PUBLIC_STREAM_API_KEY,
          options: { disable_location_hint: true }, // Fix region mismatch issues
        });

        // 3️⃣ Connect user
        await streamClient.connectUser({ id: username, name: username }, token);
        console.log('✅ Stream user connected');

        // 4️⃣ Join or create call
        callInstance = streamClient.call('default', roomId);
        await callInstance.join({ create: true });
        console.log('🎥 Joined call:', roomId);

        setClient(streamClient);
        setCall(callInstance);
        setIsConnecting(false);
      } catch (err) {
        console.error('❌ Stream init error:', err);
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
        } catch {}
      })();
    };
  }, [roomId]);

  if (isConnecting) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-400 text-lg bg-black">
        Connecting to meeting...
      </div>
    );
  }

  if (!client || !call) {
    return (
      <div className="flex items-center justify-center min-h-screen text-red-500 bg-black">
        Failed to connect to Stream.
      </div>
    );
  }

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <div className="flex flex-col md:flex-row justify-center items-center min-h-screen bg-black gap-4">
          {/* Remote Participant */}
          <div className="relative w-[90vw] md:w-[60vw] aspect-video bg-gray-900 rounded-lg overflow-hidden border border-gray-700 flex items-center justify-center">
            <RemoteParticipant />
          </div>

          {/* Local Participant (PiP style) */}
          <div className="absolute bottom-4 right-4 w-40 h-28 rounded overflow-hidden border border-gray-600 bg-gray-900 z-10">
            <LocalParticipant />
          </div>
        </div>
      </StreamCall>
    </StreamVideo>
  );
}

// === Local & Remote Video Components ===
import { useCallStateHooks } from '@stream-io/video-react-sdk';

function RemoteParticipant() {
  const { useParticipants } = useCallStateHooks();
  const participants = useParticipants();
  const remote = participants.find((p) => !p.isLocalParticipant);

  if (!remote)
    return <p className="text-gray-400 text-lg">Waiting for other participant...</p>;

  return <ParticipantView participant={remote} className="w-full h-full object-cover" />;
}

function LocalParticipant() {
  const { useLocalParticipant } = useCallStateHooks();
  const local = useLocalParticipant();

  if (!local)
    return <div className="w-full h-full flex items-center justify-center text-gray-400">No Camera</div>;

  return <ParticipantView participant={local} className="w-full h-full object-cover" />;
}
