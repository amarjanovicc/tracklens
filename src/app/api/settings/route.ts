import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { getCurrentUser } from "@/lib/session";
import { isValidTimezone } from "@/lib/range";

const Body = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  timezone: z.string().max(64).refine(isValidTimezone, "Unknown timezone").optional(),
});

export async function PATCH(req: Request) {
  const me = await getCurrentUser();
  if (!me) return Response.json({ error: "Not signed in" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  const { name, timezone } = parsed.data;
  if (name === undefined && timezone === undefined) return Response.json({ error: "Nothing to update" }, { status: 400 });
  await db
    .update(user)
    .set({ ...(name !== undefined && { name }), ...(timezone !== undefined && { timezone }), updatedAt: new Date() })
    .where(eq(user.id, me.id));
  return Response.json({ ok: true });
}
