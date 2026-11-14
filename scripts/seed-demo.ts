/**
 * Seeds a demo account with ~2.5 years of fictional listening history,
 * three tracked playlists (one with a bot-like follower spike) and a public
 * share link at /share/demo. Also writes a small sample export to
 * public/sample/ so the import flow can be tried without a real export.
 *
 *   npm run seed            # demo@tracklens.dev / demo-password
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { mkdirSync, writeFileSync } from "node:fs";
import postgres from "postgres";
import { hashPassword } from "better-auth/crypto";
import { generateHistory } from "./demo-history";
import { normalizeEntry } from "../src/lib/import/normalize";

const sql = postgres(process.env.DATABASE_URL!, { max: 1 });
const EMAIL = "demo@tracklens.dev";
const PASSWORD = "demo-password";
const USER_ID = "demo-user";

async function main() {
  const end = new Date();
  const history = generateHistory({ seed: 7, end });

  mkdirSync("public/sample", { recursive: true });
  const recent = history.filter((e) => Date.parse(String(e.ts)) > end.getTime() - 120 * 86_400_000);
  writeFileSync("public/sample/Streaming_History_Audio_sample.json", JSON.stringify(recent));

  await sql`delete from "user" where id = ${USER_ID} or email = ${EMAIL}`;
  await sql`insert into "user" (id, name, email, email_verified, timezone, plan)
            values (${USER_ID}, 'Demo Listener', ${EMAIL}, true, 'Europe/Zagreb', 'pro')`;
  await sql`insert into account (id, account_id, provider_id, user_id, password)
            values ('demo-account', ${USER_ID}, 'credential', ${USER_ID}, ${await hashPassword(PASSWORD)})`;

  const plays = history.map(normalizeEntry).filter((p) => p !== null);
  const rows = plays.map((p) => ({
    user_id: USER_ID,
    played_at: p.playedAt,
    ms_played: p.msPlayed,
    kind: p.kind,
    track_uri: p.trackUri,
    track_name: p.trackName,
    artist_name: p.artistName,
    album_name: p.albumName,
    platform: p.platform,
    country: p.country,
    reason_start: p.reasonStart,
    reason_end: p.reasonEnd,
    shuffle: p.shuffle,
    skipped: p.skipped,
    offline: p.offline,
    incognito: p.incognito,
    source: "import",
  }));
  for (let i = 0; i < rows.length; i += 2000) {
    await sql`insert into play ${sql(rows.slice(i, i + 2000))} on conflict do nothing`;
  }

  // Playlists: organic growth, a botted spike, and a slow decline with a purge.
  const pls = [
    { id: "demo_organic", name: "Late Night Drive", owner: "Demo Listener", base: 1800, growth: 6, spike: null as null | number, purge: null as null | number },
    { id: "demo_botted", name: "VIRAL HITS 2026 🔥", owner: "playlist_promo_99", base: 9000, growth: 4, spike: 72, purge: 120 },
    { id: "demo_editorial", name: "Indie Kitchen", owner: "kitchen.radio", base: 42000, growth: 35, spike: null, purge: null },
  ];
  await sql`delete from playlist where spotify_id like 'demo_%'`;
  for (const p of pls) {
    let f = p.base;
    const snaps: { spotify_id: string; day: string; followers: number; track_count: number }[] = [];
    for (let d = 179; d >= 0; d--) {
      const day = new Date(end.getTime() - d * 86_400_000).toISOString().slice(0, 10);
      const i = 179 - d;
      f += Math.round(p.growth * (0.6 + Math.sin(i / 9) * 0.3 + ((i * 7919) % 13) / 26));
      if (p.spike !== null && i >= p.spike && i < p.spike + 3) f += 3200;
      if (p.purge !== null && i === p.purge) f -= 2900;
      snaps.push({ spotify_id: p.id, day, followers: f, track_count: 50 + (i % 7) });
    }
    await sql`insert into playlist (spotify_id, name, owner_name, followers, track_count, last_fetched_at)
              values (${p.id}, ${p.name}, ${p.owner}, ${f}, 56, now())`;
    await sql`insert into playlist_snapshot ${sql(snaps)}`;
    await sql`insert into tracked_playlist (user_id, spotify_id) values (${USER_ID}, ${p.id})`;
  }

  await sql`insert into share_link (slug, user_id, title, range_from, range_to)
            values ('demo', ${USER_ID}, 'My last 12 months', ${new Date(end.getTime() - 365 * 86_400_000)}, null)
            on conflict (slug) do update set user_id = excluded.user_id, range_from = excluded.range_from`;

  console.log(`Seeded ${rows.length} plays for ${EMAIL} / ${PASSWORD}`);
  console.log(`Sample export: public/sample/Streaming_History_Audio_sample.json (${recent.length} entries)`);
  await sql.end();
}

main().catch(async (e) => {
  console.error(e);
  await sql.end();
  process.exit(1);
});
