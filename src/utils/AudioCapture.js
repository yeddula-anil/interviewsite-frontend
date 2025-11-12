// utils/AudioCapture.js
import axiosInstance from "@/utils/axiosInstance";

let mediaRecorder = null;
let audioCtx = null;
let mixedStream = null;

/**
 * Starts capturing and mixing audio (recruiter + candidate)
 * Sends chunks to backend every 15 seconds.
 *
 * @param {Object} options
 * @param {string} options.meetingId - Current meeting ID
 * @param {Array} options.participants - List of Stream participants
 */
export const startAudioCapture = async ({ meetingId, participants }) => {
  try {
    console.log("[AudioCapture] 🎧 Starting mixed recording...");

    // 1️⃣ Get recruiter (local) mic audio
    const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // 2️⃣ Get candidate’s remote audio (via Stream.io WebRTC)
    const remoteStream = new MediaStream();
    const remoteParticipant = participants.find(p => !p.isLocalParticipant);

    if (remoteParticipant?.audioTrack?.mediaStreamTrack) {
      remoteStream.addTrack(remoteParticipant.audioTrack.mediaStreamTrack);
      console.log("[AudioCapture] ✅ Remote track found and added");
    } else {
      console.warn("[AudioCapture] ⚠️ Remote track not found — recording mic only");
    }

    // 3️⃣ Create audio context for mixing
    audioCtx = new AudioContext();
    const destination = audioCtx.createMediaStreamDestination();

    const localSource = audioCtx.createMediaStreamSource(localStream);
    localSource.connect(destination);

    if (remoteStream.getAudioTracks().length > 0) {
      const remoteSource = audioCtx.createMediaStreamSource(remoteStream);
      remoteSource.connect(destination);
    }

    mixedStream = destination.stream;

    // 4️⃣ Create MediaRecorder for the mixed stream
    mediaRecorder = new MediaRecorder(mixedStream, { mimeType: "audio/webm" });

    // 5️⃣ Send chunks every 15 seconds
    mediaRecorder.ondataavailable = async (event) => {
      if (event.data.size > 0) {
        console.log("[AudioCapture] 📤 Sending audio chunk...");
        await uploadChunk(event.data, meetingId);
      }
    };

    mediaRecorder.start(15000);
    console.log("[AudioCapture] ⏺️ Mixed audio recording started (every 15s chunk)");
  } catch (err) {
    console.error("[AudioCapture] ❌ Error starting recording:", err);
  }
};

/**
 * Stops the mixed audio recording and releases resources
 */
export const stopAudioCapture = async () => {
  try {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
      console.log("[AudioCapture] 🛑 MediaRecorder stopped");
    }

    if (audioCtx) {
      await audioCtx.close();
      console.log("[AudioCapture] 🎚️ AudioContext closed");
    }

    mediaRecorder = null;
    audioCtx = null;
    mixedStream = null;
  } catch (err) {
    console.error("[AudioCapture] ❌ Error stopping recording:", err);
  }
};

/**
 * Uploads a single audio chunk to backend
 * @param {Blob} blob - Audio chunk
 * @param {string} meetingId - Meeting ID
 */
async function uploadChunk(blob, meetingId) {
  try {
    const formData = new FormData();
    formData.append("audio", blob, "chunk.webm");
    formData.append("meetingId", meetingId);

    await axiosInstance.post("/evaluation/chunk", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    console.log("[AudioCapture] ✅ Chunk uploaded successfully");
  } catch (err) {
    console.error("[AudioCapture] ❌ Chunk upload failed:", err);
  }
}
