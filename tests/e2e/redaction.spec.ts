import { expect, test, type Locator, type Page } from "@playwright/test";

test("redacts a synthetic identifier into the exact intercepted PNG payload", async ({
  page,
}) => {
  await page.goto("/");
  const originalBytes = await uploadSyntheticRegistrationImage(page);

  const canvas = page.getByRole("img", {
    name: /Muokattava kuva/,
  });
  await expect(
    page.getByRole("heading", { name: "synthetic-registration.png" }),
  ).toBeVisible();
  await expectCanvasSize(canvas, 320, 180);

  await page.getByRole("button", { name: "Käännä oikealle" }).click();
  await expectCanvasSize(canvas, 180, 320);
  await page.getByRole("button", { name: "Kumoa" }).click();
  await expectCanvasSize(canvas, 320, 180);
  await page.getByRole("button", { name: "Tee uudelleen" }).click();
  await expectCanvasSize(canvas, 180, 320);
  await page.getByRole("button", { name: "Nollaa kuva" }).click();
  await expectCanvasSize(canvas, 320, 180);

  await page.getByRole("button", { name: "Rajaa", exact: true }).click();
  await dragCanvasRectangle(canvas, {
    x: 10,
    y: 10,
    width: 300,
    height: 160,
  });
  await expectCanvasSize(canvas, 300, 160);
  await page.getByRole("button", { name: "Kumoa" }).click();
  await expectCanvasSize(canvas, 320, 180);

  await page.getByRole("button", { name: "Peitä alue" }).click();
  await dragCanvasRectangle(canvas, {
    x: 76,
    y: 62,
    width: 168,
    height: 58,
  });

  await page.getByRole("button", { name: "Luo lähetysesikatselu" }).click();
  const exactPreview = page.getByRole("img", {
    name: "Lähetettävä esikatselu: synthetic-registration.png",
  });
  await expect(exactPreview).toBeVisible({ timeout: 15_000 });

  const previewPixels = await decodeImagePixelsFromElement(page, exactPreview, [
    { x: 160, y: 90 },
    { x: 20, y: 20 },
  ]);
  expect(previewPixels[0]).toEqual([0, 0, 0, 255]);
  expect(previewPixels[1]).not.toEqual([0, 0, 0, 255]);

  const approveButton = page.getByRole("button", {
    name: "Hyväksy peitetyt kuvat",
  });
  await expect(approveButton).toBeDisabled();
  await page
    .getByRole("checkbox", { name: /Olen tarkistanut yllä näkyvät/ })
    .check();
  await approveButton.click();
  await expect(
    page.getByText(
      "Hyväksytty tähän istuntoon. Kuvia ei lähetetä ennen erillistä poimintapainiketta.",
    ),
  ).toBeVisible();

  let interceptedMultipart: Buffer | null = null;
  await page.route("**/api/extract", async (route) => {
    interceptedMultipart = route.request().postDataBuffer();
    await route.fulfill({
      status: 202,
      contentType: "application/json",
      body: "{}",
    });
  });

  await page.evaluate(async () => {
    const preview = document.querySelector<HTMLImageElement>(
      'img[alt="Lähetettävä esikatselu: synthetic-registration.png"]',
    );

    if (preview === null) {
      throw new Error("Sanitized preview is missing.");
    }

    const sanitizedBlob = await fetch(preview.src).then((response) =>
      response.blob(),
    );
    const body = new FormData();
    body.append(
      "images",
      new File([sanitizedBlob], "sanitized-browser-output.png", {
        type: "image/png",
        lastModified: 0,
      }),
    );
    body.append(
      "image_manifest",
      JSON.stringify([{ clientId: "synthetic-test", mediaType: "image/png" }]),
    );

    await fetch("/api/extract", {
      method: "POST",
      body,
      cache: "no-store",
    });
  });

  expect(interceptedMultipart).not.toBeNull();
  const multipart = interceptedMultipart as unknown as Buffer;
  expect(multipart.includes(Buffer.from("synthetic-registration.png"))).toBe(
    false,
  );
  expect(multipart.indexOf(Buffer.from(originalBytes))).toBe(-1);

  const transmittedPng = extractPngFromMultipart(multipart);
  expect(transmittedPng.equals(Buffer.from(originalBytes))).toBe(false);

  const transmittedPixels = await decodePngPixels(page, transmittedPng, [
    { x: 160, y: 90 },
    { x: 20, y: 20 },
  ]);
  expect(transmittedPixels[0]).toEqual([0, 0, 0, 255]);
  expect(transmittedPixels[1]).not.toEqual([0, 0, 0, 255]);
});

