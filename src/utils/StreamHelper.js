import { StreamVideoClient } from '@stream-io/video-react-sdk';

/**
 * Helper function to "slugify" a string for safe user IDs.
 * 'John Doe' -> 'john-doe'
 */
const slugify = (str) =>
  String(str)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word characters
    .replace(/[\s_-]+/g, '-') // Replace spaces/underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

/**
 * Initialize a Stream client and join (or create) a video call.
 * Automatically creates a new call if it doesn't exist.
 */
export async function initStreamCall(prejoin) {
  if (!prejoin?.meetingId) {
    throw new Error('Missing meetingId in prejoin data.');
  }

  // 1️⃣ Create a safe, clean user_id
  const safeName = slugify(prejoin.name || 'guest');
  const role = slugify(prejoin.role || 'candidate');
  const username = `${role}-${safeName}`;

  // 2️⃣ Fetch token for this user
  const res = await fetch('/api/stream/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: username }),
  });

  const { token } = await res.json();
  if (!token) throw new Error('Failed to fetch Stream token.');

  // 3️⃣ Initialize Stream client
  const clientInstance = StreamVideoClient.getOrCreateInstance({
    apiKey: process.env.NEXT_PUBLIC_STREAM_API_KEY,
    user: { id: username, name: prejoin.name || 'Guest' },
    token,
  });

  // 4️⃣ Create call instance
  const callInstance = clientInstance.call('default', prejoin.meetingId);

  // 5️⃣ Check if the call already exists
  let shouldCreate = false;
  try {
    await callInstance.get();
    console.log('✅ Existing call found:', prejoin.meetingId);
  } catch (err) {
    if (err.code === 404) {
      console.log('🆕 Creating new call:', prejoin.meetingId);
      shouldCreate = true;
    } else {
      console.error('Error checking call existence:', err);
    }
  }

  // 6️⃣ Join the call (create if needed)
  await callInstance.join({ create: shouldCreate });

  // 7️⃣ Ensure media tracks are created before enabling
  await callInstance.camera.createTrack?.().catch(() => {});
  await callInstance.microphone.createTrack?.().catch(() => {});

  // 8️⃣ Enable camera and mic after creation
  if (prejoin.camOn !== false) await callInstance.camera.enable().catch(() => {});
  if (prejoin.micOn !== false) await callInstance.microphone.enable().catch(() => {});

  console.log(`🎥 Joined meeting ${prejoin.meetingId} as ${username}`);

  return { clientInstance, callInstance, username };
}
