import axios from 'axios';
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
  const role = slugify(prejoin.role || 'participant').toLowerCase();
  const username = `${role}-${safeName}`;
  console.log(username)

  console.log(`🎯 Attempting to join call as: ${username}`);

  // ✅ Fetch token via GET with query param using Axios
  const tokenUrl = `/api/stream/token?user_id=${encodeURIComponent(username)}`;
  let token;
  try {
    const res = await axios.get(tokenUrl);
    token = res.data?.token;
  } catch (err) {
    console.error('❌ Token request failed:', err);
    throw new Error('❌ Failed to fetch Stream token.');
  }

  if (!token) throw new Error('❌ Failed to fetch Stream token.');

  // ✅ Initialize Stream client (reuse if exists)
  const clientInstance = StreamVideoClient.getOrCreateInstance({
    apiKey: process.env.NEXT_PUBLIC_STREAM_API_KEY,
    user: { id: username, name: prejoin.name || 'Guest' },
    token,
  });

  // ✅ Create or join the call
  const callInstance = clientInstance.call('default', prejoin.meetingId);

  console.log(`📞 Joining or creating call: ${prejoin.meetingId}`);
  await callInstance.join({ create: true }); // auto-creates if first user

console.log(`🎥 Joined meeting ${prejoin.meetingId} as ${username}`);
console.log("✅ Joined call ID:", callInstance.id);
console.log("🔍 Call type:", callInstance.type);


  // ✅ Set up camera & mic
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
