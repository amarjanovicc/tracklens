import { randomBytes } from "node:crypto";
import { z } from "zod";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { shareLink } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { limitsFor } from "@/lib/plans";
import { latestPlay } from "@/lib/analytics";
import { parseRange } from "@/lib/range";

const Body = z.object({
  title: z.string().trim().min(1).max(80),
  range: z.string().regex(/^(4w|6m|12m|all|y\d{4}|custom)$/),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
function slug(len = 8) {
  const bytes = randomBytes(len);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return Response.json({ error: "Not signed in" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  const [{ n }] = await db.select({ n: count() }).from(shareLink).where(eq(shareLink.userId, me.id));
  const limit = limitsFor(me.plan).shareLinks;
  if (n >= limit) {
    return Response.json(
      { error: `Your plan allows ${limit} share link${limit === 1 ? "" : "s"}. Delete one or upgrade to Pro.` },
      { status: 403 },
    );
  }

  const anchor = await latestPlay(me.id);
  if (!anchor) return Response.json({ error: "Import some listening history first." }, { status: 400 });
  const { range, from, to } = parsed.data;
  const r = parseRange({ range, from, to }, anchor);

  const row = { slug: slug(), userId: me.id, title: parsed.data.title, rangeFrom: r.from, rangeTo: r.to };
  await db.insert(shareLink).values(row);
  return Response.json({ slug: row.slug, url: `/share/${row.slug}` }, { status: 201 });
}

export async function DELETE(req: Request) {
  const me = await getCurrentUser();
  if (!me) return Response.json({ error: "Not signed in" }, { status: 401 });
  const s = new URL(req.url).searchParams.get("slug");
  if (!s) return Response.json({ error: "Missing slug" }, { status: 400 });
  const deleted = await db
    .delete(shareLink)
    .where(and(eq(shareLink.slug, s), eq(shareLink.userId, me.id)))
    .returning({ slug: shareLink.slug });
  if (!deleted.length) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ok: true });
}
