import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Ephemeral in-memory analytics (per server instance)
const counts = new Map<string, number>();

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const target = url.searchParams.get("to");
  if (!target) return new NextResponse("Missing 'to'", { status: 400 });

  const key = target;
  counts.set(key, (counts.get(key) || 0) + 1);
  // UTM params can be forwarded
  const utmParams = ["utm_source","utm_medium","utm_campaign"]; // pass through if present
  const tp = new URL(target, url.origin);
  for (const p of utmParams) {
    const v = url.searchParams.get(p);
    if (v && !tp.searchParams.has(p)) tp.searchParams.set(p, v);
  }
  return NextResponse.redirect(tp.toString(), { status: 302 });
}

export async function POST(req: NextRequest) {
  const data = Array.from(counts.entries()).map(([to, count]) => ({ to, count }));
  return NextResponse.json({ data });
}

