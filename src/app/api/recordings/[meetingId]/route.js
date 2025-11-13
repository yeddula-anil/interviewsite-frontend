import axios from "axios";
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  try {
    // 1️⃣ Extract meetingId and token from URL
    const { meetingId } = params;
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");
    

    if (!meetingId) {
      return NextResponse.json({ error: "Meeting ID required" }, { status: 400 });
    }

    if (!token) {
      return NextResponse.json({ error: "Missing Stream token" }, { status: 401 });
    }

    console.log(`🎬 Fetching Stream recording for meeting: ${meetingId}, `);

    // 2️⃣ Stream API URL (Singapore region for your app)
    const appId = process.env.STREAM_APP_ID;
    const callType = "default";
    const streamUrl = `https://video.stream-io-api.com/api/v1/app/1445640/call/default/${meetingId}/recordings`;

    console.log(`🌏 Requesting Stream API: ${streamUrl}`);

    // 3️⃣ Fetch recordings from Stream
    const res = await axios.get(streamUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        "stream-auth-type": "jwt",
        "Content-Type": "application/json",
      },
    });

    // 4️⃣ Extract the recordings
    const recordings = res.data?.recordings || [];

    if (recordings.length === 0) {
      console.warn("⚠️ No recordings found for this meeting");
      return NextResponse.json({ message: "No recordings found" }, { status: 404 });
    }

    // 5️⃣ Return the latest recording
    const latest = recordings[recordings.length - 1];
    console.log("✅ Found recording:", latest.filename);

    return NextResponse.json({
      meetingId,
      
      recordingUrl: latest.url,
      filename: latest.filename,
      startTime: latest.start_time,
      endTime: latest.end_time,
    });
  } catch (err) {
    console.error("❌ Error fetching Stream recording:", err.response?.data || err.message);

    const errorMessage =
      err.response?.data?.message ||
      err.response?.data?.error ||
      err.message ||
      "Failed to fetch recording";

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
