// utils/AudioCapture.js
let mediaRecorderRecruiter = null;
let mediaRecorderCandidate = null;
let sendInterval = null;

// === START DUAL AUDIO CAPTURE (Recruiter + Candidate) ===
export const startAudioCapture = async (meetingId) => {
  console.log("[AudioCapture] Starting dual audio capture");

  // Recruiter mic (local)
  const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  // Candidate remote audio (from <audio id="remoteAudioElement" />)
  const remoteAudio = document.querySelector("#remoteAudioElement");
  const remoteStream = remoteAudio?.srcObject;

  if (!remoteStream) {
    console.warn("[AudioCapture] Candidate audio not ready yet — retrying in 3s...");
    setTimeout(() => startAudioCapture(meetingId), 3000);
    return;
  }

  // Create recorders
  const recruiterRecorder = new MediaRecorder(localStream, { mimeType: "audio/webm" });
  const candidateRecorder = new MediaRecorder(remoteStream, { mimeType: "audio/webm" });

  let recruiterChunks = [];
  let candidateChunks = [];

  recruiterRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) recruiterChunks.push(e.data);
  };
  candidateRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) candidateChunks.push(e.data);
  };

  // Send every 15s
  sendInterval = setInterval(async () => {
    if (recruiterChunks.length > 0) {
      const blob = new Blob(recruiterChunks, { type: "audio/webm" });
      await sendChunkToBackend(blob, meetingId, "RECRUITER");
      recruiterChunks = [];
    }
    if (candidateChunks.length > 0) {
      const blob = new Blob(candidateChunks, { type: "audio/webm" });
      await sendChunkToBackend(blob, meetingId, "candidate");
      candidateChunks = [];
    }
  }, 15000);

  recruiterRecorder.start(3000);
  candidateRecorder.start(3000);

  mediaRecorderRecruiter = recruiterRecorder;
  mediaRecorderCandidate = candidateRecorder;

  console.log("[AudioCapture] Recording started for recruiter and candidate");
};

// === STOP CAPTURE ===
export const stopAudioCapture = async () => {
  console.log("[AudioCapture] Stopping all recorders");

  if (mediaRecorderRecruiter?.state !== "inactive") mediaRecorderRecruiter.stop();
  if (mediaRecorderCandidate?.state !== "inactive") mediaRecorderCandidate.stop();
  if (sendInterval) clearInterval(sendInterval);
};

// === SEND TO BACKEND ===
const sendChunkToBackend = async (blob, meetingId, role) => {
  const formData = new FormData();
  formData.append("file", blob, `${role}-${Date.now()}.webm`);
  formData.append("meetingId", meetingId);
  formData.append("role", role);
  formData.append("timestamp", Date.now());

  try {
    await fetch("http://localhost:8080/api/evaluation/audio", {
      method: "POST",
      body: formData,
    });
    console.log(`[AudioCapture] Sent chunk (${role})`);
  } catch (err) {
    console.error("[AudioCapture] Upload failed:", err);
  }
};