test("submits only the sanitized image and renders an editable extraction", async ({
  page,
}) => {
  await page.goto("/");
  await prepareApprovedSyntheticImage(page);

  let submittedBytes: Buffer | null = null;
  await page.route("**/api/extract", async (route) => {
    submittedBytes = route.request().postDataBuffer();
    const requestText = submittedBytes?.toString("utf8") ?? "";
    const imageId = requestText.match(/"clientId":"([^"]+)"/)?.[1];

    if (imageId === undefined) {
      throw new Error("The sanitized image manifest is missing.");
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        images: [
          {
            image_id: imageId,
            readability: 0.94,
            notes: "Synteettinen kuva on selkeä.",
          },
        ],
        events: [
          {
            event_id: "event-synthetic-1",
            source_image_ids: [imageId],
            raw_evidence:
              "Öljy ja suodatin vaihdettu 12.3.2024, 120000 km",
            service_date: {
              value: "2024-03-12",
              precision: "day",
              confidence: 0.93,
            },
            odometer: {
              value: 120000,
              unit: "km",
              confidence: 0.91,
            },
            actions: [
              {
                component_code: "engine_oil",
                component_label: "Moottoriöljy",
                action_type: "replaced",
                description: "Öljy ja suodatin vaihdettu",
                confidence: 0.9,
              },
            ],
            workshop: null,
            notes: null,
            confidence: 0.88,
            ambiguities: [],
          },
        ],
        warnings: [],
      }),
    });
  });

  await page
    .getByRole("button", { name: "Lähetä OpenAI:lle ja poimi tapahtumat" })
    .click();

  await expect(
    page.getByRole("heading", {
      name: "Tarkista jokainen kuvista poimittu tapahtuma.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "Öljy ja suodatin vaihdettu" }),
  ).toBeVisible();
  await expect(page.getByText(/Korkea \(88 %\)/).first()).toBeVisible();

  const evidence = page.getByLabel("Raaka kuvasta luettu näyttö");
  await evidence.fill("Käyttäjän tarkistama synteettinen näyttö");
  await expect(evidence).toHaveValue("Käyttäjän tarkistama synteettinen näyttö");

  await page.getByRole("button", { name: "Lisää tapahtuma" }).click();
  await expect(page.getByRole("row")).toHaveCount(3);

  expect(submittedBytes).not.toBeNull();
  const multipart = submittedBytes as unknown as Buffer;
  expect(multipart.includes(Buffer.from("synthetic-registration.png"))).toBe(
    false,
  );
  await expect(
    page.getByRole("img", {
      name: "Lähetettävä esikatselu: synthetic-registration.png",
    }),
  ).toBeVisible();
});

test("keeps local images available after a provider error", async ({ page }) => {
  await page.goto("/");
  await prepareApprovedSyntheticImage(page);

  await page.route("**/api/extract", async (route) => {
    await route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "provider_error",
          message: "Poimintapalvelu ei vastannut turvallisesti.",
          request_id: "synthetic-request",
        },
      }),
    });
  });

  await page
    .getByRole("button", { name: "Lähetä OpenAI:lle ja poimi tapahtumat" })
    .click();

  await expect(page.locator(".extractionError")).toContainText(
    "Poimintapalvelu ei vastannut turvallisesti.",
  );
  await expect(
    page.getByRole("img", {
      name: "Lähetettävä esikatselu: synthetic-registration.png",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Lähetä OpenAI:lle ja poimi tapahtumat",
    }),
  ).toBeEnabled();
});

test("rejects unsupported and oversized files before browser decoding", async ({
  page,
}) => {
  await page.goto("/");
  const input = page.getByLabel("Valitse kuvat");

  await input.setInputFiles({
    name: "unsupported.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });
  await expect(
    page.getByText(/tuettuja tiedostomuotoja ovat JPG, PNG ja WebP/),
  ).toBeVisible();
  await expect(page.getByText(/1\/10 muistissa/)).toHaveCount(0);

  await input.setInputFiles({
    name: "too-large.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(10_485_761),
  });
  await expect(page.getByText(/tiedosto ylittää kokorajan 10 Mt/)).toBeVisible();
  await expect(page.getByText(/1\/10 muistissa/)).toHaveCount(0);
});

test("reload discards decoded images and sanitized previews", async ({ page }) => {
  await page.goto("/");
  await uploadSyntheticRegistrationImage(page);
  await page.getByRole("button", { name: "Luo lähetysesikatselu" }).click();
  await expect(
    page.getByRole("img", {
      name: "Lähetettävä esikatselu: synthetic-registration.png",
    }),
  ).toBeVisible();

  await page.reload();

  await expect(page.getByText(/1\/10 muistissa/)).toHaveCount(0);
  await expect(
    page.getByText("Lähetysversioita ei ole vielä luotu."),
  ).toBeVisible();
  await expect(page.getByText(/Kuvat eivät poistu laitteelta/)).toBeVisible();
});

async function prepareApprovedSyntheticImage(page: Page) {
  await uploadSyntheticRegistrationImage(page);
  await page.getByRole("button", { name: "Peitä alue" }).click();
  await dragCanvasRectangle(
    page.getByRole("img", { name: /Muokattava kuva/ }),
    {
      x: 76,
      y: 62,
      width: 168,
      height: 58,
    },
  );
  await page.getByRole("button", { name: "Luo lähetysesikatselu" }).click();
  await expect(
    page.getByRole("img", {
      name: "Lähetettävä esikatselu: synthetic-registration.png",
    }),
  ).toBeVisible({ timeout: 15_000 });
  await page
    .getByRole("checkbox", { name: /Olen tarkistanut yllä näkyvät/ })
    .check();
  await page.getByRole("button", { name: "Hyväksy peitetyt kuvat" }).click();
}

async function uploadSyntheticRegistrationImage(page: Page): Promise<number[]> {
  return page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 180;
    const context = canvas.getContext("2d");

    if (context === null) {
      throw new Error("Canvas is unavailable.");
    }

    context.fillStyle = "#f7f0dd";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#315747";
    context.fillRect(18, 18, 284, 28);
    context.fillStyle = "#f2cc45";
    context.fillRect(80, 66, 160, 50);
    context.strokeStyle = "#17231f";
    context.lineWidth = 3;
    context.strokeRect(80, 66, 160, 50);
    context.fillStyle = "#17231f";
    context.font = "bold 26px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("TEST-123", 160, 91);
    context.fillStyle = "#315747";
    context.font = "16px sans-serif";
    context.fillText("SYNTHETIC SERVICE", 160, 145);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => {
        if (result === null) {
          reject(new Error("Synthetic PNG generation failed."));
          return;
        }
        resolve(result);
      }, "image/png");
    });
    const originalBytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
    const input = document.querySelector<HTMLInputElement>("#service-images");

    if (input === null) {
      throw new Error("Image input is missing.");
    }

    const transfer = new DataTransfer();
    transfer.items.add(
      new File([blob], "synthetic-registration.png", {
        type: "image/png",
        lastModified: 1_750_000_000_000,
      }),
    );
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));

    return originalBytes;
  });
}

