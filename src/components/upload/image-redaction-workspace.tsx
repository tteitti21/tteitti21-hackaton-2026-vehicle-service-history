"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { useAnalysisSession } from "@/components/session/analysis-session-provider";
import {
  commitEditorSnapshot,
  createEditorHistory,
  getRotatedDimensions,
  normalizeRectangle,
  redoEditorChange,
  undoEditorChange,
  type EditorHistory,
  type EditorSnapshot,
  type Point,
  type QuarterTurn,
  type Rectangle,
} from "@/domain/images/editor-history";
import {
  hasSafeImageDimensions,
  validateImageSelection,
} from "@/domain/images/image-validation";
import { serviceHistorySchema } from "@/domain/schemas/service-history";
import {
  createSanitizedImageBlob,
  renderEditorImage,
} from "@/lib/images/canvas-renderer";
import { postSanitizedImages } from "@/lib/images/sanitized-submission";
import { readExtractionTimeoutResponseHeader } from "@/lib/http/extraction-timeout-header";
import {
  readRequestSizeResponseHeaders,
  type RequestSizeResponseDetails,
} from "@/lib/http/request-size-headers";
import { readSafeApiError } from "@/lib/http/safe-client-error";

interface ImageRedactionWorkspaceProps {
  maxFiles: number;
  maxBytesPerFile: number;
  maxRequestBytes: number;
}

interface ImageAsset {
  id: string;
  fileName: string;
  bitmap: ImageBitmap;
  sourceWidth: number;
  sourceHeight: number;
  editor: EditorHistory;
}

interface PreparedImage {
  clientId: string;
  sourceName: string;
  blob: Blob;
  previewUrl: string;
  width: number;
  height: number;
}

type EditorMode = "redact" | "crop";

const MINIMUM_SELECTION_SIZE = 4;

const extractionErrorMessages = {
  forbidden: "The extraction request was blocked. Refresh the page and try again.",
  rate_limited:
    "Too many extraction requests have been made. Wait a moment and try again.",
  provider_timeout:
    "Image processing timed out. Images remain in the browser for another attempt.",
  invalid_provider_output:
    "The response from the images was not in a safely processable format. Images remain in the browser.",
  provider_error:
    "Image processing failed at the provider. Images remain in the browser for another attempt.",
  service_unavailable:
    "The image extraction service is currently unavailable.",
  payload_too_large: "The submission package exceeds the allowed size limit.",
  unsupported_media_type:
    "The submission package contains an unsupported file format.",
  invalid_request: "The submission package could not be processed.",
} as const;

