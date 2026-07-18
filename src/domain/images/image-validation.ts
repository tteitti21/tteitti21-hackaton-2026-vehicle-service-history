export const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MAX_IMAGE_PIXELS = 40_000_000;

export interface ClientUploadLimits {
  maxFiles: number;
  maxBytesPerFile: number;
}

export interface ImageValidationIssue {
  code:
    | "empty_file"
    | "too_many_files"
    | "unsupported_type"
    | "file_too_large";
  fileName?: string;
  message: string;
}

export interface ImageSelectionValidation {
  accepted: File[];
  issues: ImageValidationIssue[];
}

export function validateImageSelection(
  files: Iterable<File>,
  existingFileCount: number,
  limits: ClientUploadLimits,
): ImageSelectionValidation {
  const accepted: File[] = [];
  const issues: ImageValidationIssue[] = [];
  const availableSlots = Math.max(0, limits.maxFiles - existingFileCount);

  for (const file of files) {
    if (accepted.length >= availableSlots) {
      issues.push({
        code: "too_many_files",
        fileName: file.name,
        message: `Kuvia voi olla enintään ${limits.maxFiles}. Tiedostoa ${file.name} ei lisätty.`,
      });
      continue;
    }

    if (!SUPPORTED_IMAGE_TYPES.includes(file.type as never)) {
      issues.push({
        code: "unsupported_type",
        fileName: file.name,
        message: `${file.name}: tuettuja tiedostomuotoja ovat JPG, PNG ja WebP.`,
      });
      continue;
    }

    if (file.size === 0) {
      issues.push({
        code: "empty_file",
        fileName: file.name,
        message: `${file.name}: tyhjää tiedostoa ei voi käyttää.`,
      });
      continue;
    }

    if (file.size > limits.maxBytesPerFile) {
      issues.push({
        code: "file_too_large",
        fileName: file.name,
        message: `${file.name}: tiedosto ylittää kokorajan ${formatMegabytes(limits.maxBytesPerFile)} Mt.`,
      });
      continue;
    }

    accepted.push(file);
  }

  return { accepted, issues };
}

export function hasSafeImageDimensions(
  width: number,
  height: number,
  maximumPixels = MAX_IMAGE_PIXELS,
): boolean {
  return (
    Number.isSafeInteger(width) &&
    Number.isSafeInteger(height) &&
    width > 0 &&
    height > 0 &&
    width <= maximumPixels &&
    height <= maximumPixels &&
    width * height <= maximumPixels
  );
}

function formatMegabytes(bytes: number): string {
  return new Intl.NumberFormat("fi-FI", {
    maximumFractionDigits: 1,
  }).format(bytes / 1_048_576);
}
