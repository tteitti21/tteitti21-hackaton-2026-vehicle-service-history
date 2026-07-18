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

interface ImageRedactionWorkspaceProps {
  maxFiles: number;
  maxBytesPerFile: number;
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

export function ImageRedactionWorkspace({
  maxFiles,
  maxBytesPerFile,
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
  const [workspaceMessage, setWorkspaceMessage] = useState(
    "Lisää kuvat ja peitä niistä tarpeettomat tunnisteet.",
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
  }, []);

  const invalidatePreparedImages = useCallback(() => {
    editVersionRef.current += 1;
    revokePreparedImages();
    clearExtraction();
  }, [clearExtraction, revokePreparedImages]);

  const clearWorkspace = useCallback(
    (message = "Kaikki kuvat poistettiin tämän välilehden muistista.") => {
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
    clearWorkspace("Istunnon nollaus poisti myös kaikki kuvat muistista.");
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
            `${file.name}: kuvan pikselimäärä on liian suuri turvalliseen selainkäsittelyyn.`,
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
          `${file.name}: kuvaa ei voitu avata. Tiedosto voi olla vioittunut.`,
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
      `${decodedImages.length} ${decodedImages.length === 1 ? "kuva lisättiin" : "kuvaa lisättiin"} vain selaimen muistiin.`,
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
    }, "Kuva käännettiin. Aiempi rajaus ja peitteet nollattiin; toiminnon voi kumota.");
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
    setWorkspaceMessage("Valittu kuva poistettiin selaimen muistista.");
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
      setWorkspaceMessage("Valinta oli liian pieni. Vedä suurempi suorakulmio.");
      return;
    }

    if (mode === "redact") {
      updateSelectedEditor(
        (history) =>
          commitEditorSnapshot(history, {
            ...history.present,
            redactions: [...history.present.redactions, rectangle],
          }),
        "Musta peite lisättiin. Luo uusi lähetysesikatselu tarkistamista varten.",
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
      "Kuva rajattiin. Aiemmat peitteet nollattiin; toiminnon voi kumota.",
    );
  };

