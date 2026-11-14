import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/db", () => ({ sql: () => {} }));
const { streaks } = await import("./index");

describe("streaks", () => {
  it("finds longest and current runs", () => {
    expect(streaks(["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-05", "2024-01-06"])).toEqual({ longest: 3, current: 2 });
    expect(streaks([])).toEqual({ longest: 0, current: 0 });
    expect(streaks(["2024-02-28", "2024-02-29", "2024-03-01"])).toEqual({ longest: 3, current: 3 });
  });
});
