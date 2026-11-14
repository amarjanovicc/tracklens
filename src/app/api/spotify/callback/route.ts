import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/db";
import { spotifyConnection } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { exchangeCode, spotifyGet, SpotifyError } from "@/lib/spotify/client";
import { syncRecent } from "@/lib/spotify/sync";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (q: string) => NextResponse.redirect(new URL(`/app/settings?spotify=${q}`, req.url));
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/sign-in", req.url));

  const jar = await cookies();
  const expected = jar.get("sp_state")?.value;
  jar.delete("sp_state");
  if (url.searchParams.get("error")) return back("denied");
  const code = url.searchParams.get("code");
  if (!code || !expected || url.searchParams.get("state") !== expected) return back("state_mismatch");

  try {
    const t = await exchangeCode(code);
    const me = await spotifyGet<{ id: string; display_name: string | null }>(t.access_token, "/me");
    const values = {
      userId: user.id,
      spotifyUserId: me.id,
      displayName: me.display_name,
      accessToken: t.access_token,
      refreshToken: t.refresh_token!,
      expiresAt: new Date(Date.now() + t.expires_in * 1000),
      scope: t.scope ?? null,
      lastError: null,
    };
    await db.insert(spotifyConnection).values(values).onConflictDoUpdate({ target: spotifyConnection.userId, set: values });
    await syncRecent(user.id);
    return back("connected");
  } catch (e) {
    // 403 from /me = the Spotify account is not on the app's Dev-Mode allow-list.
    return back(e instanceof SpotifyError && e.status === 403 ? "not_allowlisted" : "error");
  }
}
