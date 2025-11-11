import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const dataFile = path.join(process.cwd(), 'recordings.json');

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!fs.existsSync(dataFile)) {
      return NextResponse.json([]);
    }

    const recordings = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    const userRecordings = userId
      ? recordings.filter((r) => r.userId === userId)
      : recordings;

    return NextResponse.json(userRecordings);
  } catch (err) {
    console.error('Recording list error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
