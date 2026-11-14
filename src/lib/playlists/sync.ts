import "server-only";
import { and, eq, inArray, sql as dsql } from "drizzle-orm";
import { db } from "@/db";
import { playlist, playlistEvent, playlistItem, playlistSnapshot, spotifyConnection, trackedPlaylist } from "@/db/schema";
import {
  getAppToken,
  getUserToken,
  spotifyConfigured,
  spotifyGet,
  type PlaylistItemsPage,
  type SpotifyPlaylist,
} from "@/lib/spotify/client";

export type UserAuth = { token: string; spotifyUserId: string };

const todayUtc = () => new Date().toISOString().slice(0, 10);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const isDemoPlaylist = (id: string) => id.startsWith("demo_");

/**
 * Fetches playlist metadata, upserts the shared `playlist` row and today's
 * snapshot. When the caller passes a user token for a playlist that user owns
 * (or that is collaborative), also diffs the track list into playlist_event.
 * Spotify only returns items for owned/collaborative playlists (Feb 2026).
 */
export async function refreshPlaylist(spotifyId: string, user?: UserAuth | null) {
  if (isDemoPlaylist(spotifyId)) return { skipped: true as const };
  try {
    let token: string;
    if (spotifyConfigured()) token = await getAppToken();
    else if (user) token = user.token;
    else throw new Error("Spotify API credentials are not configured");

    let pl: SpotifyPlaylist;
    try {
      pl = await spotifyGet<SpotifyPlaylist>(token, `/playlists/${spotifyId}`);
    } catch (e) {
      // Private playlists are only visible with the owner's token.
      if (!user || token === user.token) throw e;
      pl = await spotifyGet<SpotifyPlaylist>(user.token, `/playlists/${spotifyId}`);
    }

    const followers = pl.followers?.total ?? null;
    const trackCount = pl.items?.total ?? pl.tracks?.total ?? null;
    const row = {
      name: pl.name,
      description: pl.description || null,
      ownerName: pl.owner?.display_name ?? null,
      ownerId: pl.owner?.id ?? null,
      imageUrl: pl.images?.[0]?.url ?? null,
      followers,
      trackCount,
      lastFetchedAt: new Date(),
      lastError: null,
    };
    await db
      .insert(playlist)
      .values({ spotifyId, ...row })
      .onConflictDoUpdate({ target: playlist.spotifyId, set: row });
    await db
      .insert(playlistSnapshot)
      .values({ spotifyId, day: todayUtc(), followers, trackCount })
      .onConflictDoUpdate({
        target: [playlistSnapshot.spotifyId, playlistSnapshot.day],
        set: { followers, trackCount },
      });

    let changes: { added: number; removed: number } | null = null;
    if (user && (pl.owner?.id === user.spotifyUserId || pl.collaborative)) {
      changes = await syncItems(spotifyId, user.token);
    }
    return { skipped: false as const, followers, trackCount, changes };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.update(playlist).set({ lastError: msg.slice(0, 500) }).where(eq(playlist.spotifyId, spotifyId));
    throw e;
  }
}

type Item = { trackUri: string; trackName: string; artistName: string; position: number; addedAt: Date | null };

async function fetchItems(spotifyId: string, token: string): Promise<Item[]> {
  const items: Item[] = [];
  const seen = new Set<string>();
  let url: string | null = `/playlists/${spotifyId}/items?limit=50`;
  let position = 0;
  while (url) {
    const page: PlaylistItemsPage = await spotifyGet<PlaylistItemsPage>(token, url);
    for (const it of page.items) {
      const t = it.item ?? it.track;
      const pos = position++;
      if (!t?.uri || seen.has(t.uri)) continue;
      seen.add(t.uri);
      items.push({
        trackUri: t.uri,
        trackName: t.name,
        artistName: t.artists?.map((a) => a.name).join(", ") || "Unknown",
        position: pos,
        addedAt: it.added_at ? new Date(it.added_at) : null,
      });
    }
    url = page.next;
    if (url) await sleep(150);
  }
  return items;
}

