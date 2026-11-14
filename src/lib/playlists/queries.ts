import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { playlist, playlistEvent, playlistSnapshot, spotifyConnection, trackedPlaylist } from "@/db/schema";
import { detect } from "./detect";

export async function loadTrackedPlaylists(userId: string) {
  const rows = await db
    .select({ tracked: trackedPlaylist, pl: playlist })
    .from(trackedPlaylist)
    .innerJoin(playlist, eq(playlist.spotifyId, trackedPlaylist.spotifyId))
    .where(eq(trackedPlaylist.userId, userId))
    .orderBy(asc(trackedPlaylist.createdAt));
  const ids = rows.map((r) => r.pl.spotifyId);
  const snaps = ids.length
    ? await db.select().from(playlistSnapshot).where(inArray(playlistSnapshot.spotifyId, ids)).orderBy(asc(playlistSnapshot.day))
    : [];
  const bySpotifyId = new Map<string, { day: string; followers: number | null }[]>();
  for (const s of snaps) {
    const a = bySpotifyId.get(s.spotifyId) ?? [];
    a.push({ day: s.day, followers: s.followers });
    bySpotifyId.set(s.spotifyId, a);
  }
  return rows.map((r) => ({ ...r.pl, trackedAt: r.tracked.createdAt, detection: detect(bySpotifyId.get(r.pl.spotifyId) ?? []) }));
}

export async function loadPlaylistDetail(userId: string, spotifyId: string) {
  const [row] = await db
    .select({ pl: playlist })
    .from(trackedPlaylist)
    .innerJoin(playlist, eq(playlist.spotifyId, trackedPlaylist.spotifyId))
    .where(and(eq(trackedPlaylist.userId, userId), eq(trackedPlaylist.spotifyId, spotifyId)))
    .limit(1);
  if (!row) return null;
  const [snaps, events, [conn]] = await Promise.all([
    db.select().from(playlistSnapshot).where(eq(playlistSnapshot.spotifyId, spotifyId)).orderBy(asc(playlistSnapshot.day)),
    db.select().from(playlistEvent).where(eq(playlistEvent.spotifyId, spotifyId)).orderBy(desc(playlistEvent.day), asc(playlistEvent.type)).limit(300),
    db.select({ spotifyUserId: spotifyConnection.spotifyUserId }).from(spotifyConnection).where(eq(spotifyConnection.userId, userId)).limit(1),
  ]);
  return {
    playlist: row.pl,
    snapshots: snaps,
    events,
    detection: detect(snaps.map((s) => ({ day: s.day, followers: s.followers }))),
    ownedByConnectedUser: Boolean(conn && row.pl.ownerId && conn.spotifyUserId === row.pl.ownerId),
    spotifyConnected: Boolean(conn),
  };
}
