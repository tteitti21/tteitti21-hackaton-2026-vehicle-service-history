import { Buffer } from "node:buffer";

export function createExtractionRequest(
  images: Array<{
    id: string;
    width: number;
    height: number;
    byteLength?: number;
  }>,
  options: { manifestWidth?: number; origin?: string } = {},
): Request {
  const boundary = "----autohuolto-synthetic-boundary";
  const parts: Buffer[] = [];
  const manifest = images.map((image, index) => {
    const fileName = `sanitized-${index + 1}-${image.id}.png`;
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="images"; filename="${fileName}"\r\nContent-Type: image/png\r\n\r\n`,
        "utf8",
      ),
      createPngBytes(
        image.width,
        image.height,
        image.byteLength,
      ),
      Buffer.from("\r\n", "utf8"),
    );

    return {
      clientId: image.id,
      fileName,
      mediaType: "image/png",
      width: options.manifestWidth ?? image.width,
      height: image.height,
    };
  });
  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="image_manifest"\r\n\r\n${JSON.stringify(manifest)}\r\n--${boundary}--\r\n`,
      "utf8",
    ),
  );
  const body = Buffer.concat(parts);
  const headers = new Headers({
    "Content-Type": `multipart/form-data; boundary=${boundary}`,
    "Content-Length": String(body.byteLength),
  });

  if (options.origin) {
    headers.set("Origin", options.origin);
  }

  return new Request("http://localhost/api/extract", {
    method: "POST",
    headers,
    body: body as unknown as BodyInit,
  });
}

function createPngHeader(width: number, height: number): ArrayBuffer {
  const buffer = new ArrayBuffer(24);
  const bytes = new Uint8Array(buffer);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return buffer;
}

function createPngBytes(
  width: number,
  height: number,
  byteLength = 24,
): Buffer {
  if (byteLength < 24) {
    throw new Error("Synthetic PNG byte length must be at least 24.");
  }

  const bytes = Buffer.alloc(byteLength);
  bytes.set(new Uint8Array(createPngHeader(width, height)));
  return bytes;
}
