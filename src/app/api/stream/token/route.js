import { NextResponse } from 'next/server';
import { StreamClient } from '@stream-io/node-sdk';

// ✅ Use Mumbai region (ap-south)
export const runtime = 'nodejs';
export const preferredRegion = 'bom1';

const STREAM_API_KEY = process.env.STREAM_API_KEY;
const STREAM_API_SECRET = process.env.STREAM_API_SECRET;

let client = null;

// ✅ Initialize Stream client safely
function ensureClient() {
  if (!STREAM_API_KEY || !STREAM_API_SECRET) {
    throw new Error('Missing STREAM_API_KEY or STREAM_API_SECRET environment variables.');
  }

  if (!client) {
    client = new StreamClient(STREAM_API_KEY, STREAM_API_SECRET, { video: true });
    console.log('✅ Stream client initialized (video enabled)');
  }

  return client;
}

// ✅ Handle both GET & POST but always via query param
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const user_id = searchParams.get('user_id');

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    const stream = ensureClient();
    const token = stream.createToken(user_id);
    console.log(`🎯 Token created for user: ${user_id}`);

    return NextResponse.json({ token }, { status: 200 });
  } catch (err) {
    console.error('❌ Token GET error:', err);
    return NextResponse.json({ error: 'Failed to create token' }, { status: 500 });
  }
}

export async function POST(req) {
  // just reuse same logic (so either method works)
  return GET(req);
}
