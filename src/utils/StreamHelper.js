//this is of no use is just a dummy file but keep it
import axios from "axios";
import { StreamVideoClient } from "@stream-io/video-react-sdk";

const slugify = (str) =>
  String(str)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

export async function initStreamCall(prejoin) {
  if (!prejoin?.meetingId) throw new Error("❌ Missing meetingId in prejoin data.");

  const safeName = slugify(prejoin.name || "guest");
  const role = slugify(prejoin.role || "participant").toLowerCase();
  const username = `${role}-${safeName}`.trim();

  console.log(`🎯 Attempting to join call as: ${username}`);

  // 1️⃣ Fetch token
  const res = await axios.get(`/api/stream/token?user_id=${encodeURIComponent(username)}`);
  const token = res.data?.token;
  if (!token) throw new Error("❌ Failed to fetch Stream token.");
  console.log("✅ Token fetched successfully");
  console.log("📜 Token Payload:", JSON.parse(atob(token.split(".")[1])));

  // 2️⃣ Initialize Stream client (disable hint lookup)
  const clientInstance = new StreamVideoClient({
    apiKey: process.env.NEXT_PUBLIC_STREAM_API_KEY,
    options: { disable_location_hint: true }, // ✅ key fix
  });

  // 3️⃣ Connect user
  await clientInstance.connectUser(
    {
      id: username,
      name: prejoin.name || "Guest",
    },
    token
  );

  console.log(`🔗 Stream user connected: ${username}`);

  // 4️⃣ Wait (but with timeout fallback)
  console.log("⏳ Waiting for WebSocket to connect...");
  await new Promise((resolve, reject) => {
    const start = Date.now();
    const check = setInterval(() => {
      if (clientInstance.wsConnectionHealthy) {
        clearInterval(check);
        console.log("✅ WebSocket connection established");
        resolve();
      } else if (Date.now() - start > 10000) {
        clearInterval(check);
        console.warn("⚠️ WebSocket connection not confirmed in time, continuing anyway...");
        resolve(); // ✅ proceed even if unhealthy (prevents hang)
      }
    }, 500);
  });

  // 5️⃣ Join call
  const callInstance = clientInstance.call("default", prejoin.meetingId);
  console.log(`📞 Joining or creating call: ${prejoin.meetingId}`);
  await callInstance.join({ create: true });
  console.log(`🎥 Joined meeting ${prejoin.meetingId} as ${username}`);

  // 6️⃣ Setup media
  try {
    await callInstance.camera.createTrack?.();
    await callInstance.microphone.createTrack?.();
    if (prejoin.camOn !== false) await callInstance.camera.enable();
    if (prejoin.micOn !== false) await callInstance.microphone.enable();
  } catch (err) {
    console.warn("⚠️ Media setup failed:", err.message);
  }

  return { clientInstance, callInstance, username };
}
