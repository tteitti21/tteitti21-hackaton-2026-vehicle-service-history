import { describe, expect, it } from "vitest";

import {
  hasSafeImageDimensions,
  validateImageSelection,
} from "./image-validation";

describe("validateImageSelection", () => {
  const limits = {
    maxFiles: 2,
    maxBytesPerFile: 5,
  };

  it("accepts supported files within the configured limits", () => {
    const png = new File(["1234"], "synthetic.png", { type: "image/png" });

    expect(validateImageSelection([png], 0, limits)).toEqual({
      accepted: [png],
      issues: [],
    });
  });

  it("rejects unsupported, empty, oversized, and excess files before decoding", () => {
    const unsupported = new File(["x"], "notes.txt", { type: "text/plain" });
    const empty = new File([], "empty.png", { type: "image/png" });
    const oversized = new File(["123456"], "large.webp", {
      type: "image/webp",
    });
    const accepted = new File(["ok"], "first.jpg", { type: "image/jpeg" });
    const excess = new File(["ok"], "second.png", { type: "image/png" });

    const result = validateImageSelection(
      [unsupported, empty, oversized, accepted, excess],
      1,
      limits,
    );

    expect(result.accepted).toEqual([accepted]);
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "unsupported_type",
      "empty_file",
      "file_too_large",
      "too_many_files",
    ]);
  });
});

describe("hasSafeImageDimensions", () => {
  it("accepts normal image dimensions", () => {
    expect(hasSafeImageDimensions(4_000, 3_000)).toBe(true);
  });

  it.each([
    [0, 100],
    [100, 0],
    [10_000, 10_000],
    [Number.NaN, 100],
  ])("rejects unsafe dimensions %s × %s", (width, height) => {
    expect(hasSafeImageDimensions(width, height)).toBe(false);
  });
});