async function syncItems(spotifyId: string, token: string) {
  const next = await fetchItems(spotifyId, token);
  const prev = await db.select().from(playlistItem).where(eq(playlistItem.spotifyId, spotifyId));
  const [{ n: priorEvents }] = await db
    .select({ n: dsql<number>`count(*)::int` })
    .from(playlistEvent)
    .where(eq(playlistEvent.spotifyId, spotifyId));
  const isBaseline = prev.length === 0 && priorEvents === 0;

  const prevUris = new Set(prev.map((p) => p.trackUri));
  const nextUris = new Set(next.map((p) => p.trackUri));
  const day = todayUtc();
  const added = next.filter((n) => !prevUris.has(n.trackUri));
  const removed = prev.filter((p) => !nextUris.has(p.trackUri));

  await db.transaction(async (tx) => {
    if (!isBaseline) {
      const events = [
        ...added.map((a) => ({ spotifyId, day, type: "added", trackUri: a.trackUri, trackName: a.trackName, artistName: a.artistName, position: a.position })),
        ...removed.map((r) => ({ spotifyId, day, type: "removed", trackUri: r.trackUri, trackName: r.trackName, artistName: r.artistName, position: r.position })),
      ];
      for (let i = 0; i < events.length; i += 500) await tx.insert(playlistEvent).values(events.slice(i, i + 500));
    }
    await tx.delete(playlistItem).where(eq(playlistItem.spotifyId, spotifyId));
    const rows = next.map((n) => ({ spotifyId, ...n }));
    for (let i = 0; i < rows.length; i += 500) await tx.insert(playlistItem).values(rows.slice(i, i + 500));
  });

  return isBaseline ? { added: 0, removed: 0 } : { added: added.length, removed: removed.length };
}

/** Owner auth for a playlist, if one of its trackers connected the owning Spotify account. */
async function ownerAuthFor(spotifyId: string, ownerId: string | null): Promise<UserAuth | null> {
  if (!ownerId) return null;
  const [c] = await db
    .select({ userId: spotifyConnection.userId, spotifyUserId: spotifyConnection.spotifyUserId })
    .from(spotifyConnection)
    .innerJoin(trackedPlaylist, eq(trackedPlaylist.userId, spotifyConnection.userId))
    .where(and(eq(trackedPlaylist.spotifyId, spotifyId), eq(spotifyConnection.spotifyUserId, ownerId)))
    .limit(1);
  if (!c) return null;
  const token = await getUserToken(c.userId);
  return token ? { token, spotifyUserId: c.spotifyUserId } : null;
}

/** Auth for a given app user, if they connected Spotify. */
export async function userAuthFor(userId: string): Promise<UserAuth | null> {
  const [c] = await db.select().from(spotifyConnection).where(eq(spotifyConnection.userId, userId)).limit(1);
  if (!c) return null;
  try {
    const token = await getUserToken(userId);
    return token ? { token, spotifyUserId: c.spotifyUserId } : null;
  } catch {
    return null;
  }
}

/** Daily cron: every tracked playlist once, sequentially (rate-limit friendly). */
export async function refreshAll(opts: { delayMs?: number } = {}) {
  const ids = await db.selectDistinct({ spotifyId: trackedPlaylist.spotifyId }).from(trackedPlaylist);
  const live = ids.map((r) => r.spotifyId).filter((id) => !isDemoPlaylist(id));
  const owners = live.length
    ? await db.select({ spotifyId: playlist.spotifyId, ownerId: playlist.ownerId }).from(playlist).where(inArray(playlist.spotifyId, live))
    : [];
  const ownerOf = new Map(owners.map((o) => [o.spotifyId, o.ownerId]));

  const result = { total: ids.length, refreshed: 0, failed: 0, skipped: ids.length - live.length, errors: [] as string[] };
  for (const id of live) {
    try {
      const auth = await ownerAuthFor(id, ownerOf.get(id) ?? null).catch(() => null);
      await refreshPlaylist(id, auth);
      result.refreshed++;
    } catch (e) {
      result.failed++;
      if (result.errors.length < 20) result.errors.push(`${id}: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300));
    }
    await sleep(opts.delayMs ?? 250);
  }
  return result;
}
