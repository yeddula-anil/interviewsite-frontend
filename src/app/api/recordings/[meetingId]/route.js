import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const { meetingId } = params;

  if (!meetingId) {
    return NextResponse.json({ error: "Meeting ID required" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://video.stream-io-api.com/api/v1/call/default/${meetingId}/recordings`,
      {
        headers: {
          Authorization: `Bearer ${process.env.STREAM_API_SECRET}`,
        },
        cache: "no-store",
      }
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Stream API error: ${text}`);
    }

    const data = await res.json();
    const recordings = data?.recordings || [];

    if (recordings.length === 0) {
      return NextResponse.json({ message: "No recordings found" }, { status: 404 });
    }

    const latest = recordings[recordings.length - 1];
    return NextResponse.json({
      meetingId,
      recordingUrl: latest.url,
      filename: latest.filename,
      duration: latest.duration,
      startTime: latest.start_time,
    });
  } catch (err) {
    console.error("❌ Error fetching Stream recording:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
