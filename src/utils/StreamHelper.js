import { StreamVideoClient } from '@stream-io/video-react-sdk';

const slugify = (str) =>
  String(str)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

export async function initStreamCall(prejoin) {
  if (!prejoin?.meetingId) throw new Error('❌ Missing meetingId in prejoin data.');

  const safeName = slugify(prejoin.name || 'guest');
  const role = slugify(prejoin.role || 'participant');
  const username = `${role}-${safeName}`;

  console.log(`🎯 Attempting to join call as: ${username}`);

  // ✅ Fetch token
  const res = await fetch('/api/stream/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: username }),
  });

  const { token } = await res.json();
  if (!token) throw new Error('❌ Failed to fetch Stream token.');

  // ✅ Initialize Stream client
  const clientInstance = StreamVideoClient.getOrCreateInstance({
    apiKey: process.env.NEXT_PUBLIC_STREAM_API_KEY,
    user: { id: username, name: prejoin.name || 'Guest' },
    token,
  });

  // ✅ Create call instance
  const callInstance = clientInstance.call('default', prejoin.meetingId);
  let shouldCreate = false;

  try {
    await callInstance.get();
    console.log('✅ Existing call found:', prejoin.meetingId);
  } catch (err) {
    if (err.code === 404) {
      console.log('🆕 Creating new call:', prejoin.meetingId);
      shouldCreate = true;
    } else {
      console.error('⚠️ Error checking call existence:', err);
    }
  }

  // ✅ Force create for first user if needed
  await callInstance.join({ create: true });
  console.log(`🎥 Joined meeting ${prejoin.meetingId} as ${username}`);

  // ✅ Enable media
  try {
    await callInstance.camera.createTrack?.();
    await callInstance.microphone.createTrack?.();
    if (prejoin.camOn !== false) await callInstance.camera.enable();
    if (prejoin.micOn !== false) await callInstance.microphone.enable();
  } catch (err) {
    console.warn('⚠️ Media setup failed:', err.message);
  }

  return { clientInstance, callInstance, username };
}
