import { afterEach, describe, expect, it, vi } from "vitest";

import { VehicleResolutionOutputValidationError } from "@/lib/openai/resolve-vehicle";
import { InMemoryRateLimiter } from "@/lib/rate-limit/rate-limiter";
import {
  confirmedVehicleFixture,
  vehicleResolutionFixture,
} from "@/test/vehicle-resolution-fixture";

import { createResolveVehiclePostHandler } from "./route";

const environment = {
  OPENAI_API_KEY: "server-only-test-key",
  OPENAI_RESEARCH_MODEL: "test-research-model",
  OPENAI_RESEARCH_TIMEOUT_MS: "5000",
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("POST /api/resolve-vehicle", () => {
  it("returns preserved candidates with no-store headers", async () => {
    const executeResolution = vi
      .fn()
      .mockResolvedValue(vehicleResolutionFixture);
    const handler = createResolveVehiclePostHandler({
      environment,
      rateLimiter: new InMemoryRateLimiter(),
      executeResolution,
    });

    const response = await handler(createRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(vehicleResolutionFixture);
    expect(response.headers.get("cache-control")).toBe(
      "no-store, max-age=0",
    );
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(executeResolution).toHaveBeenCalledWith(
      confirmedVehicleFixture,
      {
        apiKey: "server-only-test-key",
        model: "test-research-model",
        timeoutMs: 5_000,
      },
      expect.any(AbortSignal),
    );
  });

  it("rejects cross-origin and malformed requests before provider use", async () => {
    const executeResolution = vi.fn();
    const handler = createResolveVehiclePostHandler({
      environment,
      rateLimiter: new InMemoryRateLimiter(),
      executeResolution,
    });

    const crossOrigin = await handler(
      createRequest({
        headers: { Origin: "https://attacker.example" },
      }),
    );
    const malformed = await handler(
      new Request("http://localhost/api/resolve-vehicle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ make: "Toyota" }),
      }),
    );

    expect(crossOrigin.status).toBe(403);
    expect(malformed.status).toBe(400);
    expect(executeResolution).not.toHaveBeenCalled();
  });

  it("fails closed when the server-side key is missing", async () => {
    const executeResolution = vi.fn();
    const handler = createResolveVehiclePostHandler({
      environment: {},
      rateLimiter: new InMemoryRateLimiter(),
      executeResolution,
    });

    const response = await handler(createRequest());

    expect(response.status).toBe(503);
    expect(executeResolution).not.toHaveBeenCalled();
    expect(await response.text()).not.toContain("OPENAI_API_KEY");
  });

  it("returns safe errors without logging vehicle or provider content", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => {});
    const handler = createResolveVehiclePostHandler({
      environment,
      rateLimiter: new InMemoryRateLimiter(),
      executeResolution: vi
        .fn()
        .mockRejectedValue(
          new Error("SECRET_REGISTRATION provider response body"),
        ),
    });

    const response = await handler(createRequest());
    const payload = await response.text();

    expect(response.status).toBe(502);
    expect(payload).toContain("provider_error");
    expect(payload).not.toContain("SECRET_REGISTRATION");
    expect(payload).not.toContain("response body");
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleLog).not.toHaveBeenCalled();
  });

  it("distinguishes invalid provider output and timeout safely", async () => {
    const invalidHandler = createResolveVehiclePostHandler({
      environment,
      rateLimiter: new InMemoryRateLimiter(),
      executeResolution: vi
        .fn()
        .mockRejectedValue(new VehicleResolutionOutputValidationError()),
    });
    const invalidResponse = await invalidHandler(createRequest());

    expect(invalidResponse.status).toBe(502);
    expect(await invalidResponse.json()).toMatchObject({
      error: { code: "invalid_provider_output" },
    });

    vi.useFakeTimers();
    const timeoutHandler = createResolveVehiclePostHandler({
      environment,
      rateLimiter: new InMemoryRateLimiter(),
      executeResolution: (_vehicle, _config, signal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    });
    const responsePromise = timeoutHandler(createRequest());
    await vi.advanceTimersByTimeAsync(5_000);
    const timeoutResponse = await responsePromise;

    expect(timeoutResponse.status).toBe(504);
    expect(await timeoutResponse.json()).toMatchObject({
      error: { code: "provider_timeout" },
    });
  });

  it("rate-limits repeated requests using a privacy-preserving coarse key", async () => {
    const handler = createResolveVehiclePostHandler({
      environment,
      rateLimiter: new InMemoryRateLimiter(),
      executeResolution: vi.fn().mockResolvedValue(vehicleResolutionFixture),
    });
    const responses = [];

    for (let index = 0; index < 4; index += 1) {
      responses.push(
        await handler(
          createRequest({
            headers: { "X-Forwarded-For": "192.0.2.123" },
          }),
        ),
      );
    }

    expect(
      responses.slice(0, 3).every((response) => response.status === 200),
    ).toBe(true);
    expect(responses[3].status).toBe(429);
    expect(responses[3].headers.get("retry-after")).toBeTruthy();
  });
});

function createRequest(init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");

  return new Request("http://localhost/api/resolve-vehicle", {
    ...init,
    method: "POST",
    headers,
    body: JSON.stringify(confirmedVehicleFixture),
  });
}
