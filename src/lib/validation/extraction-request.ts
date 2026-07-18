import { z } from "zod";

import { MAX_IMAGE_PIXELS } from "@/domain/images/image-validation";
import type { ExtractionInputImage } from "@/lib/openai/extract-service-history";
import {
  validateRequestContentLength,
  type UploadLimits,
} from "@/lib/validation/request-limits";

const PNG_SIGNATURE = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const ALLOWED_FORM_FIELDS = new Set(["images", "image_manifest"]);

const manifestItemSchema = z.strictObject({
  clientId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  fileName: z.string().regex(/^sanitized-\d+-[A-Za-z0-9_-]{1,128}\.png$/),
  mediaType: z.literal("image/png"),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

const manifestSchema = z.array(manifestItemSchema).min(1);

export class ExtractionRequestError extends Error {
  readonly code:
    | "invalid_request"
    | "payload_too_large"
    | "unsupported_media_type";
  readonly status: 400 | 413 | 415;

  constructor(
    code: ExtractionRequestError["code"],
    status: ExtractionRequestError["status"],
  ) {
    super(code);
    this.name = "ExtractionRequestError";
    this.code = code;
    this.status = status;
  }
}

export async function parseExtractionRequest(
  request: Request,
  limits: UploadLimits,
): Promise<ExtractionInputImage[]> {
  const contentType = request.headers.get("content-type");

  if (!contentType?.toLowerCase().startsWith("multipart/form-data;")) {
    throw new ExtractionRequestError("unsupported_media_type", 415);
  }

  const contentLength = validateRequestContentLength(
    request.headers,
    limits.maxRequestBytes,
  );

  if (!contentLength.ok) {
    throw new ExtractionRequestError(
      contentLength.code === "request_too_large"
        ? "payload_too_large"
        : "invalid_request",
      contentLength.code === "request_too_large" ? 413 : 400,
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    throw new ExtractionRequestError("invalid_request", 400);
  }

  for (const fieldName of formData.keys()) {
    if (!ALLOWED_FORM_FIELDS.has(fieldName)) {
      throw new ExtractionRequestError("invalid_request", 400);
    }
  }

  const files = formData.getAll("images");
  const manifestValues = formData.getAll("image_manifest");

  if (
    files.length < 1 ||
    files.length > limits.maxFiles ||
    files.some((value) => !isFormDataFile(value)) ||
    manifestValues.length !== 1 ||
    typeof manifestValues[0] !== "string"
  ) {
    throw new ExtractionRequestError("invalid_request", 400);
  }

  const measuredBytes = [...formData.values()].reduce(
    (total, value) =>
      total +
      (typeof value === "string"
        ? new TextEncoder().encode(value).byteLength
        : value.size),
    0,
  );

  if (measuredBytes > limits.maxRequestBytes) {
    throw new ExtractionRequestError("payload_too_large", 413);
  }

  const parsedManifest = manifestSchema.safeParse(
    parseJson(manifestValues[0]),
  );

  if (
    !parsedManifest.success ||
    parsedManifest.data.length !== files.length ||
    new Set(parsedManifest.data.map((item) => item.clientId)).size !==
      parsedManifest.data.length
  ) {
    throw new ExtractionRequestError("invalid_request", 400);
  }

  const images: ExtractionInputImage[] = [];

  for (const [index, value] of files.entries()) {
    const file = value as File;
    const manifest = parsedManifest.data[index];

    if (
      file.type !== "image/png" ||
      manifest.mediaType !== file.type
    ) {
      throw new ExtractionRequestError("unsupported_media_type", 415);
    }

    if (file.size === 0 || file.size > limits.maxBytesPerFile) {
      throw new ExtractionRequestError(
        file.size > limits.maxBytesPerFile
          ? "payload_too_large"
          : "invalid_request",
        file.size > limits.maxBytesPerFile ? 413 : 400,
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const dimensions = readPngDimensions(bytes);

    if (
      dimensions === null ||
      dimensions.width !== manifest.width ||
      dimensions.height !== manifest.height ||
      !hasSafeDimensions(dimensions.width, dimensions.height)
    ) {
      throw new ExtractionRequestError("invalid_request", 400);
    }

    images.push({
      imageId: manifest.clientId,
      bytes,
      mediaType: "image/png",
      width: dimensions.width,
      height: dimensions.height,
    });
  }

  return images;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function readPngDimensions(
  bytes: Uint8Array,
): { width: number; height: number } | null {
  if (
    bytes.byteLength < 24 ||
    !PNG_SIGNATURE.every((value, index) => bytes[index] === value) ||
    String.fromCharCode(...bytes.slice(12, 16)) !== "IHDR"
  ) {
    return null;
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    width: view.getUint32(16),
    height: view.getUint32(20),
  };
}

function hasSafeDimensions(width: number, height: number): boolean {
  return (
    width > 0 &&
    height > 0 &&
    width <= MAX_IMAGE_PIXELS &&
    height <= MAX_IMAGE_PIXELS &&
    width * height <= MAX_IMAGE_PIXELS
  );
}

function isFormDataFile(value: FormDataEntryValue): value is File {
  return (
    typeof value !== "string" &&
    typeof value.name === "string" &&
    typeof value.type === "string" &&
    typeof value.size === "number" &&
    typeof value.arrayBuffer === "function"
  );
}
