import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { spotifyConnection } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  await db.delete(spotifyConnection).where(eq(spotifyConnection.userId, user.id));
  return NextResponse.json({ ok: true });
}
