import { describe, expect, it } from "vitest";

import { applicationHeaders } from "./next.config";

describe("application response headers", () => {
  const headers = new Map(
    applicationHeaders.map(({ key, value }) => [key.toLowerCase(), value]),
  );

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
});
