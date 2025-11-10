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
  const [status, setStatus] = useState('🔄 Waiting for initialization...');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!roomId) {
      console.warn('⚠️ No roomId found in URL.');
      setStatus('⚠️ No room ID provided.');
      return;
    }

    console.log(`📞 Room detected: ${roomId}`);
    let streamClient, callInstance;
    const username = `user-${Math.floor(Math.random() * 10000)}`;

    const init = async () => {
      try {
        setStatus('📡 Fetching Stream token...');
        console.log('🔍 Requesting token for:', username);

        // === STEP 1: Fetch token ===
        const res = await axios.get(`/api/stream/token?user_id=${encodeURIComponent(username)}`);
        console.log('🧾 Token Response:', res.data);
        const token = res.data?.token;
        if (!token) throw new Error('No token returned from backend');
        setStatus('✅ Token fetched successfully');

        // === STEP 2: Init Stream client ===
        const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
        console.log('🔑 Stream API Key:', apiKey);
        if (!apiKey) throw new Error('Missing Stream API Key in env');

        setStatus('🧠 Initializing Stream client...');
        streamClient = new StreamVideoClient({
          apiKey,
          options: { disable_location_hint: true },
        });

        // === STEP 3: Connect user ===
        setStatus('👤 Connecting user to Stream...');
        console.log('🧠 Connecting user...');
        await streamClient.connectUser({ id: username, name: username }, token);
        console.log('✅ User connected to Stream');
        setStatus('✅ Stream user connected');

        // === STEP 4: Join or create call ===
        setStatus('🎥 Joining Stream call...');
        callInstance = streamClient.call('default', roomId);
        await callInstance.join({ create: true });
        console.log('🎬 Joined Stream call successfully');

        setClient(streamClient);
        setCall(callInstance);
        setStatus('✅ Connected to meeting');
      } catch (err) {
        console.error('❌ Stream init error:', err);
        setError(err.message);
        setStatus('❌ Failed to initialize');
      }
    };

    init();

    // Cleanup on unmount
    return () => {
      (async () => {
        try {
          console.log('🧹 Cleaning up Stream session...');
          await callInstance?.leave();
          await streamClient?.disconnectUser();
        } catch (err) {
          console.warn('⚠️ Cleanup error:', err);
        }
      })();
    };
  }, [roomId]);

  // === UI States ===
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-red-500 space-y-3">
        <p className="text-xl font-semibold">❌ Stream Initialization Failed</p>
        <p>{error}</p>
        <p className="text-gray-400">Check browser console for details.</p>
      </div>
    );
  }

  if (!client || !call) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-gray-300 space-y-2">
        <p className="text-lg animate-pulse">{status}</p>
        <p className="text-sm opacity-60">(Open console for live logs)</p>
      </div>
    );
  }

  // === Main Video UI ===
  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <div className="relative flex items-center justify-center min-h-screen bg-black">
          <div className="relative w-[90vw] md:w-[70vw] aspect-video bg-gray-900 rounded-lg overflow-hidden border border-gray-700 flex items-center justify-center">
            <RemoteParticipant />
          </div>

          <div className="absolute bottom-6 right-6 w-40 h-28 rounded overflow-hidden border border-gray-700 bg-gray-900 z-10">
            <LocalParticipant />
          </div>
        </div>
      </StreamCall>
    </StreamVideo>
  );
}

// === Participant Components ===
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
