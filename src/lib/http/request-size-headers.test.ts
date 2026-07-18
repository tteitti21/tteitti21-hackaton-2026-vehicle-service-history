import { describe, expect, it } from "vitest";

import {
  createRequestSizeResponseHeaders,
  readRequestSizeResponseHeaders,
} from "./request-size-headers";

describe("request size response headers", () => {
  it("round-trips safe byte counts without request content", () => {
    const responseHeaders = createRequestSizeResponseHeaders(
      new Headers({ "content-length": "31457280" }),
      210_763_776,
    );

    expect(readRequestSizeResponseHeaders(new Headers(responseHeaders))).toEqual(
      {
        requestBodyBytes: 31_457_280,
        maximumRequestBytes: 210_763_776,
      },
    );
  });

  it("omits a missing or invalid content length", () => {
    expect(
      readRequestSizeResponseHeaders(
        new Headers(
          createRequestSizeResponseHeaders(
            new Headers({ "content-length": "not-a-number" }),
            1_024,
          ),
        ),
      ),
    ).toEqual({
      requestBodyBytes: null,
      maximumRequestBytes: 1_024,
    });
  });
});
