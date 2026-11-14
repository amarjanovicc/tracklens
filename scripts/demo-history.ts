/**
 * Generates a realistic, fully fictional Extended Streaming History in the
 * exact shape of Spotify's export (Streaming_History_Audio_*.json).
 * Deterministic (seeded) so screenshots and tests are stable.
 */

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const A = ["Velvet", "Neon", "Paper", "Glass", "Hollow", "Silver", "Midnight", "Quiet", "Golden", "Static", "Lunar", "Wild", "Cold", "Electric", "Amber", "Coral", "Echo", "Saint", "Violet", "Iron"];
const B = ["Harbor", "Atlas", "Foxes", "Tides", "Engines", "Parade", "Cartel", "Gardens", "Lights", "Season", "Theory", "Choir", "Motel", "Signals", "Rivers", "Ghosts", "Machines", "Youth", "Arcade", "Dunes"];
const W = ["Love", "Night", "Summer", "Run", "Fire", "Blue", "Home", "Gone", "Heart", "Dream", "City", "Rain", "Gold", "Fade", "Wave", "Stay", "Light", "Fall", "Sky", "Lost", "Slow", "Real", "Hold", "Free"];
const PLATFORMS = [
  ["iOS 18.1 (iPhone15,3)", 0.46],
  ["OS X 14.4.1 [arm 2]", 0.22],
  ["web_player osx;chrome 128", 0.08],
  ["Partner sonos_one Sonos One", 0.1],
  ["Android-tablet OS 13 API 33 (samsung, SM-X200)", 0.06],
  ["android_tv (Android TV)", 0.03],
  ["Partner android_auto Android Auto", 0.05],
] as const;

export type RawEntry = Record<string, string | number | boolean | null>;

export function generateHistory(opts: { seed?: number; start?: Date; end?: Date } = {}): RawEntry[] {
  const rnd = mulberry32(opts.seed ?? 42);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)];
  const end = opts.end ?? new Date();
  const start = opts.start ?? new Date(end.getTime() - 900 * 86_400_000);
  const span = end.getTime() - start.getTime();

  // Artists with an "era" during which they are popular for this listener.
  const artists = Array.from({ length: 140 }, (_, i) => {
    const name = `${A[i % A.length]} ${B[(i * 7 + Math.floor(i / A.length)) % B.length]}`;
    const tracks = Array.from({ length: 4 + Math.floor(rnd() * 16) }, () => {
      const t = `${pick(W)} ${rnd() < 0.5 ? pick(W) : ""}`.trim();
      return { name: t, uri: "spotify:track:" + Math.floor(rnd() * 1e16).toString(36).padEnd(22, "x").slice(0, 22), len: 140_000 + rnd() * 140_000 };
    });
    const albums = [`${pick(W)} ${pick(B)}`, `${pick(A)} ${pick(W)}`];
    return {
      name,
      tracks,
      albums,
      weight: 1 / Math.pow(i + 1, 0.9), // Zipf-ish
      eraCenter: rnd(),
      eraWidth: 0.08 + rnd() * 0.6,
    };
  });
  const shows = ["The Long Take", "Signal & Noise", "Two Coffees"];

  const out: RawEntry[] = [];
  const days = Math.floor(span / 86_400_000);
  for (let d = 0; d < days; d++) {
    const dayStart = start.getTime() + d * 86_400_000;
    const pos = d / days;
    const dow = new Date(dayStart).getUTCDay();
    if (rnd() < 0.06) continue; // a few silent days
    const travel = pos > 0.4 && pos < 0.42 ? "DE" : pos > 0.75 && pos < 0.765 ? "IT" : "HR";
    const sessions = 1 + Math.floor(rnd() * (dow === 0 || dow === 6 ? 4 : 3));
    const weights = artists.map((a) => a.weight * Math.exp(-((pos - a.eraCenter) ** 2) / (2 * a.eraWidth ** 2)));
    const total = weights.reduce((x, y) => x + y, 0);

    for (let s = 0; s < sessions; s++) {
      // Hours skew to commute, afternoon and late night.
      const hour = pick([7, 8, 8, 9, 13, 16, 17, 17, 18, 20, 21, 22, 23, 23, 0, 1]);
      let t = dayStart + hour * 3_600_000 + rnd() * 3_000_000;
      const shuffle = rnd() < 0.55;
      const platform = (() => {
        let r = rnd();
        for (const [p, w] of PLATFORMS) if ((r -= w) <= 0) return p;
        return PLATFORMS[0][0];
      })();
      const len = 4 + Math.floor(rnd() * 22);

      if (rnd() < 0.07) {
        const ms = 600_000 + rnd() * 2_400_000;
        t += ms;
        out.push(entry(t, ms, platform, travel, null, null, null, null, pick(W) + " with guests", pick(shows), "clickrow", "endplay", false, false));
        continue;
      }

      let artist = artists[0];
      for (let k = 0; k < len; k++) {
        if (k === 0 || rnd() < (shuffle ? 0.7 : 0.25)) {
          let r = rnd() * total;
          for (let i = 0; i < artists.length; i++) if ((r -= weights[i]) <= 0) { artist = artists[i]; break; }
        }
        const track = artist.tracks[Math.floor(Math.pow(rnd(), 1.6) * artist.tracks.length)];
        const skip = rnd() < (shuffle ? 0.27 : 0.12) + (hour < 5 ? 0.05 : 0);
        const ms = skip ? 2_000 + rnd() * 25_000 : track.len * (rnd() < 0.08 ? 0.5 + rnd() * 0.5 : 1);
        t += ms;
        out.push(
          entry(t, ms, platform, travel, track.name, artist.name, pick(artist.albums), track.uri, null, null,
            k === 0 ? "clickrow" : shuffle ? "trackdone" : pick(["trackdone", "trackdone", "fwdbtn"]),
            skip ? "fwdbtn" : "trackdone", shuffle, skip),
        );
      }
    }
  }
  return out.sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
}

function entry(
  t: number, ms: number, platform: string, country: string,
  track: string | null, artist: string | null, album: string | null, uri: string | null,
  episode: string | null, show: string | null, rs: string, re: string, shuffle: boolean, skipped: boolean,
): RawEntry {
  return {
    ts: new Date(Math.round(t / 1000) * 1000).toISOString().replace(/\.\d{3}Z$/, "Z"),
    platform,
    ms_played: Math.round(ms),
    conn_country: country,
    ip_addr: "0.0.0.0",
    master_metadata_track_name: track,
    master_metadata_album_artist_name: artist,
    master_metadata_album_album_name: album,
    spotify_track_uri: uri,
    episode_name: episode,
    episode_show_name: show,
    spotify_episode_uri: episode ? "spotify:episode:demo" : null,
    reason_start: rs,
    reason_end: re,
    shuffle,
    skipped,
    offline: platform.startsWith("iOS") && t % 29 === 0,
    offline_timestamp: null,
    incognito_mode: false,
  };
}
