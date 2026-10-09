import { describe, it, expect } from "vitest";
import { formatCost } from "@/lib/utils";

describe("formatCost", () => {
  it("formats known costs in dollars", () => {
    expect(formatCost(0.0012)).toBe("$0.0012");
    expect(formatCost(1.5, 2)).toBe("$1.50");
  });

  it("shows unknown costs as n/a instead of $0", () => {
    expect(formatCost(null)).toBe("n/a");
    expect(formatCost(undefined)).toBe("n/a");
  });
});
