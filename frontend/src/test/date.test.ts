import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatDate, formatRelativeTime } from "@/lib/date";

describe("formatRelativeTime", () => {
  const now = new Date("2026-03-15T12:00:00Z");

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

  it("reports very recent timestamps as just now", () => {
    expect(formatRelativeTime(ago(30_000))).toBe("just now");
  });

  it("uses minutes, hours and days for recent timestamps", () => {
    expect(formatRelativeTime(ago(5 * 60_000))).toBe("5m ago");
    expect(formatRelativeTime(ago(3 * 3_600_000))).toBe("3h ago");
    expect(formatRelativeTime(ago(2 * 86_400_000))).toBe("2d ago");
  });

  it("falls back to an absolute date after 30 days", () => {
    const iso = ago(45 * 86_400_000);
    expect(formatRelativeTime(iso)).toBe(formatDate(iso));
  });
});
