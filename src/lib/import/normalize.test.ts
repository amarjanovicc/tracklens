import { describe, expect, it } from "vitest";
import { isHistoryFile, normalizeEntry, normalizeFile, normalizePlatform } from "./normalize";

const ext = {
  ts: "2024-03-01T20:15:00Z",
  username: "secret-user",
  platform: "iOS 17.2 (iPhone14,2)",
  ms_played: 185000,
  conn_country: "HR",
  ip_addr: "1.2.3.4",
  master_metadata_track_name: "Song",
  master_metadata_album_artist_name: "Artist",
  master_metadata_album_album_name: "Album",
  spotify_track_uri: "spotify:track:abc",
  episode_name: null,
  episode_show_name: null,
  spotify_episode_uri: null,
  reason_start: "clickrow",
  reason_end: "trackdone",
  shuffle: false,
  skipped: null,
  offline: false,
  incognito_mode: false,
};

describe("normalizeEntry", () => {
  it("maps the extended format and drops personal fields", () => {
    const n = normalizeEntry(ext)!;
    expect(n).toMatchObject({ trackName: "Song", artistName: "Artist", platform: "ios", country: "HR", skipped: false, kind: "track" });
    expect(JSON.stringify(n)).not.toContain("1.2.3.4");
    expect(JSON.stringify(n)).not.toContain("secret-user");
  });
  it("derives skips from short forward-button plays", () => {
    expect(normalizeEntry({ ...ext, ms_played: 4000, reason_end: "fwdbtn" })!.skipped).toBe(true);
    expect(normalizeEntry({ ...ext, ms_played: 4000, reason_end: "endplay" })!.skipped).toBe(false);
    expect(normalizeEntry({ ...ext, skipped: true })!.skipped).toBe(true);
  });
  it("handles podcast episodes", () => {
    const n = normalizeEntry({ ...ext, master_metadata_track_name: null, master_metadata_album_artist_name: null, episode_name: "Ep 1", episode_show_name: "Show" })!;
    expect(n).toMatchObject({ kind: "episode", trackName: "Ep 1", artistName: "Show", albumName: null });
  });
  it("drops zero-length and unknown entries", () => {
    expect(normalizeEntry({ ...ext, ms_played: 0 })).toBeNull();
    expect(normalizeEntry({ ...ext, master_metadata_track_name: null })).toBeNull();
    expect(normalizeEntry("nope")).toBeNull();
  });
  it("maps the basic account-data format", () => {
    const n = normalizeEntry({ endTime: "2023-01-31 18:04", artistName: "A", trackName: "T", msPlayed: 120000 })!;
    expect(n.playedAt).toBe("2023-01-31T18:04:00.000Z");
    expect(n.skipped).toBe(false);
  });
  it("normalizes whole files", () => {
    expect(normalizeFile([ext, { ...ext, ms_played: 0 }])).toHaveLength(1);
    expect(normalizeFile({})).toEqual([]);
  });
});

describe("helpers", () => {
  it("recognises export file names", () => {
    expect(isHistoryFile("Spotify Extended Streaming History/Streaming_History_Audio_2019-2021_0.json")).toBe(true);
    expect(isHistoryFile("MyData/endsong_3.json")).toBe(true);
    expect(isHistoryFile("MyData/StreamingHistory_music_0.json")).toBe(true);
    expect(isHistoryFile("Streaming_History_Video_2020.json")).toBe(false);
    expect(isHistoryFile("Userdata.json")).toBe(false);
  });
  it("normalizes platforms", () => {
    expect(normalizePlatform("Partner android_auto Android Auto")).toBe("car");
    expect(normalizePlatform("OS X 14.4.1 [arm 2]")).toBe("desktop");
    expect(normalizePlatform("web_player osx;chrome 128")).toBe("web");
    expect(normalizePlatform("Partner sonos_one Sonos One")).toBe("speaker");
    expect(normalizePlatform("Android OS 13 API 33 (samsung, SM-S911B)")).toBe("android");
    expect(normalizePlatform(null)).toBeNull();
  });
});
