import { describe, expect, it } from "vitest";

import {
  applicationHeaders,
  createApplicationHeaders,
} from "./next.config";

function mapHeaders(headers: Array<{ key: string; value: string }>) {
  return new Map(headers.map(({ key, value }) => [key.toLowerCase(), value]));
}

describe("application response headers", () => {
  const headers = mapHeaders(applicationHeaders);

  it("prevents persistence, framing, sniffing, and referrer leakage", () => {
    expect(headers.get("cache-control")).toContain("no-store");
    expect(headers.get("pragma")).toBe("no-cache");
    expect(headers.get("x-content-type-options")).toBe("nosniff");
    expect(headers.get("x-frame-options")).toBe("DENY");
    expect(headers.get("referrer-policy")).toBe(
      "strict-origin-when-cross-origin",
    );
  });

  it("limits browser capabilities and external content", () => {
    expect(headers.get("permissions-policy")).toContain("camera=()");
    expect(headers.get("permissions-policy")).toContain("microphone=()");
    expect(headers.get("cross-origin-opener-policy")).toBe("same-origin");
    expect(headers.get("cross-origin-resource-policy")).toBe("same-origin");

    const policy = headers.get("content-security-policy");
    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("connect-src 'self' blob:");
    expect(policy).toContain("img-src 'self' blob: data:");
    expect(policy).toContain("object-src 'none'");
  });

  it("allows React evaluation only for the development server", () => {
    const developmentPolicy = mapHeaders(
      createApplicationHeaders("development"),
    ).get("content-security-policy");
    const productionPolicy = mapHeaders(
      createApplicationHeaders("production"),
    ).get("content-security-policy");
    const testPolicy = mapHeaders(createApplicationHeaders("test")).get(
      "content-security-policy",
    );

    expect(developmentPolicy).toContain("'unsafe-eval'");
    expect(productionPolicy).not.toContain("'unsafe-eval'");
    expect(testPolicy).not.toContain("'unsafe-eval'");
  });
});
