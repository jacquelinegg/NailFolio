import { NextResponse } from "next/server";

export const runtime = "nodejs";

const saved = new Map<string, unknown[]>();

function corsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:8081",
    "http://192.168.0.100:3000",
    "http://192.168.0.100:8081",
  ];
  const allowOrigin = (origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0])!;
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function jsonItems(userId: string) {
  return NextResponse.json({ items: saved.get(userId) ?? [] }, { headers: corsHeaders(null) });
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin");
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId") ?? "anonymous";
  return jsonItems(userId);
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const body = await request.json().catch(() => null);
  if (!body || !body.userId || !body.item) {
    return NextResponse.json({ error: "userId and item are required" }, { status: 400, headers: corsHeaders(origin) });
  }

  const items = saved.get(body.userId) ?? [];
  const exists = items.some((item) => JSON.stringify(item) === JSON.stringify(body.item));
  if (!exists) {
    items.push(body.item);
    saved.set(body.userId, items);
  }

  return NextResponse.json({ items }, { headers: corsHeaders(origin) });
}

export async function DELETE(request: Request) {
  const origin = request.headers.get("origin");
  const body = await request.json().catch(() => null);
  if (!body || !body.userId || !body.item) {
    return NextResponse.json({ error: "userId and item are required" }, { status: 400, headers: corsHeaders(origin) });
  }

  const items = (saved.get(body.userId) ?? []).filter((item) => JSON.stringify(item) !== JSON.stringify(body.item));
  saved.set(body.userId, items);

  return NextResponse.json({ items }, { headers: corsHeaders(origin) });
}
