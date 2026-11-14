import { NextResponse, type NextRequest } from "next/server";
import { refreshAll } from "@/lib/playlists/sync";

export const maxDuration = 300;

/** Daily follower snapshot for every tracked playlist (Vercel Cron). */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await refreshAll();
  return NextResponse.json(result);
}
