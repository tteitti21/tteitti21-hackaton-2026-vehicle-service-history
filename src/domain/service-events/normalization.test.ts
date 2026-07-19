import { describe, expect, it } from "vitest";

import {
  MILES_TO_KILOMETRES,
  normalizeOdometer,
  normalizeServiceDate,
} from "./normalization";

describe("service-event normalization", () => {
  it("converts miles with the exact factor while preserving source evidence", () => {
    const normalized = normalizeOdometer({
      value: 100,
      unit: "mi",
      confidence: 0.9,
    });

    expect(MILES_TO_KILOMETRES).toBe(1.609344);
    expect(normalized).toEqual({
      status: "valid",
      originalValue: 100,
      originalUnit: "mi",
      kilometres: 160.9344,
    });
  });

  it("does not reinterpret an unknown unit as kilometres", () => {
    expect(
      normalizeOdometer({
        value: 100_000,
        unit: "unknown",
        confidence: 0.4,
      }),
    ).toMatchObject({
      status: "unverified",
      originalValue: 100_000,
      originalUnit: "unknown",
      kilometres: null,
    });
  });

  it("rejects negative, fractional, and unsafe odometer evidence", () => {
    for (const value of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(
        normalizeOdometer({ value, unit: "km", confidence: 0.5 }),
      ).toMatchObject({ status: "invalid", kilometres: null });
    }
  });

  it("validates day, month, and year values against their precision", () => {
    expect(
      normalizeServiceDate({
        value: "2024-02-29",
        precision: "day",
        confidence: 1,
      }).status,
    ).toBe("valid");
    expect(
      normalizeServiceDate({
        value: "2023-02-29",
        precision: "day",
        confidence: 1,
      }).status,
    ).toBe("invalid");
    expect(
      normalizeServiceDate({
        value: "2024-13",
        precision: "month",
        confidence: 1,
      }).status,
    ).toBe("invalid");
    expect(
      normalizeServiceDate({
        value: "2024",
        precision: "year",
        confidence: 1,
      }).status,
    ).toBe("valid");
  });

  it("preserves an uncertain date without treating it as validated", () => {
    expect(
      normalizeServiceDate({
        value: "12/3? 2024",
        precision: "unknown",
        confidence: 0.2,
      }),
    ).toEqual({
      status: "unverified",
      value: "12/3? 2024",
      earliestUtc: null,
      latestUtc: null,
    });
  });
});
