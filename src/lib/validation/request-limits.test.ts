import { describe, expect, it } from "vitest";

import {
  readUploadLimits,
  validateRequestContentLength,
} from "./request-limits";

describe("readUploadLimits", () => {
  it("uses the documented defaults", () => {
    expect(readUploadLimits({})).toEqual({
      maxFiles: 10,
      maxBytesPerFile: 10_485_760,
      maxRequestBytes: 105_906_176,
    });
  });

  it("reads positive integer overrides", () => {
    expect(
      readUploadLimits({
        MAX_UPLOAD_FILES: "2",
        MAX_UPLOAD_BYTES_PER_FILE: "1024",
      }),
    ).toEqual({
      maxFiles: 2,
      maxBytesPerFile: 1024,
      maxRequestBytes: 1_050_624,
    });
  });

  it.each(["0", "-1", "1.5", "not-a-number"])(
    "rejects invalid upload limits: %s",
    (value) => {
      expect(() =>
        readUploadLimits({
          MAX_UPLOAD_FILES: value,
          MAX_UPLOAD_BYTES_PER_FILE: "1024",
        }),
      ).toThrow();
    },
  );
});

describe("validateRequestContentLength", () => {
  it("allows a request within the limit", () => {
    const headers = new Headers({ "Content-Length": "512" });

    expect(validateRequestContentLength(headers, 1024)).toEqual({
      ok: true,
      contentLength: 512,
    });
  });

  it("rejects an oversized request before parsing", () => {
    const headers = new Headers({ "Content-Length": "1025" });

    expect(validateRequestContentLength(headers, 1024)).toEqual({
      ok: false,
      code: "request_too_large",
      maximumBytes: 1024,
    });
  });

  it("rejects malformed content lengths", () => {
    const headers = new Headers({ "Content-Length": "1kb" });

    expect(validateRequestContentLength(headers, 1024)).toEqual({
      ok: false,
      code: "invalid_content_length",
      maximumBytes: 1024,
    });
  });

  it("allows a missing header for later measured-body enforcement", () => {
    expect(validateRequestContentLength(new Headers(), 1024)).toEqual({
      ok: true,
      contentLength: null,
    });
  });
});
