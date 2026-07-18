import { describe, expect, it, vi } from "vitest";

import {
  extractServiceHistoryWithRetry,
  ExtractionOutputValidationError,
  type ExtractionAttemptProvider,
  type ExtractionInputImage,
} from "./extract-service-history";

const image: ExtractionInputImage = {
  imageId: "image-1",
  bytes: new Uint8Array([1, 2, 3]),
  mediaType: "image/png",
  width: 10,
  height: 10,
};

const validHistory = {
  images: [{ image_id: "image-1", readability: 0.2, notes: "Illegible" }],
  events: [],
  warnings: ["No supported service event was readable."],
};

describe("extractServiceHistoryWithRetry", () => {
  it("returns a strictly validated honest empty result", async () => {
    const provider: ExtractionAttemptProvider = {
      extract: vi.fn().mockResolvedValue(validHistory),
    };

    await expect(
      extractServiceHistoryWithRetry(
        provider,
        [image],
        new AbortController().signal,
      ),
    ).resolves.toEqual(validHistory);
    expect(provider.extract).toHaveBeenCalledTimes(1);
  });

  it("retries exactly once after schema validation fails", async () => {
    const extract = vi
      .fn()
      .mockResolvedValueOnce({ events: "invalid" })
      .mockResolvedValueOnce(validHistory);

    await expect(
      extractServiceHistoryWithRetry(
        { extract },
        [image],
        new AbortController().signal,
      ),
    ).resolves.toEqual(validHistory);
    expect(extract).toHaveBeenCalledTimes(2);
    expect(extract.mock.calls[0][0].retry).toBe(false);
    expect(extract.mock.calls[1][0].retry).toBe(true);
  });

  it("rejects unknown image references and duplicate event IDs", async () => {
    const invalidReferences = {
      images: [{ image_id: "unknown", readability: 1, notes: null }],
      events: [],
      warnings: [],
    };
    const provider = {
      extract: vi.fn().mockResolvedValue(invalidReferences),
    };

    await expect(
      extractServiceHistoryWithRetry(
        provider,
        [image],
        new AbortController().signal,
      ),
    ).rejects.toBeInstanceOf(ExtractionOutputValidationError);
    expect(provider.extract).toHaveBeenCalledTimes(2);
  });

  it("does not retry provider failures", async () => {
    const providerError = new Error("provider payload with sensitive data");
    const provider = {
      extract: vi.fn().mockRejectedValue(providerError),
    };

    await expect(
      extractServiceHistoryWithRetry(
        provider,
        [image],
        new AbortController().signal,
      ),
    ).rejects.toBe(providerError);
    expect(provider.extract).toHaveBeenCalledTimes(1);
  });
});
