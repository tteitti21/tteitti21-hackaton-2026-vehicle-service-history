import { describe, expect, it, vi } from "vitest";

import {
  buildSanitizedSubmission,
  postSanitizedImages,
} from "./sanitized-submission";

describe("sanitized submission boundary", () => {
  it("builds multipart data only from newly rendered sanitized blobs", async () => {
    const original = new File(
      ["ORIGINAL_SECRET_REGISTRATION_ABC-123"],
      "customer-original.jpg",
      { type: "image/jpeg", lastModified: 1_750_000_000_000 },
    );
    const sanitized = new Blob(["SANITIZED_CANVAS_PIXELS"], {
      type: "image/png",
    });

    const submission = buildSanitizedSubmission([
      {
        clientId: "client-safe-id",
        blob: sanitized,
        width: 320,
        height: 180,
      },
    ]);
    const transmittedFile = submission.body.getAll("images")[0];

    expect(transmittedFile).toBeInstanceOf(File);
    expect(transmittedFile).not.toBe(original);
    expect((transmittedFile as File).name).toBe(
      "sanitized-1-client-safe-id.png",
    );
    expect((transmittedFile as File).type).toBe("image/png");
    expect((transmittedFile as File).lastModified).toBe(0);
    expect(await readBlob(transmittedFile as File)).toBe(
      "SANITIZED_CANVAS_PIXELS",
    );
    expect(await readBlob(transmittedFile as File)).not.toContain(
      "ORIGINAL_SECRET_REGISTRATION_ABC-123",
    );
    expect(JSON.parse(String(submission.body.get("image_manifest")))).toEqual(
      submission.manifest,
    );
    expect(JSON.stringify(submission.manifest)).not.toContain(
      "customer-original.jpg",
    );
  });

  it("intercepts the exact POST body and never posts the original File", async () => {
    const original = new File(["ORIGINAL_BYTES_AND_EXIF"], "private.jpg", {
      type: "image/jpeg",
    });
    const sanitized = new Blob(["FLATTENED_BLACK_PIXELS"], {
      type: "image/png",
    });
    let interceptedBody: FormData | null = null;
    const interceptedFetch = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        interceptedBody = init?.body as FormData;
        return new Response(null, { status: 202 });
      },
    ) as unknown as typeof fetch;

    const response = await postSanitizedImages(
      interceptedFetch,
      "/api/extract",
      [
        {
          clientId: "synthetic-id",
          blob: sanitized,
          width: 64,
          height: 48,
        },
      ],
    );

    expect(response.status).toBe(202);
    expect(interceptedFetch).toHaveBeenCalledWith(
      "/api/extract",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        credentials: "same-origin",
      }),
    );

    const transmittedFile = (interceptedBody as FormData | null)?.get(
      "images",
    );
    expect(transmittedFile).toBeInstanceOf(File);
    expect(transmittedFile).not.toBe(original);
    expect(await readBlob(transmittedFile as File)).toBe(
      "FLATTENED_BLACK_PIXELS",
    );
    expect(await readBlob(transmittedFile as File)).not.toContain(
      "ORIGINAL_BYTES_AND_EXIF",
    );
  });

  it("refuses to build an empty request", () => {
    expect(() => buildSanitizedSubmission([])).toThrow(
      "At least one sanitized image is required.",
    );
  });
});

function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsText(blob);
  });
}
