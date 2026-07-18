import { SANITIZED_IMAGE_TYPE } from "@/lib/images/canvas-renderer";

export interface SanitizedImageForSubmission {
  clientId: string;
  blob: Blob;
  width: number;
  height: number;
}

export interface SanitizedImageManifestItem {
  clientId: string;
  fileName: string;
  mediaType: typeof SANITIZED_IMAGE_TYPE;
  width: number;
  height: number;
}

export interface SanitizedSubmission {
  body: FormData;
  manifest: SanitizedImageManifestItem[];
}

export function buildSanitizedSubmission(
  images: ReadonlyArray<SanitizedImageForSubmission>,
): SanitizedSubmission {
  if (images.length === 0) {
    throw new Error("At least one sanitized image is required.");
  }

  const body = new FormData();
  const manifest: SanitizedImageManifestItem[] = images.map((image, index) => {
    const fileName = `sanitized-${index + 1}-${image.clientId}.png`;
    const sanitizedFile = new File([image.blob], fileName, {
      type: SANITIZED_IMAGE_TYPE,
      lastModified: 0,
    });

    body.append("images", sanitizedFile);

    return {
      clientId: image.clientId,
      fileName,
      mediaType: SANITIZED_IMAGE_TYPE,
      width: image.width,
      height: image.height,
    };
  });

  body.append("image_manifest", JSON.stringify(manifest));

  return { body, manifest };
}

export async function postSanitizedImages(
  fetchImplementation: typeof fetch,
  endpoint: string,
  images: ReadonlyArray<SanitizedImageForSubmission>,
): Promise<Response> {
  const { body } = buildSanitizedSubmission(images);

  return fetchImplementation(endpoint, {
    method: "POST",
    body,
    cache: "no-store",
    credentials: "same-origin",
  });
}
