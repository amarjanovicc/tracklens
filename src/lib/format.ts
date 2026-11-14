const nf = new Intl.NumberFormat("en-US");
const nf1 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

export const fmtInt = (n: number | null | undefined) => (n == null ? "–" : nf.format(Math.round(n)));
export const fmt1 = (n: number | null | undefined) => (n == null ? "–" : nf1.format(n));
export const pct = (n: number | null | undefined, digits = 0) =>
  n == null || Number.isNaN(n) ? "–" : `${(n * 100).toFixed(digits)}%`;

/** 27 327 min → "455 h"; 92 → "1 h 32 min"; 12 → "12 min" */
export function fmtDuration(minutes: number | null | undefined) {
  if (minutes == null) return "–";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h >= 100) return `${nf.format(h)} h`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function fmtDate(d: Date | string | null | undefined, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" }, tz?: string) {
  if (!d) return "–";
  const date = typeof d === "string" ? new Date(d.length === 10 ? d + "T12:00:00Z" : d) : d;
  return new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: tz }).format(date);
}

export const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const PLATFORM_LABEL: Record<string, string> = {
  ios: "iPhone / iPad",
  android: "Android",
  desktop: "Desktop app",
  web: "Web player",
  speaker: "Speakers & Connect",
  tv: "TV",
  car: "Car",
  console: "Console",
  other: "Other",
};

export const REASON_LABEL: Record<string, string> = {
  trackdone: "Played to the end",
  fwdbtn: "Skipped forward",
  backbtn: "Went back",
  endplay: "Stopped playback",
  logout: "Logged out",
  remote: "Changed from another device",
  clickrow: "Picked it",
  playbtn: "Pressed play",
  appload: "App opened",
  trackerror: "Playback error",
  unexpected_exit: "App closed",
  unexpected_exit_while_paused: "App closed while paused",
};

export function countryName(code: string | null) {
  if (!code) return "Unknown";
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export const enc = (s: string) => encodeURIComponent(s);
