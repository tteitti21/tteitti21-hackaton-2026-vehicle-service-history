import {
  getRotatedDimensions,
  type EditorSnapshot,
} from "@/domain/images/editor-history";

export const SANITIZED_IMAGE_TYPE = "image/png";

export function renderEditorImage(
  target: HTMLCanvasElement,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  snapshot: EditorSnapshot,
): void {
  const rotatedDimensions = getRotatedDimensions(
    sourceWidth,
    sourceHeight,
    snapshot.rotation,
  );
  const rotatedCanvas = document.createElement("canvas");
  rotatedCanvas.width = rotatedDimensions.width;
  rotatedCanvas.height = rotatedDimensions.height;

  const rotatedContext = requireCanvasContext(rotatedCanvas);
  rotatedContext.fillStyle = "#ffffff";
  rotatedContext.fillRect(
    0,
    0,
    rotatedDimensions.width,
    rotatedDimensions.height,
  );
  rotatedContext.save();

  switch (snapshot.rotation) {
    case 0:
      break;
    case 90:
      rotatedContext.translate(sourceHeight, 0);
      rotatedContext.rotate(Math.PI / 2);
      break;
    case 180:
      rotatedContext.translate(sourceWidth, sourceHeight);
      rotatedContext.rotate(Math.PI);
      break;
    case 270:
      rotatedContext.translate(0, sourceWidth);
      rotatedContext.rotate(-Math.PI / 2);
      break;
  }

  rotatedContext.drawImage(source, 0, 0, sourceWidth, sourceHeight);
  rotatedContext.restore();

  const crop = snapshot.crop ?? {
    x: 0,
    y: 0,
    width: rotatedDimensions.width,
    height: rotatedDimensions.height,
  };

  target.width = Math.max(1, Math.round(crop.width));
  target.height = Math.max(1, Math.round(crop.height));

  const targetContext = requireCanvasContext(target);
  targetContext.clearRect(0, 0, target.width, target.height);
  targetContext.drawImage(
    rotatedCanvas,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    target.width,
    target.height,
  );

  targetContext.fillStyle = "#000000";
  for (const redaction of snapshot.redactions) {
    targetContext.fillRect(
      redaction.x,
      redaction.y,
      redaction.width,
      redaction.height,
    );
  }
}

export async function createSanitizedImageBlob(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  snapshot: EditorSnapshot,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  renderEditorImage(canvas, source, sourceWidth, sourceHeight, snapshot);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, SANITIZED_IMAGE_TYPE);
  });

  if (blob === null) {
    throw new Error("The browser could not create a sanitized image.");
  }

  return blob;
}

function requireCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d", { alpha: false });

  if (context === null) {
    throw new Error("This browser does not support the required canvas API.");
  }

  return context;
}
