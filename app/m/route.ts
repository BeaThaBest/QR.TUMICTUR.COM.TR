import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ios = searchParams.get("ios");
  const android = searchParams.get("android");
  const desktop = searchParams.get("desktop");
  const fallback = searchParams.get("u");

  const ua = req.headers.get("user-agent") || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);

  const target = isIOS ? (ios || fallback) : isAndroid ? (android || fallback) : (desktop || fallback);
  if (!target) return new NextResponse("Missing target", { status: 400 });
  return NextResponse.redirect(target, { status: 302 });
}

