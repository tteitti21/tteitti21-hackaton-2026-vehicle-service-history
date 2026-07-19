import fs from "node:fs/promises";

import ExcelJS from "exceljs";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { syntheticDemoSession } from "../../src/demo/synthetic-demo";

test("completes the synthetic three-document workflow from upload through export and reload", async ({
  context,
  page,
}) => {
  await page.goto("/");
  await fillSyntheticVehicle(page);
  await uploadSyntheticDocuments(page);

  await expect(page.getByText(/3\/10 muistissa/)).toBeVisible();
  await page
    .getByRole("button", { name: "Luo lähetysesikatselu" })
    .click();
  await expect(
    page.getByRole("img", {
      name: "Lähetettävä esikatselu: synthetic-service-document-1.png",
    }),
  ).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByRole("img", {
      name: "Lähetettävä esikatselu: synthetic-service-document-2.png",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: "Lähetettävä esikatselu: synthetic-service-document-3.png",
    }),
  ).toBeVisible();

  await page
    .getByRole("checkbox", { name: /Olen tarkistanut yllä näkyvät/ })
    .check();
  await page
    .getByRole("button", { name: "Hyväksy peitetyt kuvat" })
    .click();

  let extractionManifestIds: string[] = [];
  await page.route("**/api/extract", async (route) => {
    const requestText =
      route.request().postDataBuffer()?.toString("utf8") ?? "";
    extractionManifestIds = Array.from(
      requestText.matchAll(/"clientId":"([^"]+)"/g),
      (match) => match[1],
    );

    if (extractionManifestIds.length !== 3) {
      throw new Error("Expected three sanitized image manifest IDs.");
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "X-AutoHuolto-Request-Body-Bytes": "1048576",
        "X-AutoHuolto-Request-Body-Limit-Bytes": "210763776",
        "X-AutoHuolto-Extraction-Timeout-Ms": "180000",
      },
      body: JSON.stringify(
        withManifestImageIds(
          structuredClone(syntheticDemoSession.serviceHistory),
          extractionManifestIds,
        ),
      ),
    });
  });

  await page
    .getByRole("button", { name: "Lähetä OpenAI:lle ja poimi tapahtumat" })
    .click();

  await expect(
    page.getByRole("heading", {
      name: "Tarkista, normalisoi ja vahvista huoltohistoria.",
    }),
  ).toBeVisible();
  await expect(page.getByText("160 934,4 km", { exact: true })).toBeVisible();
  await page
    .getByRole("button", {
      name: "Muokkaa tapahtumaa event-demo-ambiguous",
    })
    .click();
  await expect(
    page.getByRole("textbox", {
      name: "Epäselvyydet, yksi rivi kutakin huomiota kohti",
    }),
  ).toHaveValue(/Toimenpiteen laji on epäselvä/);
  await page
    .getByRole("checkbox", {
      name: /Olen tarkistanut .* ja hyväksyn epävarmuuksien säilyttämisen/,
    })
    .check();
  await page
    .getByRole("button", { name: "Vahvista tarkistettu huoltohistoria" })
    .click();

  let submittedVehicle: unknown = null;
  await page.route("**/api/resolve-vehicle", async (route) => {
    submittedVehicle = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(syntheticDemoSession.vehicleResolution),
    });
  });

  await page
    .getByRole("button", { name: "Etsi ajoneuvoversiot verkosta" })
    .click();
  const candidateOne = page.locator(
    'input[type="radio"][value="candidate-1"]',
  );
  const candidateTwo = page.locator(
    'input[type="radio"][value="candidate-2"]',
  );
  await expect(candidateOne).not.toBeChecked();
  await expect(candidateTwo).not.toBeChecked();
  await expect(
    page.getByRole("button", {
      name: "Vahvista valittu ajoneuvoversio",
    }),
  ).toBeDisabled();
  await candidateOne.check();
  await page
    .getByRole("button", { name: "Vahvista valittu ajoneuvoversio" })
    .click();

  let submittedResearch: Record<string, unknown> | null = null;
  await page.route("**/api/research", async (route) => {
    submittedResearch = route.request().postDataJSON() as Record<
      string,
      unknown
    >;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(syntheticDemoSession.maintenanceResearch),
    });
  });

  await page
    .getByRole("button", { name: "Tutki huoltovälit verkosta" })
    .click();

  const oilStatus = componentStatusCard(page, "Moottoriöljy");
  await expect(oilStatus.getByText("Myöhässä")).toBeVisible();
  const beltStatus = componentStatusCard(page, "Jakohihna");
  await expect(beltStatus.getByText("Lähteissä ristiriita")).toBeVisible();
  const airFilterStatus = componentStatusCard(page, "Ilmansuodatin");
  await expect(
    airFilterStatus.getByText("Huoltohistoriasta ei löytynyt merkintää."),
  ).toBeVisible();
  const coolantStatus = componentStatusCard(page, "Jäähdytysneste");
  await expect(coolantStatus.getByText("Ei riittävää tietoa")).toBeVisible();
  await expect(
    page
      .getByRole("region", {
        name: "Tarkista huoltovälit lähde kerrallaan.",
      })
      .getByRole("link", {
        name: "SYNTHETIC official market bulletin",
      }),
  ).toHaveAttribute(
    "href",
    "https://maintenance.demo.invalid/nordica-bulletin",
  );

  expect(submittedVehicle).toMatchObject({
    make: "Nordica",
    model: "Aurora",
    generation: "N2",
    currentOdometerKm: 180_000,
  });
  expect(submittedResearch).toMatchObject({
    country: "FI",
    market: "Eurooppa",
    vehicle_variant: { engine: "1.8 hybrid N18-X, 110 kW" },
  });
  expect(JSON.stringify(submittedResearch)).not.toContain("raw_evidence");
  expect(JSON.stringify(submittedResearch)).not.toContain("source_image_ids");

  const exportApiRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/")) {
      exportApiRequests.push(request.url());
    }
  });

  const jsonDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Lataa JSON" }).click();
  const jsonDownload = await jsonDownloadPromise;
  expect(jsonDownload.suggestedFilename()).toBe(
    "autohuolto-nordica-aurora-2026-07-19.json",
  );
  const jsonPath = await jsonDownload.path();
  expect(jsonPath).not.toBeNull();
  const exportedJsonText = await fs.readFile(jsonPath!, "utf8");
  const exportedJson = JSON.parse(exportedJsonText);
  expect(exportedJson).toMatchObject({
    metadata: {
      distance_unit: "km",
      local_export: true,
      images_included: false,
    },
    vehicle: {
      make: "Nordica",
      model: "Aurora",
      current_odometer_km: 180_000,
      resolution: { candidate_id: "candidate-1" },
    },
    summary: {
      service_event_count: 3,
      component_count: 4,
    },
  });
  expect(exportedJson.service_history[0]).toMatchObject({
    original_odometer_value: 100_000,
    original_odometer_unit: "mi",
    odometer_km: 160_934.4,
  });
  expect(exportedJsonText).not.toContain('"images":');
  expect(exportedJsonText).not.toContain("data:image/");

  const excelDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Lataa Excel" }).click();
  const excelDownload = await excelDownloadPromise;
  expect(excelDownload.suggestedFilename()).toBe(
    "autohuolto-nordica-aurora-2026-07-19.xlsx",
  );
  const excelPath = await excelDownload.path();
  expect(excelPath).not.toBeNull();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(excelPath!);
  expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
    "Yhteenveto",
    "Huoltohistoria",
    "Komponentit",
    "Lähteet",
  ]);
  workbook.eachSheet((sheet) => expect(sheet.getImages()).toEqual([]));
  expect(exportApiRequests).toEqual([]);

  expect(extractionManifestIds).toHaveLength(3);
  await page.reload();

  await expect(page.getByRole("textbox", { name: "Merkki" })).toHaveValue("");
  await expect(page.getByText(/3\/10 muistissa/)).toHaveCount(0);
  await expect(page.getByTestId("confirmed-vehicle")).toHaveCount(0);
  await expect(page.getByText("Ei vahvistettua ajoneuvoa")).toBeVisible();
  expect(await context.cookies()).toEqual([]);
  const storage = await page.evaluate(async () => ({
    localStorageKeys: Object.keys(window.localStorage),
    sessionStorageKeys: Object.keys(window.sessionStorage),
    indexedDatabases: await window.indexedDB.databases(),
  }));
  expect(storage).toEqual({
    localStorageKeys: [],
    sessionStorageKeys: [],
    indexedDatabases: [],
  });
});

