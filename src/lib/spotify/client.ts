import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { spotifyConnection } from "@/db/schema";

/**
 * Thin Spotify Web API client.
 *
 * Constraints this product is designed around (Feb 2026 changelog):
 *  - Development Mode apps: max 5 users, owner needs Premium. Extended quota
 *    is only for organisations with large MAU. So OAuth is an *optional*
 *    extra; imports are the primary data path.
 *  - Removed: audio-features, recommendations, related artists, popularity,
 *    artist followers, batch "several" endpoints, other users' profiles/playlists.
 *  - Playlist items: only for playlists the user owns or collaborates on.
 *    Other playlists return metadata only.
 *  - Playlist `tracks` field renamed to `items`.
 */

export const SPOTIFY_SCOPES = [
  "user-read-recently-played",
  "user-top-read",
  "playlist-read-private",
  "playlist-read-collaborative",
];

export const spotifyConfigured = () =>
  Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);

export const redirectUri = () => {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://127.0.0.1:3000");
  return `${base}/api/spotify/callback`;
};

function basicAuth() {
  return "Basic " + Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64");
}

type TokenResponse = { access_token: string; token_type: string; expires_in: number; refresh_token?: string; scope?: string };

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { Authorization: basicAuth(), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    cache: "no-store",
  });
  if (!res.ok) throw new SpotifyError(res.status, `token: ${await res.text()}`);
  return res.json();
}

export const exchangeCode = (code: string) =>
  tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri() });

let appToken: { token: string; exp: number } | null = null;

/** Client-credentials token for public, non-user data (playlist metadata). */
export async function getAppToken(): Promise<string> {
  if (appToken && appToken.exp > Date.now() + 60_000) return appToken.token;
  const t = await tokenRequest({ grant_type: "client_credentials" });
  appToken = { token: t.access_token, exp: Date.now() + t.expires_in * 1000 };
  return t.access_token;
}

/** User token with transparent refresh. Returns null when not connected. */
export async function getUserToken(userId: string): Promise<string | null> {
  const [c] = await db.select().from(spotifyConnection).where(eq(spotifyConnection.userId, userId)).limit(1);
  if (!c) return null;
  if (c.expiresAt.getTime() > Date.now() + 60_000) return c.accessToken;
  const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: c.refreshToken });
  await db
    .update(spotifyConnection)
    .set({
      accessToken: t.access_token,
      refreshToken: t.refresh_token ?? c.refreshToken, // Spotify may rotate it
      expiresAt: new Date(Date.now() + t.expires_in * 1000),
    })
    .where(eq(spotifyConnection.userId, userId));
  return t.access_token;
}

export class SpotifyError extends Error {
  constructor(public status: number, message: string) {
    super(`Spotify ${status}: ${message}`);
  }
}

/** GET with one retry on 429 honouring Retry-After. */
export async function spotifyGet<T>(token: string, path: string, attempt = 0): Promise<T> {
  const url = path.startsWith("http") ? path : `https://api.spotify.com/v1${path}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (res.status === 429 && attempt < 2) {
    const wait = Number(res.headers.get("retry-after") ?? "2");
    await new Promise((r) => setTimeout(r, Math.min(wait, 10) * 1000));
    return spotifyGet<T>(token, path, attempt + 1);
  }
  if (!res.ok) throw new SpotifyError(res.status, await res.text());
  return res.json() as Promise<T>;
}

/** Accepts a playlist URL, URI or bare id. */
export function parsePlaylistId(input: string): string | null {
  const s = input.trim();
  const m = /playlist[/:]([A-Za-z0-9]{22})/.exec(s) ?? /^([A-Za-z0-9]{22})$/.exec(s);
  return m ? m[1] : null;
}

/* ---- Response shapes (only the fields we read) ---- */

export type SpotifyImage = { url: string; width: number | null; height: number | null };
export type SpotifyPlaylist = {
  id: string;
  name: string;
  description: string | null;
  owner: { id: string; display_name: string | null };
  images: SpotifyImage[] | null;
  followers?: { total: number } | null;
  // renamed in Feb 2026; read both defensively
  items?: { total: number } | null;
  tracks?: { total: number } | null;
  collaborative?: boolean;
};
export type SpotifyTrack = {
  uri: string;
  name: string;
  duration_ms: number;
  artists: { name: string }[];
  album: { name: string; images?: SpotifyImage[] };
};
export type RecentlyPlayed = {
  items: { played_at: string; track: SpotifyTrack }[];
  cursors?: { after?: string; before?: string } | null;
};
export type PlaylistItemsPage = {
  items: { added_at: string | null; item?: SpotifyTrack | null; track?: SpotifyTrack | null }[];
  next: string | null;
  total: number;
};
