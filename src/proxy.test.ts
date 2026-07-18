import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, it } from "vitest";

import nextConfig from "../next.config";

import { config } from "./proxy";

describe("proxy matcher", () => {
  it("does not buffer the extraction upload route", () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig,
        url: "/api/extract",
      }),
    ).toBe(false);
  });

  it("continues to apply the privacy headers to page routes", () => {
    expect(
      unstable_doesMiddlewareMatch({
        config,
        nextConfig,
        url: "/tietosuoja",
      }),
    ).toBe(true);
  });
});
