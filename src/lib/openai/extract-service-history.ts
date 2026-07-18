import { z } from "zod";

import {
  serviceHistorySchema,
  type ServiceHistory,
} from "@/domain/schemas/service-history";

export interface ExtractionInputImage {
  imageId: string;
  bytes: Uint8Array;
  mediaType: "image/png";
  width: number;
  height: number;
}

export interface ExtractionAttemptInput {
  images: ReadonlyArray<ExtractionInputImage>;
  retry: boolean;
  signal: AbortSignal;
}

export interface ExtractionAttemptProvider {
  extract(input: ExtractionAttemptInput): Promise<unknown>;
}

export class ExtractionOutputValidationError extends Error {
  constructor() {
    super("The extraction provider returned invalid structured output.");
    this.name = "ExtractionOutputValidationError";
  }
}

export async function extractServiceHistoryWithRetry(
  provider: ExtractionAttemptProvider,
  images: ReadonlyArray<ExtractionInputImage>,
  signal: AbortSignal,
): Promise<ServiceHistory> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const output = await provider.extract({
        images,
        retry: attempt === 1,
        signal,
      });
      const parsed = serviceHistorySchema.safeParse(output);

      if (!parsed.success || !hasValidImageReferences(parsed.data, images)) {
        throw new ExtractionOutputValidationError();
      }

      return parsed.data;
    } catch (error) {
      const validationFailure =
        error instanceof ExtractionOutputValidationError ||
        error instanceof z.ZodError ||
        error instanceof SyntaxError;

      if (!validationFailure || attempt === 1 || signal.aborted) {
        throw error;
      }
    }
  }

  throw new ExtractionOutputValidationError();
}

function hasValidImageReferences(
  history: ServiceHistory,
  inputImages: ReadonlyArray<ExtractionInputImage>,
): boolean {
  const expectedImageIds = new Set(inputImages.map((image) => image.imageId));
  const returnedImageIds = new Set(
    history.images.map((image) => image.image_id),
  );
  const eventIds = new Set<string>();

  if (
    returnedImageIds.size !== history.images.length ||
    returnedImageIds.size !== expectedImageIds.size
  ) {
    return false;
  }

  for (const imageId of expectedImageIds) {
    if (!returnedImageIds.has(imageId)) {
      return false;
    }
  }

  for (const event of history.events) {
    if (eventIds.has(event.event_id)) {
      return false;
    }
    eventIds.add(event.event_id);

    if (
      event.source_image_ids.some((imageId) => !expectedImageIds.has(imageId))
    ) {
      return false;
    }
  }

  return true;
}
