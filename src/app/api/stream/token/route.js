import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const user_id = searchParams.get("user_id");

    if (!user_id) {
      return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
    }

    const cleanUserId = user_id.trim(); // ✅ Removes spaces/newlines
    console.log("🎫 Generating Stream token for user:", cleanUserId);

    const apiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;
    const apiSecret = process.env.STREAM_API_SECRET;

    if (!apiKey || !apiSecret) {
      throw new Error("Missing Stream credentials in environment variables.");
    }

    const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 2; // 2h expiry

    const payload = { user_id: cleanUserId, exp };

    const token = jwt.sign(payload, apiSecret, { algorithm: "HS256" });

    return NextResponse.json({
      token
      
    });
  } catch (err) {
    console.error("❌ Token generation failed:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
