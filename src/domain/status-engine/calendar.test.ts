import { describe, expect, it } from "vitest";

import {
  addCalendarMonths,
  completeCalendarMonthsBetween,
  formatIsoDate,
} from "./calendar";

describe("status-engine calendar helpers", () => {
  it("counts only complete calendar months at exact boundaries", () => {
    const start = new Date("2025-01-15T00:00:00Z");

    expect(
      completeCalendarMonthsBetween(
        start,
        new Date("2025-02-14T00:00:00Z"),
      ),
    ).toBe(0);
    expect(
      completeCalendarMonthsBetween(
        start,
        new Date("2025-02-15T00:00:00Z"),
      ),
    ).toBe(1);
    expect(
      completeCalendarMonthsBetween(
        start,
        new Date("2026-01-15T00:00:00Z"),
      ),
    ).toBe(12);
  });

  it("clamps month-end anniversaries deterministically", () => {
    const january31 = new Date("2024-01-31T00:00:00Z");

    expect(formatIsoDate(addCalendarMonths(january31, 1))).toBe("2024-02-29");
    expect(
      completeCalendarMonthsBetween(
        january31,
        new Date("2024-02-28T00:00:00Z"),
      ),
    ).toBe(0);
    expect(
      completeCalendarMonthsBetween(
        january31,
        new Date("2024-02-29T00:00:00Z"),
      ),
    ).toBe(1);
    expect(formatIsoDate(addCalendarMonths(new Date("2023-01-31"), 1))).toBe(
      "2023-02-28",
    );
  });

  it("rejects invalid dates, reverse ranges, and fractional month offsets", () => {
    expect(() =>
      completeCalendarMonthsBetween(
        new Date("2025-02-01"),
        new Date("2025-01-01"),
      ),
    ).toThrow(RangeError);
    expect(() => addCalendarMonths(new Date("invalid"), 1)).toThrow(RangeError);
    expect(() => addCalendarMonths(new Date("2025-01-01"), 1.5)).toThrow(
      RangeError,
    );
  });
});