  const prepareSanitizedPreviews = async () => {
    if (imagesRef.current.length === 0) {
      return;
    }

    invalidatePreparedImages();
    const preparationVersion = editVersionRef.current;
    setIsPreparing(true);
    setWorkspaceMessage("Luodaan uusia, metatiedottomia PNG-kuvia tarkistusta varten…");

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
      setWorkspaceMessage(
        "Tarkista alla täsmälleen ne kuvat, jotka voidaan lähettää analyysiin myöhemmässä vaiheessa.",
      );
    } catch {
      setWorkspaceMessage(
        "Lähetysesikatselua ei voitu luoda. Kokeile toista kuvaa tai selainta.",
      );
    } finally {
      setIsPreparing(false);
    }
  };

  const approvePreparedImages = () => {
    if (!privacyConfirmed || preparedImages.length === 0) {
      return;
    }

    setImagesApproved(true);
    setWorkspaceMessage(
      "Peitetyt kuvat on hyväksytty tähän istuntoon. Mitään ei ole vielä lähetetty.",
    );
  };

  const submitSanitizedImages = async () => {
    if (
      !imagesApproved ||
      !privacyConfirmed ||
      preparedImagesRef.current.length === 0 ||
      state.extractionStatus === "submitting"
    ) {
      return;
    }

    beginExtraction();
    setWorkspaceMessage(
      "Hyväksytyt peitetyt PNG-kuvat lähetetään OpenAI:lle poimintaa varten.",
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
      const payload: unknown = await response.json();

      if (!response.ok) {
        failExtraction(readExtractionError(payload));
        setWorkspaceMessage(
          "Poiminta epäonnistui. Paikalliset kuvat ja lähetysversiot säilyvät selaimessa.",
        );
        return;
      }

      const parsed = serviceHistorySchema.safeParse(payload);

      if (!parsed.success) {
        failExtraction(
          "Palvelimen vastaus ei ollut turvallisesti käsiteltävässä muodossa.",
        );
        setWorkspaceMessage(
          "Poiminnan vastaus hylättiin. Kuvat säilyvät selaimessa uutta yritystä varten.",
        );
        return;
      }

      completeExtraction(parsed.data);
      setWorkspaceMessage(
        "Huoltotapahtumat poimittiin. Tarkista ja korjaa tulos alla.",
      );
    } catch {
      failExtraction(
        "Poimintapalveluun ei saatu yhteyttä. Tarkista yhteys ja yritä uudelleen.",
      );
      setWorkspaceMessage(
        "Verkkovirhe ei poistanut paikallisia kuvia tai lähetysversioita.",
      );
    }
  };

  return (
    <section className="imageSection" aria-labelledby="image-workspace-heading">
      <div className="imageSectionIntro">
        <div>
          <p className="sectionLabel">Vaihe 2–3 / Kuvat ja poiminta</p>
          <h2 id="image-workspace-heading">
            Peitä tunnisteet ennen kuin kuva voi lähteä selaimesta.
          </h2>
        </div>
        <div className="privacyChecklist">
          <strong>Ennen myöhempää lähetystä</strong>
          <ul>
            <li>Vain alla näkyvä peitetty esikatselu voidaan lähettää.</li>
            <li>Peitetyn kuvan vastaanottava palveluntarjoaja on OpenAI.</li>
            <li>Rekisterinumeroa tai VINiä ei tarvita analyysiin.</li>
            <li>Peitä myös nimet, osoitteet ja asiakasnumerot.</li>
          </ul>
        </div>
      </div>

      <div className="uploadPanel">
        <div>
          <h3>1. Lisää 1–{maxFiles} kuvaa</h3>
          <p>
            JPG, PNG tai WebP, enintään{" "}
            {formatMegabytes(maxBytesPerFile)} Mt kuvaa kohden. Tiedostot
            avataan vain selaimen muistissa.
          </p>
        </div>
        <label className="fileButton" htmlFor="service-images">
          Valitse kuvat
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
          <strong>Kaikkia tiedostoja ei voitu lisätä:</strong>
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
                <p className="sectionLabel">Kuvat</p>
                <h3 id="image-queue-heading">
                  {images.length}/{maxFiles} muistissa
                </h3>
              </div>
              <button
                className="textButton"
                type="button"
                onClick={() => clearWorkspace()}
              >
                Poista kaikki
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
                <p className="sectionLabel">2. Muokkaa valittua kuvaa</p>
                <h3>{selectedImage?.fileName}</h3>
              </div>
              <button
                className="dangerButton"
                type="button"
                onClick={removeSelectedImage}
              >
                Poista kuva
              </button>
            </div>

            <div className="editorToolbar" aria-label="Kuvan muokkaustyökalut">
              <div className="toolGroup">
                <button
                  type="button"
                  className={mode === "redact" ? "activeTool" : undefined}
                  aria-pressed={mode === "redact"}
                  onClick={() => setMode("redact")}
                >
                  Peitä alue
                </button>
                <button
                  type="button"
                  className={mode === "crop" ? "activeTool" : undefined}
                  aria-pressed={mode === "crop"}
                  onClick={() => setMode("crop")}
                >
                  Rajaa
                </button>
              </div>
              <div className="toolGroup">
                <button type="button" onClick={() => rotateSelectedImage(-1)}>
                  Käännä vasemmalle
                </button>
                <button type="button" onClick={() => rotateSelectedImage(1)}>
                  Käännä oikealle
                </button>
              </div>
              <div className="toolGroup">
                <button
                  type="button"
                  disabled={(selectedImage?.editor.past.length ?? 0) === 0}
                  onClick={() =>
                    updateSelectedEditor(
                      undoEditorChange,
                      "Edellinen kuvanmuokkaus kumottiin.",
                    )
                  }
                >
                  Kumoa
                </button>
                <button
                  type="button"
                  disabled={(selectedImage?.editor.future.length ?? 0) === 0}
                  onClick={() =>
                    updateSelectedEditor(
                      redoEditorChange,
                      "Kumottu kuvanmuokkaus tehtiin uudelleen.",
                    )
                  }
                >
                  Tee uudelleen
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
                      "Valitun kuvan muokkaukset nollattiin.",
                    )
                  }
                >
                  Nollaa kuva
                </button>
              </div>
            </div>

            <p className="toolHint">
              {mode === "redact"
                ? "Vedä kuvan päällä suorakulmio. Alue peitetään lopulliseen PNG-kuvaan mustana."
                : "Vedä säilytettävän alueen ympärille suorakulmio. Rajaus nollaa aiemmat peitteet."}
            </p>

            <div className="canvasFrame">
              <canvas
                ref={canvasRef}
                className="editorCanvas"
                role="img"
                aria-label="Muokattava kuva. Käytä valittua työkalua vetämällä osoittimella kuvan päällä."
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
          <h3>Kuvat eivät poistu laitteelta vielä tässä vaiheessa.</h3>
          <p>
            Tiedostovalinta ei käynnistä automaattista lähetystä. Alkuperäistä
            tiedostoa ei käytetä myöhemmän lähetyspaketin rakentamiseen.
          </p>
        </div>
      )}

      <div className="sanitizedPanel" aria-labelledby="sanitized-heading">
        <div className="sanitizedHeading">
          <div>
            <p className="sectionLabel">3. Tarkista lähetysversio</p>
            <h3 id="sanitized-heading">Täsmällinen peitetty esikatselu</h3>
            <p>
              Selain piirtää jokaisen kuvan uudeksi PNG-tiedostoksi. Peitteet
              ovat pysyviä pikseleitä, eikä alkuperäisen tiedoston EXIF-metadata
              siirry uuteen kuvaan.
            </p>
          </div>
          <button
            className="primaryButton"
            type="button"
            disabled={images.length === 0 || isPreparing}
            onClick={prepareSanitizedPreviews}
          >
            {isPreparing ? "Luodaan esikatselua…" : "Luo lähetysesikatselu"}
          </button>
        </div>

        {preparedImages.length > 0 ? (
          <>
            <ol className="sanitizedPreviewGrid">
              {preparedImages.map((preparedImage) => (
                <li key={preparedImage.clientId}>
                  <Image
                    src={preparedImage.previewUrl}
                    alt={`Lähetettävä esikatselu: ${preparedImage.sourceName}`}
                    width={preparedImage.width}
                    height={preparedImage.height}
                    unoptimized
                  />
                  <div>
                    <strong>{preparedImage.sourceName}</strong>
                    <span>
                      Uusi PNG · {preparedImage.width} × {preparedImage.height} px
                    </span>
                  </div>
                </li>
              ))}
            </ol>

            <div className="consentPanel">
              <label>
                <input
                  type="checkbox"
                  checked={privacyConfirmed}
                  onChange={(event) => {
                    setPrivacyConfirmed(event.target.checked);
                    setImagesApproved(false);
                  }}
                />
                <span>
                  Olen tarkistanut yllä näkyvät lähetysversiot. Rekisterinumero,
                  VIN, nimet, osoitteet ja muut tarpeettomat tunnisteet on
                  peitetty.
                </span>
              </label>
              <button
                className="primaryButton"
                type="button"
                disabled={!privacyConfirmed}
                onClick={approvePreparedImages}
              >
                Hyväksy peitetyt kuvat
              </button>
              <p>
                {imagesApproved
                  ? "Hyväksytty tähän istuntoon. Kuvia ei lähetetä ennen erillistä poimintapainiketta."
                  : "Hyväksyntä vaaditaan ennen ensimmäistä analyysipyyntöä."}
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
                      ? "Poimitaan tapahtumia…"
                      : "Lähetä OpenAI:lle ja poimi tapahtumat"}
                  </button>
                  <p>
                    Vain yllä näkyvät uudet PNG-kuvat lähetetään. Alkuperäisiä
                    tiedostoja ei ole lähetyspaketissa.
                  </p>
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <div className="emptySanitizedPreview">
            Lähetysversioita ei ole vielä luotu.
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

function readExtractionError(payload: unknown): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "error" in payload &&
    typeof payload.error === "object" &&
    payload.error !== null &&
    "message" in payload.error &&
    typeof payload.error.message === "string"
  ) {
    return payload.error.message;
  }

  return "Kuvien poiminta epäonnistui. Kuvat säilyvät selaimessa uutta yritystä varten.";
}
