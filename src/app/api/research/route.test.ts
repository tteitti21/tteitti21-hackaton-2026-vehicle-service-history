import { afterEach, describe, expect, it, vi } from "vitest";

import { MaintenanceResearchOutputValidationError } from "@/lib/openai/research-maintenance";
import { InMemoryRateLimiter } from "@/lib/rate-limit/rate-limiter";
import {
  maintenanceResearchFixture,
  maintenanceResearchRequestFixture,
} from "@/test/maintenance-research-fixture";
import { createResearchPostHandler } from "./route";

const environment = {
  OPENAI_API_KEY: "server-only-test-key",
  OPENAI_RESEARCH_MODEL: "test-model",
  OPENAI_RESEARCH_TIMEOUT_MS: "5000",
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("POST /api/research", () => {
  it("returns source-backed research with no-store headers", async () => {
    const executeResearch = vi.fn().mockResolvedValue(maintenanceResearchFixture);
    const handler = createResearchPostHandler({
      environment,
      rateLimiter: new InMemoryRateLimiter(),
      executeResearch,
    });

    const response = await handler(createRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(maintenanceResearchFixture);
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(executeResearch).toHaveBeenCalledWith(
      maintenanceResearchRequestFixture,
      {
        apiKey: "server-only-test-key",
        model: "test-model",
        timeoutMs: 5_000,
      },
      expect.any(AbortSignal),
    );
  });

  it("rejects malformed and cross-origin requests before provider use", async () => {
    const executeResearch = vi.fn();
    const handler = createResearchPostHandler({
      environment,
      rateLimiter: new InMemoryRateLimiter(),
      executeResearch,
    });

    const forbidden = await handler(
      createRequest({ headers: { Origin: "https://attacker.example" } }),
    );
    const malformed = await handler(
      new Request("http://localhost/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
    );

    expect(forbidden.status).toBe(403);
    expect(malformed.status).toBe(400);
    expect(executeResearch).not.toHaveBeenCalled();
  });

  it("returns safe validation and provider errors without logging content", async () => {
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const invalidHandler = createResearchPostHandler({
      environment,
      rateLimiter: new InMemoryRateLimiter(),
      executeResearch: vi
        .fn()
        .mockRejectedValue(new MaintenanceResearchOutputValidationError()),
    });
    const invalid = await invalidHandler(createRequest());
    const providerHandler = createResearchPostHandler({
      environment,
      rateLimiter: new InMemoryRateLimiter(),
      executeResearch: vi
        .fn()
        .mockRejectedValue(new Error("SECRET provider body")),
    });
    const provider = await providerHandler(createRequest());

    expect(invalid.status).toBe(502);
    expect(await invalid.json()).toMatchObject({
      error: { code: "invalid_provider_output" },
    });
    expect(provider.status).toBe(502);
    expect(await provider.text()).not.toContain("SECRET");
    expect(consoleLog).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("returns a controlled timeout", async () => {
    vi.useFakeTimers();
    const handler = createResearchPostHandler({
      environment,
      rateLimiter: new InMemoryRateLimiter(),
      executeResearch: (_request, _config, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    });

    const responsePromise = handler(createRequest());
    await vi.advanceTimersByTimeAsync(5_000);
    const response = await responsePromise;

    expect(response.status).toBe(504);
    expect(await response.json()).toMatchObject({
      error: { code: "provider_timeout" },
    });
  });
});

function createRequest(init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  return new Request("http://localhost/api/research", {
    ...init,
    method: "POST",
    headers,
    body: JSON.stringify(maintenanceResearchRequestFixture),
  });
}
