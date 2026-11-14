import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import * as A from "@/lib/analytics";
import { BarList, Card, PageHeader, Stat } from "@/components/ui";
import { ColumnChart } from "@/components/charts";
import { enc, fmtDate, fmtDuration, fmtInt, pct, REASON_LABEL } from "@/lib/format";

type Props = { params: Promise<{ artist: string; name: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await params;
  return { title: `${decodeURIComponent(p.name)} · ${decodeURIComponent(p.artist)}` };
}

export default async function TrackPage({ params }: Props) {
  const user = await requireUser();
  const p = await params;
  const artist = decodeURIComponent(p.artist);
  const name = decodeURIComponent(p.name);
  const t = await A.trackDetail(user.id, name, artist, user.timezone);
  if (!t) notFound();
  const openUrl = t.uri?.startsWith("spotify:track:") ? `https://open.spotify.com/track/${t.uri.split(":")[2]}` : null;
  const total = t.reasons.reduce((a, b) => a + b.plays, 0) || 1;
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, plays: t.hours.find((x) => x.hour === h)?.plays ?? 0 }));

  return (
    <>
      <PageHeader title={name}
        description={<>by <Link href={`/app/artist/${enc(artist)}`} className="text-brand underline">{artist}</Link>{t.album && <> · {t.album}</>}{openUrl && <> · <a href={openUrl} target="_blank" rel="noreferrer" className="text-brand underline">Open in Spotify</a></>}</>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Streams" value={fmtInt(t.streams)} hint={`${fmtInt(t.plays)} plays incl. skips`} />
        <Stat label="Listening time" value={fmtDuration(t.minutes)} />
        <Stat label="First / last" value={fmtDate(t.first)} hint={`Last: ${fmtDate(t.last)}`} />
        <Stat label="Skip rate" value={pct(t.skipRate)} hint={t.completion != null ? `You hear ~${pct(t.completion)} of it on average` : undefined} />
      </div>
      <Card className="mt-6" title="Streams per month">
        <ColumnChart data={t.monthly} xKey="month" yKey="streams" name="Streams" format="count" xFormat="month" />
      </Card>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="How plays ended">
          <BarList format={(v) => pct(v / total)} items={t.reasons.map((r) => ({ key: r.key ?? "?", label: REASON_LABEL[r.key ?? ""] ?? r.key ?? "Unknown", value: r.plays }))} />
        </Card>
        <Card title="Time of day">
          <ColumnChart data={hours} xKey="hour" yKey="plays" name="Plays" format="count" xFormat="hour" height={180} />
        </Card>
      </div>
    </>
  );
}
