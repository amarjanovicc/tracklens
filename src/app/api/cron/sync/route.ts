import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron";
import { syncAll } from "@/lib/spotify/sync";

export const maxDuration = 300;

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await syncAll());
}
