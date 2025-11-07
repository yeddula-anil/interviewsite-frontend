import { NextResponse } from 'next/server';
import { StreamClient } from '@stream-io/node-sdk';

const STREAM_API_KEY = process.env.STREAM_API_KEY;
const STREAM_API_SECRET = process.env.STREAM_API_SECRET;

let client;

function ensureEnv() {
  if (!STREAM_API_KEY || !STREAM_API_SECRET) {
    throw new Error('Missing STREAM_API_KEY or STREAM_API_SECRET environment variables.');
  }
  if (!client) {
    client = new StreamClient(STREAM_API_KEY, STREAM_API_SECRET);
  }
}

export async function POST(req) {
  try {
    ensureEnv();
    const { user_id } = await req.json();

    if (!user_id || typeof user_id !== 'string') {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    const token = client.createToken(user_id);
    return NextResponse.json({ token });
  } catch (err) {
    console.error('Token POST error:', err);
    return NextResponse.json({ error: 'Failed to create token' }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    ensureEnv();
    const { searchParams } = new URL(req.url);
    const user_id = searchParams.get('user_id');
    if (!user_id) {
      return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
    }

    const token = client.createToken(user_id);
    return NextResponse.json({ token });
  } catch (err) {
    console.error('Token GET error:', err);
    return NextResponse.json({ error: 'Failed to create token' }, { status: 500 });
  }
}
