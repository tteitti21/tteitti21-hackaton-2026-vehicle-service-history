import { describe, expect, it } from "vitest";

import { NO_STORE_HEADERS, withNoStoreHeaders } from "./no-store";

describe("withNoStoreHeaders", () => {
  it("adds all required response headers", () => {
    const headers = withNoStoreHeaders({ "X-Request-Id": "synthetic-id" });

    expect(headers.get("cache-control")).toBe(
      NO_STORE_HEADERS["Cache-Control"],
    );
    expect(headers.get("pragma")).toBe(NO_STORE_HEADERS.Pragma);
    expect(headers.get("x-content-type-options")).toBe(
      NO_STORE_HEADERS["X-Content-Type-Options"],
    );
    expect(headers.get("x-request-id")).toBe("synthetic-id");
  });

  it("overrides a cacheable response", () => {
    const headers = withNoStoreHeaders({ "Cache-Control": "public" });

    expect(headers.get("cache-control")).toContain("no-store");
  });
});
