import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import * as A from "@/lib/analytics";
import { Card, PageHeader, Stat } from "@/components/ui";
import { ColumnChart } from "@/components/charts";
import { enc, fmtDate, fmtDuration, fmtInt, pct } from "@/lib/format";

type Props = { params: Promise<{ name: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: decodeURIComponent((await params).name) };
}

export default async function ArtistPage({ params }: Props) {
  const user = await requireUser();
  const name = decodeURIComponent((await params).name);
  const a = await A.artistDetail(user.id, name, user.timezone);
  if (!a) notFound();
  const peakHour = a.hours.reduce((x, y) => (y.minutes > x.minutes ? y : x), a.hours[0]);
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, minutes: a.hours.find((x) => x.hour === h)?.minutes ?? 0 }));
  const search = `https://open.spotify.com/search/${enc(name)}`;

  return (
    <>
      <PageHeader title={name} description={<>Your #{a.rank} artist of all time · {pct(a.share, 1)} of everything you&apos;ve played · <a href={search} target="_blank" rel="noreferrer" className="text-brand underline">Open in Spotify</a></>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Listening time" value={fmtDuration(a.minutes)} />
        <Stat label="Streams" value={fmtInt(a.streams)} hint={`${a.tracks} different tracks`} />
        <Stat label="First listen" value={fmtDate(a.first)} hint={`Last: ${fmtDate(a.last)}`} />
        <Stat label="Skip rate" value={pct(a.skipRate)} hint={peakHour ? `Usually around ${String(peakHour.hour).padStart(2, "0")}:00` : undefined} />
      </div>
      <Card className="mt-6" title="Your history with this artist" subtitle="Listening time per month">
        <ColumnChart data={a.monthly} xKey="month" yKey="minutes" name="Listening" xFormat="month" />
      </Card>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card title="Tracks">
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[460px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-ink-3">
                <tr><th className="px-2 py-2">Track</th><th className="px-2 py-2 text-right">Time</th><th className="px-2 py-2 text-right">Streams</th><th className="px-2 py-2 text-right">Skips</th><th className="px-2 py-2 text-right">Found</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {a.topTracks.map((t) => (
                  <tr key={t.name}>
                    <td className="max-w-[240px] truncate px-2 py-2"><Link className="font-medium hover:underline" href={`/app/track/${enc(name)}/${enc(t.name)}`}>{t.name}</Link></td>
                    <td className="tabular px-2 py-2 text-right">{fmtDuration(t.minutes)}</td>
                    <td className="tabular px-2 py-2 text-right text-ink-2">{t.streams}</td>
                    <td className="tabular px-2 py-2 text-right text-ink-2">{pct(t.skipRate)}</td>
                    <td className="px-2 py-2 text-right text-ink-3">{fmtDate(t.first, { month: "short", year: "numeric" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="space-y-6">
          <Card title="When you play them">
            <ColumnChart data={hours} xKey="hour" yKey="minutes" name="Listening" xFormat="hour" height={180} />
          </Card>
          {a.albums.length > 0 && (
            <Card title="Albums">
              <ul className="divide-y divide-line text-sm">
                {a.albums.map((al) => (
                  <li key={al.name} className="flex justify-between gap-3 py-2">
                    <span className="truncate">{al.name}</span>
                    <span className="tabular shrink-0 text-ink-2">{fmtDuration(al.minutes)} · {al.tracks} tracks</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