async function fillSyntheticVehicle(page: Page) {
  await page.getByRole("textbox", { name: "Merkki" }).fill("Nordica");
  await page.getByRole("textbox", { name: "Malli" }).fill("Aurora");
  await page.getByLabel("Sukupolvi tai alustakoodi").fill("N2");
  await page.getByLabel("Mallivuosi").fill("2021");
  await page.getByLabel("Ensirekisteröintivuosi").fill("2021");
  await page.getByLabel("Moottorin tilavuus").fill("1,8");
  await page.getByLabel("Moottorikoodi").fill("N18-X");
  await page.getByLabel("Teho").fill("110");
  await page.selectOption("#vehicle-fuelType", "hybrid");
  await page.selectOption("#vehicle-transmissionType", "cvt");
  await page.selectOption("#vehicle-drivetrain", "front_wheel_drive");
  await page
    .getByRole("spinbutton", { name: "Nykyinen matkamittarilukema" })
    .fill("180000");
  await page.getByRole("button", { name: "Vahvista ajoneuvotiedot" }).click();
}

async function uploadSyntheticDocuments(page: Page) {
  await page.evaluate(async () => {
    const transfer = new DataTransfer();

    for (let index = 1; index <= 3; index += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 420;
      const context = canvas.getContext("2d");
      if (context === null) {
        throw new Error("Canvas is unavailable.");
      }

      context.fillStyle = "#f7f0dd";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#21483b";
      context.fillRect(28, 28, 584, 58);
      context.fillStyle = "#ffffff";
      context.font = "bold 24px sans-serif";
      context.fillText(`SYNTHETIC SERVICE DOCUMENT ${index}/3`, 48, 65);
      context.fillStyle = "#17231f";
      context.font = "22px sans-serif";
      context.fillText(
        index === 1
          ? "Engine oil replaced · 100000 mi · 10.01.2025"
          : index === 2
            ? "Brake fluid / brakes? · 06.2024"
            : "Timing belt inspected · 176000 km · 14.02.2026",
        48,
        150,
      );
      context.fillStyle = "#58655f";
      context.font = "18px sans-serif";
      context.fillText(
        "FICTIONAL TEST DATA · NO PERSON OR REAL VEHICLE",
        48,
        205,
      );

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => {
          if (result === null) {
            reject(new Error("Synthetic PNG generation failed."));
            return;
          }
          resolve(result);
        }, "image/png");
      });
      transfer.items.add(
        new File([blob], `synthetic-service-document-${index}.png`, {
          type: "image/png",
          lastModified: 1_750_000_000_000 + index,
        }),
      );
    }

    const input = document.querySelector<HTMLInputElement>("#service-images");
    if (input === null) {
      throw new Error("Image input is missing.");
    }
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function withManifestImageIds(
  history: typeof syntheticDemoSession.serviceHistory,
  imageIds: string[],
) {
  const idMap = new Map(
    history.images.map((image, index) => [image.image_id, imageIds[index]]),
  );

  return {
    ...history,
    images: history.images.map((image) => ({
      ...image,
      image_id: idMap.get(image.image_id),
    })),
    events: history.events.map((event) => ({
      ...event,
      source_image_ids: event.source_image_ids.map((imageId) =>
        idMap.get(imageId),
      ),
    })),
  };
}

function componentStatusCard(page: Page, label: string): Locator {
  return page.locator(".componentStatusCard").filter({ hasText: label });
}
