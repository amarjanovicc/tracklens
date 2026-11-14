import { Suspense } from "react";
import { RangePicker } from "./range-picker";
import type { DateRange } from "@/lib/range";

export function RangeBar({ range, years }: { range: DateRange; years: number[] }) {
  return (
    <Suspense>
      <RangePicker current={range.key} years={years}
        from={range.key === "custom" ? range.from?.toISOString().slice(0, 10) : undefined}
        to={range.key === "custom" ? range.to?.toISOString().slice(0, 10) : undefined} />
    </Suspense>
  );
}
