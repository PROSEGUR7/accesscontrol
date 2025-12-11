import { NextResponse } from 'next/server';

// Simple in-memory store for demo (replace with DB in production)
let referencias = [];

export async function POST(request) {
  const { x, y } = await request.json();
  referencias.push({ x, y, timestamp: Date.now() });
  return NextResponse.json({ success: true, x, y });
}

export async function GET() {
  return NextResponse.json(referencias);
}