export function ImageRedactionWorkspace({
  maxFiles,
  maxBytesPerFile,
  maxRequestBytes,
}: Readonly<ImageRedactionWorkspaceProps>) {
  const {
    state,
    beginExtraction,
    completeExtraction,
    failExtraction,
    clearExtraction,
  } = useAnalysisSession();
  const [images, setImages] = useState<ImageAsset[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [mode, setMode] = useState<EditorMode>("redact");
  const [draftRectangle, setDraftRectangle] = useState<Rectangle | null>(null);
  const [uploadMessages, setUploadMessages] = useState<string[]>([]);
  const [preparedImages, setPreparedImages] = useState<PreparedImage[]>([]);
  const [isPreparing, setIsPreparing] = useState(false);
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false);
  const [imagesApproved, setImagesApproved] = useState(false);
  const [requestSizeResponse, setRequestSizeResponse] =
    useState<RequestSizeResponseDetails | null>(null);
  const [extractionTimeoutMs, setExtractionTimeoutMs] = useState<number | null>(
    null,
  );
  const [workspaceMessage, setWorkspaceMessage] = useState(
    "Add images and redact unnecessary identifiers.",
  );
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragStartRef = useRef<Point | null>(null);
  const imagesRef = useRef(images);
  const preparedImagesRef = useRef(preparedImages);
  const editVersionRef = useRef(0);
  const previousResetVersionRef = useRef(state.resetVersion);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    preparedImagesRef.current = preparedImages;
  }, [preparedImages]);

  const revokePreparedImages = useCallback(() => {
    for (const preparedImage of preparedImagesRef.current) {
      URL.revokeObjectURL(preparedImage.previewUrl);
    }

    preparedImagesRef.current = [];
    setPreparedImages([]);
    setPrivacyConfirmed(false);
    setImagesApproved(false);
    setRequestSizeResponse(null);
    setExtractionTimeoutMs(null);
  }, []);

  const invalidatePreparedImages = useCallback(() => {
    editVersionRef.current += 1;
    revokePreparedImages();
    clearExtraction();
  }, [clearExtraction, revokePreparedImages]);

  const clearWorkspace = useCallback(
    (message = "All images were removed from this tab's memory.") => {
      invalidatePreparedImages();

      for (const image of imagesRef.current) {
        image.bitmap.close();
      }

      imagesRef.current = [];
      setImages([]);
      setSelectedImageId(null);
      setUploadMessages([]);
      setDraftRectangle(null);
      setWorkspaceMessage(message);
    },
    [invalidatePreparedImages],
  );

  useEffect(() => {
    if (previousResetVersionRef.current === state.resetVersion) {
      return;
    }

    previousResetVersionRef.current = state.resetVersion;
    clearWorkspace("Resetting the session also removed all images from memory.");
  }, [clearWorkspace, state.resetVersion]);

  useEffect(
    () => () => {
      for (const image of imagesRef.current) {
        image.bitmap.close();
      }

      for (const preparedImage of preparedImagesRef.current) {
        URL.revokeObjectURL(preparedImage.previewUrl);
      }
    },
    [],
  );

  const selectedImage =
    images.find((image) => image.id === selectedImageId) ?? null;
  const sanitizedImageBytes = preparedImages.reduce(
    (total, image) => total + image.blob.size,
    0,
  );
  const hasOversizedPreparedImages = preparedImages.some(
    (image) => image.blob.size > maxBytesPerFile,
  );

  useEffect(() => {
    const canvas = canvasRef.current;

    if (canvas === null || selectedImage === null) {
      return;
    }

    renderEditorImage(
      canvas,
      selectedImage.bitmap,
      selectedImage.sourceWidth,
      selectedImage.sourceHeight,
      selectedImage.editor.present,
    );

    if (draftRectangle !== null) {
      const context = canvas.getContext("2d");

      if (context !== null) {
        context.save();
        context.fillStyle =
          mode === "redact" ? "rgba(0, 0, 0, 0.72)" : "rgba(201, 239, 121, 0.2)";
        context.strokeStyle = mode === "redact" ? "#ffffff" : "#183e32";
        context.lineWidth = Math.max(2, canvas.width / 400);
        context.setLineDash(mode === "crop" ? [10, 6] : []);
        context.fillRect(
          draftRectangle.x,
          draftRectangle.y,
          draftRectangle.width,
          draftRectangle.height,
        );
        context.strokeRect(
          draftRectangle.x,
          draftRectangle.y,
          draftRectangle.width,
          draftRectangle.height,
        );
        context.restore();
      }
    }
  }, [draftRectangle, mode, selectedImage]);

  const handleFileSelection = async (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";

    const validation = validateImageSelection(
      selectedFiles,
      imagesRef.current.length,
      { maxFiles, maxBytesPerFile },
    );
    const messages = validation.issues.map((issue) => issue.message);
    const decodedImages: ImageAsset[] = [];

    for (const file of validation.accepted) {
      try {
        const bitmap = await createImageBitmap(file);

        if (!hasSafeImageDimensions(bitmap.width, bitmap.height)) {
          bitmap.close();
          messages.push(
            `${file.name}: the image pixel count is too large for safe browser processing.`,
          );
          continue;
        }

        decodedImages.push({
          id: crypto.randomUUID(),
          fileName: file.name,
          bitmap,
          sourceWidth: bitmap.width,
          sourceHeight: bitmap.height,
          editor: createEditorHistory(),
        });
      } catch {
        messages.push(
          `${file.name}: the image could not be opened. The file may be corrupted.`,
        );
      }
    }

    setUploadMessages(messages);

    if (decodedImages.length === 0) {
      return;
    }

    invalidatePreparedImages();
    const nextImages = [...imagesRef.current, ...decodedImages];
    imagesRef.current = nextImages;
    setImages(nextImages);
    setSelectedImageId((current) => current ?? decodedImages[0].id);
    setWorkspaceMessage(
      `${decodedImages.length} ${decodedImages.length === 1 ? "image was added" : "images were added"} only to browser memory.`,
    );
  };

  const updateSelectedEditor = useCallback(
    (update: (history: EditorHistory) => EditorHistory, message: string) => {
      if (selectedImageId === null) {
        return;
      }

      invalidatePreparedImages();
      setImages((current) => {
        const next = current.map((image) =>
          image.id === selectedImageId
            ? { ...image, editor: update(image.editor) }
            : image,
        );
        imagesRef.current = next;
        return next;
      });
      setWorkspaceMessage(message);
    },
    [invalidatePreparedImages, selectedImageId],
  );

  const rotateSelectedImage = (direction: -1 | 1) => {
    updateSelectedEditor((history) => {
      const nextRotation = normalizeRotation(
        history.present.rotation + direction * 90,
      );

      return commitEditorSnapshot(history, {
        rotation: nextRotation,
        crop: null,
        redactions: [],
      });
    }, "The image was rotated. The previous crop and redactions were reset; the action can be undone.");
  };

  const removeSelectedImage = () => {
    if (selectedImage === null) {
      return;
    }

    invalidatePreparedImages();
    selectedImage.bitmap.close();

    const remaining = imagesRef.current.filter(
      (image) => image.id !== selectedImage.id,
    );
    imagesRef.current = remaining;
    setImages(remaining);
    setSelectedImageId(remaining[0]?.id ?? null);
    setDraftRectangle(null);
    setWorkspaceMessage("The selected image was removed from browser memory.");
  };

  const startRectangle = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (selectedImage === null) {
      return;
    }

    const point = getCanvasPoint(event);
    dragStartRef.current = point;
    setDraftRectangle({ x: point.x, y: point.y, width: 0, height: 0 });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const updateRectangle = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const start = dragStartRef.current;

    if (start === null) {
      return;
    }

    setDraftRectangle(
      normalizeRectangle(start, getCanvasPoint(event), {
        width: event.currentTarget.width,
        height: event.currentTarget.height,
      }),
    );
  };

  const finishRectangle = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const start = dragStartRef.current;
    const canvasWidth = event.currentTarget.width;
    const canvasHeight = event.currentTarget.height;
    dragStartRef.current = null;

    if (start === null || selectedImage === null) {
      setDraftRectangle(null);
      return;
    }

    const rectangle = normalizeRectangle(start, getCanvasPoint(event), {
      width: canvasWidth,
      height: canvasHeight,
    });
    setDraftRectangle(null);

    if (
      rectangle.width < MINIMUM_SELECTION_SIZE ||
      rectangle.height < MINIMUM_SELECTION_SIZE
    ) {
      setWorkspaceMessage("The selection was too small. Drag a larger rectangle.");
      return;
    }

    if (mode === "redact") {
      updateSelectedEditor(
        (history) =>
          commitEditorSnapshot(history, {
            ...history.present,
            redactions: [...history.present.redactions, rectangle],
          }),
        "A black redaction was added. Create a new submission preview for review.",
      );
      return;
    }

    updateSelectedEditor(
      (history) => {
        const current = history.present;
        const rotated = getRotatedDimensions(
          selectedImage.sourceWidth,
          selectedImage.sourceHeight,
          current.rotation,
        );
        const currentCrop = current.crop ?? {
          x: 0,
          y: 0,
          width: rotated.width,
          height: rotated.height,
        };
        const scaleX = currentCrop.width / canvasWidth;
        const scaleY = currentCrop.height / canvasHeight;

        return commitEditorSnapshot(history, {
          rotation: current.rotation,
          crop: {
            x: currentCrop.x + rectangle.x * scaleX,
            y: currentCrop.y + rectangle.y * scaleY,
            width: rectangle.width * scaleX,
            height: rectangle.height * scaleY,
          },
          redactions: [],
        });
      },
      "The image was cropped. Previous redactions were reset; the action can be undone.",
    );
  };

  const prepareSanitizedPreviews = async () => {
    if (imagesRef.current.length === 0) {
      return;
    }

    invalidatePreparedImages();
    const preparationVersion = editVersionRef.current;
    setIsPreparing(true);
    setWorkspaceMessage("Creating new metadata-free PNG images for review…");

    try {
      const nextPreparedImages = await Promise.all(
        imagesRef.current.map(async (image) => {
          const blob = await createSanitizedImageBlob(
            image.bitmap,
            image.sourceWidth,
            image.sourceHeight,
            image.editor.present,
          );
          const outputDimensions = getOutputDimensions(image);

          return {
            clientId: image.id,
            sourceName: image.fileName,
            blob,
            previewUrl: URL.createObjectURL(blob),
            ...outputDimensions,
          };
        }),
      );

      if (preparationVersion !== editVersionRef.current) {
        for (const preparedImage of nextPreparedImages) {
          URL.revokeObjectURL(preparedImage.previewUrl);
        }
        return;
      }

      preparedImagesRef.current = nextPreparedImages;
      setPreparedImages(nextPreparedImages);
      const oversizedCount = nextPreparedImages.filter(
        (image) => image.blob.size > maxBytesPerFile,
      ).length;
      setWorkspaceMessage(
        oversizedCount > 0
          ? `${oversizedCount} sanitized PNG ${oversizedCount === 1 ? "image exceeds" : "images exceed"} the per-image size limit. Crop the image smaller before submission.`
          : "Review below exactly which images can be submitted for analysis.",
      );
    } catch {
      setWorkspaceMessage(
        "The submission preview could not be created. Try another image or browser.",
      );
    } finally {
      setIsPreparing(false);
    }
  };

  const approvePreparedImages = () => {
    if (
      !privacyConfirmed ||
      preparedImages.length === 0 ||
      hasOversizedPreparedImages
    ) {
      return;
    }

    setImagesApproved(true);
    setWorkspaceMessage(
      "The sanitized images have been approved for this session. Nothing has been submitted yet.",
    );
  };

  const submitSanitizedImages = async () => {
    if (
      !imagesApproved ||
      !privacyConfirmed ||
      preparedImagesRef.current.length === 0 ||
      preparedImagesRef.current.some(
        (image) => image.blob.size > maxBytesPerFile,
      ) ||
      state.extractionStatus === "submitting"
    ) {
      return;
    }

    beginExtraction();
    setRequestSizeResponse(null);
    setExtractionTimeoutMs(null);
    setWorkspaceMessage(
      "The approved sanitized PNG images are being submitted to OpenAI for extraction.",
    );

    try {
      const response = await postSanitizedImages(
        fetch,
        "/api/extract",
        preparedImagesRef.current.map((image) => ({
          clientId: image.clientId,
          blob: image.blob,
          width: image.width,
          height: image.height,
        })),
      );
      setRequestSizeResponse(readRequestSizeResponseHeaders(response.headers));
      setExtractionTimeoutMs(
        readExtractionTimeoutResponseHeader(response.headers),
      );
      const payload: unknown = await response.json();

      if (!response.ok) {
        failExtraction(
          readSafeApiError(
            payload,
            extractionErrorMessages,
            "Image extraction failed. Images remain in the browser for another attempt.",
          ),
        );
        setWorkspaceMessage(
          "Extraction failed. Local images and submission versions remain in the browser.",
        );
        return;
      }

      const parsed = serviceHistorySchema.safeParse(payload);

      if (!parsed.success) {
        failExtraction(
          "The server response was not in a safely processable format.",
        );
        setWorkspaceMessage(
          "The extraction response was rejected. Images remain in the browser for another attempt.",
        );
        return;
      }

      completeExtraction(parsed.data);
      setWorkspaceMessage(
        "Service events were extracted. Review and correct the result below.",
      );
    } catch {
      failExtraction(
        "The extraction service could not be reached. Check the connection and try again.",
      );
      setWorkspaceMessage(
        "The network error did not remove local images or submission versions.",
      );
    }
  };

  return (
    <section className="imageSection" aria-labelledby="image-workspace-heading">
      <div className="imageSectionIntro">
        <div>
          <p className="sectionLabel">Phases 2–3 / Images and extraction</p>
          <h2 id="image-workspace-heading">
            Redact identifiers before an image can leave the browser.
          </h2>
        </div>
        <div className="privacyChecklist">
          <strong>Before later submission</strong>
          <ul>
            <li>Only the sanitized preview shown below can be submitted.</li>
            <li>The provider receiving the sanitized image is OpenAI.</li>
            <li>A registration number or VIN is not needed for analysis.</li>
            <li>Also redact names, addresses, and customer numbers.</li>
          </ul>
        </div>
      </div>

      <div className="uploadPanel">
        <div>
          <h3>1. Add 1–{maxFiles} images</h3>
          <p>
            JPG, PNG, or WebP, up to{" "}
            {formatMegabytes(maxBytesPerFile)} MiB per image. Files are opened
            only in browser memory.
          </p>
        </div>
        <label className="fileButton" htmlFor="service-images">
          Select images
        </label>
        <input
          id="service-images"
          className="visuallyHidden"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleFileSelection}
        />
      </div>

      {uploadMessages.length > 0 ? (
        <div className="uploadErrors" role="alert">
          <strong>Not all files could be added:</strong>
          <ul>
            {uploadMessages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="workspaceStatus" role="status" aria-live="polite">
        {workspaceMessage}
      </p>

      {images.length > 0 ? (
        <div className="imageWorkspace">
          <aside className="imageQueue" aria-labelledby="image-queue-heading">
            <div className="queueHeading">
              <div>
                <p className="sectionLabel">Images</p>
                <h3 id="image-queue-heading">
                  {images.length}/{maxFiles} in memory
                </h3>
              </div>
              <button
                className="textButton"
                type="button"
                onClick={() => clearWorkspace()}
              >
                Remove all
              </button>
            </div>
            <ol>
              {images.map((image, index) => (
                <li key={image.id}>
                  <button
                    type="button"
                    className={
                      image.id === selectedImageId ? "selectedImage" : undefined
                    }
                    onClick={() => {
                      setSelectedImageId(image.id);
                      setDraftRectangle(null);
                    }}
                  >
                    <span aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span>
                      <strong>{image.fileName}</strong>
                      <small>
                        {image.sourceWidth} × {image.sourceHeight} px
                      </small>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </aside>

          <div className="editorPanel">
            <div className="editorHeading">
              <div>
                <p className="sectionLabel">2. Edit the selected image</p>
                <h3>{selectedImage?.fileName}</h3>
              </div>
              <button
                className="dangerButton"
                type="button"
                onClick={removeSelectedImage}
              >
                Remove image
              </button>
            </div>

            <div className="editorToolbar" aria-label="Image editing tools">
              <div className="toolGroup">
                <button
                  type="button"
                  className={mode === "redact" ? "activeTool" : undefined}
                  aria-pressed={mode === "redact"}
                  onClick={() => setMode("redact")}
                >
                  Redact area
                </button>
                <button
                  type="button"
                  className={mode === "crop" ? "activeTool" : undefined}
                  aria-pressed={mode === "crop"}
                  onClick={() => setMode("crop")}
                >
                  Crop
                </button>
              </div>
              <div className="toolGroup">
                <button type="button" onClick={() => rotateSelectedImage(-1)}>
                  Rotate left
                </button>
                <button type="button" onClick={() => rotateSelectedImage(1)}>
                  Rotate right
                </button>
              </div>
              <div className="toolGroup">
                <button
                  type="button"
                  disabled={(selectedImage?.editor.past.length ?? 0) === 0}
                  onClick={() =>
                    updateSelectedEditor(
                      undoEditorChange,
                      "The previous image edit was undone.",
                    )
                  }
                >
                  Undo
                </button>
                <button
                  type="button"
                  disabled={(selectedImage?.editor.future.length ?? 0) === 0}
                  onClick={() =>
                    updateSelectedEditor(
                      redoEditorChange,
                      "The undone image edit was redone.",
                    )
                  }
                >
                  Redo
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateSelectedEditor(
                      (history) =>
                        commitEditorSnapshot(
                          history,
                          createEditorHistory().present,
                        ),
                      "Edits to the selected image were reset.",
                    )
                  }
                >
                  Reset image
                </button>
              </div>
            </div>

            <p className="toolHint">
              {mode === "redact"
                ? "Drag a rectangle over the image. The area will be blacked out in the final PNG image."
                : "Drag a rectangle around the area to keep. Cropping resets previous redactions."}
            </p>

            <div className="canvasFrame">
              <canvas
                ref={canvasRef}
                className="editorCanvas"
                role="img"
                aria-label="Editable image. Use the selected tool by dragging the pointer over the image."
                onPointerDown={startRectangle}
                onPointerMove={updateRectangle}
                onPointerUp={finishRectangle}
                onPointerCancel={() => {
                  dragStartRef.current = null;
                  setDraftRectangle(null);
                }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="emptyImageWorkspace">
          <span aria-hidden="true">02</span>
          <h3>Images do not leave the device at this stage.</h3>
          <p>
            Selecting files does not start automatic submission. The original
            file is not used to build the later submission package.
          </p>
        </div>
      )}

      <div className="sanitizedPanel" aria-labelledby="sanitized-heading">
        <div className="sanitizedHeading">
          <div>
            <p className="sectionLabel">3. Review the submission version</p>
            <h3 id="sanitized-heading">Exact sanitized preview</h3>
            <p>
              The browser draws every image into a new PNG file. Redactions are
              permanent pixels, and EXIF metadata from the original file is
              not transferred to the new image.
            </p>
          </div>
          <button
            className="primaryButton"
            type="button"
            disabled={images.length === 0 || isPreparing}
            onClick={prepareSanitizedPreviews}
          >
            {isPreparing ? "Creating preview…" : "Create submission preview"}
          </button>
        </div>

        {preparedImages.length > 0 ? (
          <>
            <ol className="sanitizedPreviewGrid">
              {preparedImages.map((preparedImage) => (
                <li key={preparedImage.clientId}>
                  <Image
                    src={preparedImage.previewUrl}
                    alt={`Submission preview: ${preparedImage.sourceName}`}
                    width={preparedImage.width}
                    height={preparedImage.height}
                    unoptimized
                  />
                  <div>
                    <strong>{preparedImage.sourceName}</strong>
                    <span>
                      New PNG · {preparedImage.width} × {preparedImage.height}{" "}
                      px · {formatBytes(preparedImage.blob.size)}
                    </span>
                    {preparedImage.blob.size > maxBytesPerFile ? (
                      <span className="sizeLimitWarning">
                        Exceeds the per-image limit{" "}
                        {formatBytes(maxBytesPerFile)}.
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>

            <RequestSizeDebug
              sanitizedImageBytes={sanitizedImageBytes}
              requestBodyBytes={requestSizeResponse?.requestBodyBytes ?? null}
              maximumRequestBytes={
                requestSizeResponse?.maximumRequestBytes ?? maxRequestBytes
              }
              extractionTimeoutMs={extractionTimeoutMs}
            />

            <div className="consentPanel">
              <label>
                <input
                  type="checkbox"
                  disabled={hasOversizedPreparedImages}
                  checked={privacyConfirmed}
                  onChange={(event) => {
                    setPrivacyConfirmed(event.target.checked);
                    setImagesApproved(false);
                  }}
                />
                <span>
                  I have reviewed the submission versions shown above. The
                  registration number, VIN, names, addresses, and other
                  unnecessary identifiers have been redacted.
                </span>
              </label>
              <button
                className="primaryButton"
                type="button"
                disabled={!privacyConfirmed || hasOversizedPreparedImages}
                onClick={approvePreparedImages}
              >
                Approve sanitized images
              </button>
              <p>
                {hasOversizedPreparedImages
                  ? "Crop the oversized submission version smaller and recreate the preview."
                  : imagesApproved
                    ? "Approved for this session. Images are not submitted before the separate extraction button is pressed."
                    : "Approval is required before the first analysis request."}
              </p>
              {imagesApproved ? (
                <div className="extractionSubmit">
                  <button
                    className="primaryButton"
                    type="button"
                    disabled={state.extractionStatus === "submitting"}
                    onClick={submitSanitizedImages}
                  >
                    {state.extractionStatus === "submitting"
                      ? "Extracting events…"
                      : "Submit to OpenAI and extract events"}
                  </button>
                  <p>
                    Only the new PNG images shown above are submitted. Original
                    files are not included in the submission package.
                  </p>
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <div className="emptySanitizedPreview">
            No submission versions have been created yet.
          </div>
        )}
      </div>
    </section>
  );
}

function getCanvasPoint(
  event: ReactPointerEvent<HTMLCanvasElement>,
): Point {
  const bounds = event.currentTarget.getBoundingClientRect();

  return {
    x:
      ((event.clientX - bounds.left) / bounds.width) *
      event.currentTarget.width,
    y:
      ((event.clientY - bounds.top) / bounds.height) *
      event.currentTarget.height,
  };
}

function normalizeRotation(value: number): QuarterTurn {
  const normalized = ((value % 360) + 360) % 360;

  if (
    normalized === 0 ||
    normalized === 90 ||
    normalized === 180 ||
    normalized === 270
  ) {
    return normalized;
  }

  throw new Error("Rotation must be a multiple of 90 degrees.");
}

function getOutputDimensions(image: ImageAsset) {
  const snapshot: EditorSnapshot = image.editor.present;

  if (snapshot.crop !== null) {
    return {
      width: Math.max(1, Math.round(snapshot.crop.width)),
      height: Math.max(1, Math.round(snapshot.crop.height)),
    };
  }

  return getRotatedDimensions(
    image.sourceWidth,
    image.sourceHeight,
    snapshot.rotation,
  );
}

function formatMegabytes(bytes: number): string {
  return new Intl.NumberFormat("fi-FI", {
    maximumFractionDigits: 1,
  }).format(bytes / 1_048_576);
}

function formatBytes(bytes: number): string {
  const formatter = new Intl.NumberFormat("fi-FI", {
    maximumFractionDigits: 1,
  });
  const readable =
    bytes >= 1_048_576
      ? `${formatter.format(bytes / 1_048_576)} MiB`
      : `${formatter.format(bytes / 1_024)} KiB`;

  return `${readable} (${new Intl.NumberFormat("fi-FI").format(bytes)} bytes)`;
}

function RequestSizeDebug({
  sanitizedImageBytes,
  requestBodyBytes,
  maximumRequestBytes,
  extractionTimeoutMs,
}: Readonly<{
  sanitizedImageBytes: number;
  requestBodyBytes: number | null;
  maximumRequestBytes: number;
  extractionTimeoutMs: number | null;
}>) {
  return (
    <aside className="requestSizeDebug" aria-label="Submission size details">
      <div>
        <strong>Diagnostics: submission size</strong>
        <span>Content and image data are not written to logs.</span>
      </div>
      <dl>
        <div>
          <dt>Sanitized PNG images</dt>
          <dd>{formatBytes(sanitizedImageBytes)}</dd>
        </div>
        <div>
          <dt>HTTP request body</dt>
          <dd>
            {requestBodyBytes === null
              ? "The exact size appears after the server response."
              : formatBytes(requestBodyBytes)}
          </dd>
        </div>
        <div>
          <dt>Application request limit</dt>
          <dd>{formatBytes(maximumRequestBytes)}</dd>
        </div>
        <div>
          <dt>Processing timeout</dt>
          <dd>
            {extractionTimeoutMs === null
              ? "The server confirms it after submission."
              : `${new Intl.NumberFormat("fi-FI", {
                  maximumFractionDigits: 1,
                }).format(extractionTimeoutMs / 1_000)} seconds`}
          </dd>
        </div>
      </dl>
      <p>
        In addition to the PNG images, the request body contains multipart
        headers and a small image manifest.
      </p>
    </aside>
  );
}
