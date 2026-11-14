import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { getCurrentUser } from "@/lib/session";
import { redirectUri, SPOTIFY_SCOPES, spotifyConfigured } from "@/lib/spotify/client";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/sign-in", req.url));
  if (!spotifyConfigured()) return NextResponse.redirect(new URL("/app/settings?spotify=not_configured", req.url));

  const state = randomBytes(16).toString("hex");
  (await cookies()).set("sp_state", state, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 600, path: "/" });
  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    response_type: "code",
    redirect_uri: redirectUri(),
    scope: SPOTIFY_SCOPES.join(" "),
    state,
  });
  return NextResponse.redirect(`https://accounts.spotify.com/authorize?${params}`);
}
