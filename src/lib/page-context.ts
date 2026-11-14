import "server-only";
import { requireUser } from "./session";
import { availableYears, latestPlay, scopeOf } from "./analytics";
import { parseRange, previousRange, type RangeKey } from "./range";

type SP = Record<string, string | string[] | undefined>;

/** Everything a range-aware dashboard page needs, resolved once. */
export async function getPageContext(searchParams: Promise<SP>, fallback: RangeKey = "12m") {
  const user = await requireUser();
  const sp = await searchParams;
  const [anchor, years] = await Promise.all([latestPlay(user.id), availableYears(user.id, user.timezone)]);
  const range = parseRange(sp, anchor, fallback);
  const prev = previousRange(range, anchor);
  return {
    user,
    sp,
    anchor,
    years,
    range,
    scope: scopeOf(user.id, range, user.timezone),
    prevScope: prev ? scopeOf(user.id, prev, user.timezone) : null,
    hasData: anchor !== null,
  };
}
