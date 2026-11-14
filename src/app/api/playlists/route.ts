import { NextResponse, type NextRequest } from "next/server";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { playlist, trackedPlaylist } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { limitsFor } from "@/lib/plans";
import { parsePlaylistId, spotifyConfigured, SpotifyError } from "@/lib/spotify/client";
import { refreshPlaylist, userAuthFor } from "@/lib/playlists/sync";

const Body = z.object({ url: z.string().trim().min(1).max(500) });

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Paste a Spotify playlist link" }, { status: 400 });
  const spotifyId = parsePlaylistId(parsed.data.url);
  if (!spotifyId) {
    return NextResponse.json(
      { error: "That doesn't look like a playlist link. Use https://open.spotify.com/playlist/… or spotify:playlist:…" },
      { status: 400 },
    );
  }

  const [already] = await db
    .select({ id: trackedPlaylist.id })
    .from(trackedPlaylist)
    .where(and(eq(trackedPlaylist.userId, user.id), eq(trackedPlaylist.spotifyId, spotifyId)))
    .limit(1);
  if (already) return NextResponse.json({ ok: true, spotifyId, already: true });

  const limit = limitsFor(user.plan).trackedPlaylists;
  const [{ n }] = await db.select({ n: count() }).from(trackedPlaylist).where(eq(trackedPlaylist.userId, user.id));
  if (n >= limit) {
    return NextResponse.json(
      { error: `Your ${user.plan === "pro" ? "Pro" : "Free"} plan tracks up to ${limit} playlists. ${user.plan === "pro" ? "Remove one first." : "Upgrade to Pro to track more."}` },
      { status: 403 },
    );
  }

  const [existing] = await db.select({ id: playlist.spotifyId }).from(playlist).where(eq(playlist.spotifyId, spotifyId)).limit(1);
  if (!existing) {
    const auth = await userAuthFor(user.id);
    if (!spotifyConfigured() && !auth) {
      return NextResponse.json(
        { error: "Playlist tracking needs Spotify API credentials on the server (SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET)." },
        { status: 503 },
      );
    }
    try {
      await refreshPlaylist(spotifyId, auth);
    } catch (e) {
      if (e instanceof SpotifyError && (e.status === 404 || e.status === 400)) {
        return NextResponse.json({ error: "Spotify couldn't find that playlist. It may be private or deleted." }, { status: 404 });
      }
      if (e instanceof SpotifyError && e.status === 403) {
        return NextResponse.json({ error: "Spotify refused access to that playlist (private, or not available to this app)." }, { status: 403 });
      }
      console.error("refreshPlaylist failed", e);
      return NextResponse.json({ error: "Couldn't reach Spotify. Try again in a minute." }, { status: 502 });
    }
  }

  await db.insert(trackedPlaylist).values({ userId: user.id, spotifyId }).onConflictDoNothing();
  return NextResponse.json({ ok: true, spotifyId });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  // Playlist data and history stay: they are shared with other trackers.
  await db.delete(trackedPlaylist).where(and(eq(trackedPlaylist.userId, user.id), eq(trackedPlaylist.spotifyId, id)));
  return NextResponse.json({ ok: true });
}
