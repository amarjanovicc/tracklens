/**
 * Normalises the different shapes of Spotify privacy-export files into one
 * compact record. Runs in the browser, so IP addresses, user agents and the
 * account username in the export never leave the user's machine.
 *
 * Supported inputs:
 *  - Extended streaming history: Streaming_History_Audio_*.json (2023+),
 *    endsong_*.json (older exports)
 *  - Basic account data: StreamingHistory_music_*.json / StreamingHistory*.json
 *    (last ~12 months only, no URIs, no skip/shuffle info)
 */

export type NormalizedPlay = {
  playedAt: string; // ISO, UTC, time the stream ended (as in the export)
  msPlayed: number;
  kind: "track" | "episode";
  trackUri: string | null;
  trackName: string;
  artistName: string;
  albumName: string | null;
  platform: string | null;
  country: string | null;
  reasonStart: string | null;
  reasonEnd: string | null;
  shuffle: boolean | null;
  skipped: boolean;
  offline: boolean | null;
  incognito: boolean | null;
};

/** A stream counts once 30 s have been played, the same rule Spotify uses for royalties. */
export const STREAM_THRESHOLD_MS = 30_000;

const HISTORY_FILE_RE =
  /(Streaming_History_Audio_[^/]*\.json|endsong_\d+\.json|StreamingHistory_music_\d+\.json|StreamingHistory\d+\.json)$/i;

export function isHistoryFile(name: string) {
  return HISTORY_FILE_RE.test(name);
}

export function normalizePlatform(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const p = raw.toLowerCase();
  if (/(android[ _]?auto|carplay|\bcar\b|automotive)/.test(p)) return "car";
  if (/(playstation|ps[345]|xbox|nintendo)/.test(p)) return "console";
  if (/(\btv\b|android_tv|tizen|webos|roku|fire ?tv|apple ?tv|tvos)/.test(p)) return "tv";
  if (/(cast|sonos|speaker|alexa|amazon|google[_ ]home|echo|bose|homepod|partner)/.test(p)) return "speaker";
  if (/(ios|iphone|ipad)/.test(p)) return "ios";
  if (/android/.test(p)) return "android";
  if (/(web[_ ]?player|webplayer|chrome|firefox|safari|edge|browser)/.test(p)) return "web";
  if (/(windows|os ?x|macos|mac os|linux|desktop)/.test(p)) return "desktop";
  return "other";
}

type Extended = {
  ts?: string;
  ms_played?: number;
  platform?: string | null;
  conn_country?: string | null;
  master_metadata_track_name?: string | null;
  master_metadata_album_artist_name?: string | null;
  master_metadata_album_album_name?: string | null;
  spotify_track_uri?: string | null;
  episode_name?: string | null;
  episode_show_name?: string | null;
  spotify_episode_uri?: string | null;
  reason_start?: string | null;
  reason_end?: string | null;
  shuffle?: boolean | null;
  skipped?: boolean | null;
  offline?: boolean | null;
  incognito_mode?: boolean | null;
};

type Basic = {
  endTime?: string; // "2023-01-31 18:04" (UTC)
  artistName?: string;
  trackName?: string;
  msPlayed?: number;
};

function deriveSkip(ms: number, flag: boolean | null | undefined, reasonEnd: string | null | undefined) {
  if (flag === true) return true;
  return ms < STREAM_THRESHOLD_MS && (reasonEnd === "fwdbtn" || reasonEnd === "backbtn");
}

export function normalizeEntry(e: unknown): NormalizedPlay | null {
  if (!e || typeof e !== "object") return null;
  const r = e as Extended & Basic;

  // Extended format
  if (typeof r.ts === "string") {
    const ms = Number(r.ms_played ?? 0);
    if (!(ms > 0)) return null;
    const isEpisode = !r.master_metadata_track_name && !!r.episode_name;
    const trackName = isEpisode ? r.episode_name : r.master_metadata_track_name;
    const artistName = isEpisode ? r.episode_show_name : r.master_metadata_album_artist_name;
    if (!trackName || !artistName) return null; // audiobooks / unknown local files
    return {
      playedAt: new Date(r.ts).toISOString(),
      msPlayed: Math.round(ms),
      kind: isEpisode ? "episode" : "track",
      trackUri: (isEpisode ? r.spotify_episode_uri : r.spotify_track_uri) ?? null,
      trackName: trackName.slice(0, 500),
      artistName: artistName.slice(0, 300),
      albumName: isEpisode ? null : (r.master_metadata_album_album_name ?? null),
      platform: normalizePlatform(r.platform),
      country: r.conn_country && r.conn_country !== "ZZ" ? r.conn_country : null,
      reasonStart: r.reason_start ?? null,
      reasonEnd: r.reason_end ?? null,
      shuffle: r.shuffle ?? null,
      skipped: deriveSkip(ms, r.skipped, r.reason_end),
      offline: r.offline ?? null,
      incognito: r.incognito_mode ?? null,
    };
  }

  // Basic "Account data" format
  if (typeof r.endTime === "string" && r.trackName && r.artistName) {
    const ms = Number(r.msPlayed ?? 0);
    if (!(ms > 0)) return null;
    const d = new Date(r.endTime.replace(" ", "T") + ":00Z");
    if (Number.isNaN(d.getTime())) return null;
    return {
      playedAt: d.toISOString(),
      msPlayed: Math.round(ms),
      kind: "track",
      trackUri: null,
      trackName: r.trackName.slice(0, 500),
      artistName: r.artistName.slice(0, 300),
      albumName: null,
      platform: null,
      country: null,
      reasonStart: null,
      reasonEnd: null,
      shuffle: null,
      skipped: ms < 10_000, // no skip flag in this format; very short plays are skips
      offline: null,
      incognito: null,
    };
  }
  return null;
}

export function normalizeFile(json: unknown): NormalizedPlay[] {
  if (!Array.isArray(json)) return [];
  const out: NormalizedPlay[] = [];
  for (const e of json) {
    const n = normalizeEntry(e);
    if (n) out.push(n);
  }
  return out;
}
