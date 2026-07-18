import { afterEach, describe, expect, it, vi } from "vitest";

import { InMemoryRateLimiter } from "@/lib/rate-limit/rate-limiter";
import { createExtractionRequest } from "@/test/extraction-request-fixture";

import { createExtractPostHandler } from "./route";

const environment = {
  OPENAI_API_KEY: "server-only-test-key",
  OPENAI_EXTRACTION_MODEL: "test-model",
  OPENAI_EXTRACTION_TIMEOUT_MS: "5000",
  MAX_UPLOAD_FILES: "2",
  MAX_UPLOAD_BYTES_PER_FILE: "1024",
};

const validHistory = {
  images: [{ image_id: "image-1", readability: 0.9, notes: null }],
  events: [],
  warnings: ["No events in this synthetic image."],
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("POST /api/extract", () => {
  it("returns a validated result with no-store headers", async () => {
    const executeExtraction = vi.fn().mockResolvedValue(validHistory);
    const handler = createExtractPostHandler({
      environment,
      rateLimiter: new InMemoryRateLimiter(),
      executeExtraction,
    });

    const response = await handler(
      createExtractionRequest([{ id: "image-1", width: 32, height: 24 }]),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(validHistory);
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(
      Number(response.headers.get("x-autohuolto-request-body-bytes")),
    ).toBeGreaterThan(0);
    expect(
      Number(response.headers.get("x-autohuolto-request-body-limit-bytes")),
    ).toBe(2 * 1_024 + 1_048_576);
    expect(executeExtraction).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          imageId: "image-1",
          mediaType: "image/png",
        }),
      ],
      expect.objectContaining({
        apiKey: "server-only-test-key",
        model: "test-model",
      }),
      expect.any(AbortSignal),
    );
  });

  it("accepts a sanitized PNG above the previous 10 MiB limit", async () => {
    const executeExtraction = vi.fn().mockResolvedValue(validHistory);
    const handler = createExtractPostHandler({
      environment: {
        ...environment,
        MAX_UPLOAD_FILES: "1",
        MAX_UPLOAD_BYTES_PER_FILE: "20971520",
      },
      rateLimiter: new InMemoryRateLimiter(),
      executeExtraction,
    });

    const response = await handler(
      createExtractionRequest([
        {
          id: "image-1",
          width: 32,
          height: 24,
          byteLength: 15 * 1_048_576,
        },
      ]),
    );

    expect(response.status).toBe(200);
    expect(
      Number(response.headers.get("x-autohuolto-request-body-bytes")),
    ).toBeGreaterThan(15 * 1_048_576);
    expect(executeExtraction).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          imageId: "image-1",
          bytes: expect.objectContaining({
            byteLength: 15 * 1_048_576,
          }),
        }),
      ],
      expect.any(Object),
      expect.any(AbortSignal),
    );
  });

  it("rejects cross-origin requests before reading the body", async () => {
    const executeExtraction = vi.fn();
    const handler = createExtractPostHandler({
      environment,
      rateLimiter: new InMemoryRateLimiter(),
      executeExtraction,
    });
    const response = await handler(
      createExtractionRequest(
        [{ id: "image-1", width: 1, height: 1 }],
        { origin: "https://attacker.example" },
      ),
    );

    expect(response.status).toBe(403);
    expect(executeExtraction).not.toHaveBeenCalled();
  });

  it("returns safe provider errors without logging user content", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    const handler = createExtractPostHandler({
      environment,
      rateLimiter: new InMemoryRateLimiter(),
      executeExtraction: vi
        .fn()
        .mockRejectedValue(
          new Error("SECRET_REGISTRATION OCR BODY provider detail"),
        ),
    });

    const response = await handler(
      createExtractionRequest([{ id: "image-1", width: 1, height: 1 }]),
    );
    const payload = await response.text();

    expect(response.status).toBe(502);
    expect(payload).toContain("provider_error");
    expect(payload).not.toContain("SECRET_REGISTRATION");
    expect(payload).not.toContain("provider detail");
    expect(
      Number(response.headers.get("x-autohuolto-request-body-bytes")),
    ).toBeGreaterThan(0);
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleLog).not.toHaveBeenCalled();
  });

  it("aborts and returns a safe timeout response", async () => {
    vi.useFakeTimers();
    const handler = createExtractPostHandler({
      environment,
      rateLimiter: new InMemoryRateLimiter(),
      executeExtraction: (_images, _config, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    });

    const responsePromise = handler(
      createExtractionRequest([{ id: "image-1", width: 1, height: 1 }]),
    );
    await vi.advanceTimersByTimeAsync(5_000);
    const response = await responsePromise;

    expect(response.status).toBe(504);
    expect(await response.json()).toMatchObject({
      error: { code: "provider_timeout" },
    });
  });

  it("rate-limits repeated requests using an in-memory coarse key", async () => {
    const handler = createExtractPostHandler({
      environment,
      rateLimiter: new InMemoryRateLimiter(),
      executeExtraction: vi.fn().mockResolvedValue(validHistory),
    });
    const responses = [];

    for (let index = 0; index < 6; index += 1) {
      responses.push(
        await handler(
          createExtractionRequest([{ id: "image-1", width: 1, height: 1 }]),
        ),
      );
    }

    expect(responses.slice(0, 5).every((response) => response.status === 200)).toBe(
      true,
    );
    expect(responses[5].status).toBe(429);
    expect(responses[5].headers.get("retry-after")).toBeTruthy();
  });

  it("fails closed when the server-side key is missing", async () => {
    const executeExtraction = vi.fn();
    const handler = createExtractPostHandler({
      environment: {},
      rateLimiter: new InMemoryRateLimiter(),
      executeExtraction,
    });

    const response = await handler(
      createExtractionRequest([{ id: "image-1", width: 1, height: 1 }]),
    );

    expect(response.status).toBe(503);
    expect(executeExtraction).not.toHaveBeenCalled();
    expect(await response.text()).not.toContain("OPENAI_API_KEY");
  });
});