async function expectCanvasSize(
  canvas: Locator,
  width: number,
  height: number,
) {
  await expect
    .poll(() =>
      canvas.evaluate((element: HTMLCanvasElement) => ({
        width: element.width,
        height: element.height,
      })),
    )
    .toEqual({ width, height });
}

async function dragCanvasRectangle(
  canvas: Locator,
  rectangle: { x: number; y: number; width: number; height: number },
) {
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  const intrinsic = await canvas.evaluate((element: HTMLCanvasElement) => ({
    width: element.width,
    height: element.height,
  }));

  if (box === null) {
    throw new Error("Editor canvas is not visible.");
  }

  const startX = box.x + (rectangle.x / intrinsic.width) * box.width;
  const startY = box.y + (rectangle.y / intrinsic.height) * box.height;
  const endX =
    box.x + ((rectangle.x + rectangle.width) / intrinsic.width) * box.width;
  const endY =
    box.y + ((rectangle.y + rectangle.height) / intrinsic.height) * box.height;

  await canvas.page().mouse.move(startX, startY);
  await canvas.page().mouse.down();
  await canvas.page().mouse.move(endX, endY, { steps: 5 });
  await canvas.page().mouse.up();
}

async function decodeImagePixelsFromElement(
  page: Page,
  image: Locator,
  points: Array<{ x: number; y: number }>,
): Promise<number[][]> {
  const source = await image.getAttribute("src");

  if (source === null) {
    throw new Error("Preview source is missing.");
  }

  return page.evaluate(
    async ({ sourceUrl, samplePoints }) => {
      const blob = await fetch(sourceUrl).then((response) => response.blob());
      const bitmap = await createImageBitmap(blob);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");

      if (context === null) {
        throw new Error("Canvas context is unavailable.");
      }

      context.drawImage(bitmap, 0, 0);
      const result = samplePoints.map(({ x, y }) =>
        Array.from(context.getImageData(x, y, 1, 1).data),
      );
      bitmap.close();
      return result;
    },
    { sourceUrl: source, samplePoints: points },
  );
}

async function decodePngPixels(
  page: Page,
  png: Buffer,
  points: Array<{ x: number; y: number }>,
): Promise<number[][]> {
  return page.evaluate(
    async ({ bytes, samplePoints }) => {
      const bitmap = await createImageBitmap(
        new Blob([new Uint8Array(bytes)], { type: "image/png" }),
      );
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d");

      if (context === null) {
        throw new Error("Canvas context is unavailable.");
      }

      context.drawImage(bitmap, 0, 0);
      const result = samplePoints.map(({ x, y }) =>
        Array.from(context.getImageData(x, y, 1, 1).data),
      );
      bitmap.close();
      return result;
    },
    { bytes: Array.from(png), samplePoints: points },
  );
}

function extractPngFromMultipart(multipart: Buffer): Buffer {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const endMarker = Buffer.from([
    0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
  const start = multipart.indexOf(signature);
  const markerStart = multipart.indexOf(endMarker, start);

  if (start < 0 || markerStart < 0) {
    throw new Error("No complete PNG was found in the multipart request.");
  }

  return multipart.subarray(start, markerStart + endMarker.length);
}
