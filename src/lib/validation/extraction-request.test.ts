import { describe, expect, it } from "vitest";

import { createExtractionRequest } from "@/test/extraction-request-fixture";

import {
  ExtractionRequestError,
  parseExtractionRequest,
} from "./extraction-request";
import type { UploadLimits } from "./request-limits";

const limits: UploadLimits = {
  maxFiles: 2,
  maxBytesPerFile: 1024,
  maxRequestBytes: 4096,
};

describe("parseExtractionRequest", () => {
  it("accepts a matching sanitized PNG and manifest", async () => {
    const request = createExtractionRequest([
      { id: "image-1", width: 32, height: 24 },
    ]);

    const images = await parseExtractionRequest(request, limits);

    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({
      imageId: "image-1",
      mediaType: "image/png",
      width: 32,
      height: 24,
    });
  });

  it("rejects original JPEG files at the server boundary", async () => {
    const body = new FormData();
    body.append(
      "images",
      new File(["original"], "original.jpg", { type: "image/jpeg" }),
    );
    body.append(
      "image_manifest",
      JSON.stringify([
        {
          clientId: "image-1",
          fileName: "original.jpg",
          mediaType: "image/jpeg",
          width: 1,
          height: 1,
        },
      ]),
    );

    await expect(
      parseExtractionRequest(
        new Request("http://localhost/api/extract", {
          method: "POST",
          body,
        }),
        limits,
      ),
    ).rejects.toMatchObject({
      code: expect.stringMatching(/invalid_request|unsupported_media_type/),
    });
  });

  it("rejects count, file-size, manifest, and dimension mismatches", async () => {
    await expect(
      parseExtractionRequest(
        createExtractionRequest([
          { id: "one", width: 1, height: 1 },
          { id: "two", width: 1, height: 1 },
          { id: "three", width: 1, height: 1 },
        ]),
        limits,
      ),
    ).rejects.toBeInstanceOf(ExtractionRequestError);

    const oversizedLimits = { ...limits, maxBytesPerFile: 10 };
    await expect(
      parseExtractionRequest(
        createExtractionRequest([{ id: "one", width: 1, height: 1 }]),
        oversizedLimits,
      ),
    ).rejects.toMatchObject({ code: "payload_too_large" });

    const mismatched = createExtractionRequest(
      [{ id: "one", width: 32, height: 24 }],
      { manifestWidth: 33 },
    );
    await expect(
      parseExtractionRequest(mismatched, limits),
    ).rejects.toMatchObject({ code: "invalid_request" });
  });

  it("rejects unexpected form fields and non-multipart bodies", async () => {
    const body = new FormData();
    body.append("unrelated_vehicle_field", "secret");

    await expect(
      parseExtractionRequest(
        new Request("http://localhost/api/extract", {
          method: "POST",
          body,
        }),
        limits,
      ),
    ).rejects.toMatchObject({ code: "invalid_request" });

    await expect(
      parseExtractionRequest(
        new Request("http://localhost/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        }),
        limits,
      ),
    ).rejects.toMatchObject({ code: "unsupported_media_type" });
  });
});
