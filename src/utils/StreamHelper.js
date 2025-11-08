// src/utils/streamHelper.js
import { StreamVideoClient } from '@stream-io/video-react-sdk';

/**
 * Initialize a Stream client and join (or create) a video call.
 * Automatically creates a new call if it doesn't exist.
 */
export async function initStreamCall(prejoin) {
  if (!prejoin?.meetingId) {
    throw new Error('Missing meetingId in prejoin data.');
  }

  const username = `${prejoin.role || 'candidate'}-${prejoin.name || 'Guest'}`;

  // 1️⃣ Fetch token for this user
  const res = await fetch('/api/stream/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: username }),
  });

  const { token } = await res.json();
  if (!token) throw new Error('Failed to fetch Stream token.');

  // 2️⃣ Initialize Stream client
  const clientInstance = StreamVideoClient.getOrCreateInstance({
    apiKey: process.env.NEXT_PUBLIC_STREAM_API_KEY,
    user: { id: username, name: prejoin.name },
    token,
  });

  // 3️⃣ Create call instance
  const callInstance = clientInstance.call('default', prejoin.meetingId);

  // 4️⃣ Check if the call already exists
  let shouldCreate = false;
  try {
    await callInstance.get();
  } catch (err) {
    if (err.code === 404) shouldCreate = true;
    else console.error('Error checking call existence:', err);
  }

  // 5️⃣ Join the call (create if needed)
  await callInstance.join({ create: shouldCreate });

  // 6️⃣ Enable camera and mic
  await new Promise((r) => setTimeout(r, 500));
  if (prejoin.camOn !== false) await callInstance.camera.enable().catch(() => {});
  if (prejoin.micOn !== false) await callInstance.microphone.enable().catch(() => {});

  return { clientInstance, callInstance, username };
}
