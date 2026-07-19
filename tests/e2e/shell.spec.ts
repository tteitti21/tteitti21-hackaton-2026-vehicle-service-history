import { expect, test } from "@playwright/test";

test("shows the Phase 7 vehicle, review, research, and status controls", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /Huoltohistoria selkeäksi/,
    }),
  ).toBeVisible();
  await expect(page.getByText("Vaihe 7 käytössä")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Merkki" })).toBeVisible();
  await expect(
    page.getByRole("spinbutton", { name: "Nykyinen matkamittarilukema" }),
  ).toBeVisible();
  await expect(page.getByLabel("Valitse kuvat")).toHaveAttribute(
    "accept",
    "image/jpeg,image/png,image/webp",
  );
  await expect(
    page.getByRole("heading", {
      name: "Poimitut huoltotapahtumat normalisoidaan tässä.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Rajaa tarkka ajoneuvoversio lähteiden avulla.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Tarkista huoltovälit lähde kerrallaan.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Huoltojen tila lasketaan todennetusta näytöstä.",
    }),
  ).toBeVisible();
});

test("validates, confirms, and resets vehicle data in memory", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByRole("textbox", { name: "Merkki" }).fill("Toyota");
  await page.getByRole("textbox", { name: "Malli" }).fill("Avensis");
  await page.getByLabel("Mallivuosi").fill("2015");
  await page.getByLabel("Ensirekisteröintivuosi").fill("2015");
  await page
    .getByRole("spinbutton", { name: "Nykyinen matkamittarilukema" })
    .fill("184000");
  await page.getByRole("button", { name: "Vahvista ajoneuvotiedot" }).click();

  const summary = page.getByTestId("confirmed-vehicle");
  await expect(summary.getByText("Toyota Avensis")).toBeVisible();
  await expect(summary.getByText(/184.?000 km/)).toBeVisible();

  await page.getByRole("button", { name: "Tyhjennä istunto" }).click();
  await expect(page.getByRole("textbox", { name: "Merkki" })).toHaveValue("");
  await expect(page.getByRole("textbox", { name: "Malli" })).toHaveValue("");
  await expect(
    page.getByRole("spinbutton", { name: "Nykyinen matkamittarilukema" }),
  ).toHaveValue("");
  await expect(summary).toHaveCount(0);
  await expect(page.getByText("Istunto on tyhjennetty")).toBeVisible();
});

test("rejects invalid odometer and year combinations", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("textbox", { name: "Merkki" }).fill("Toyota");
  await page.getByRole("textbox", { name: "Malli" }).fill("Avensis");
  await page.getByLabel("Mallivuosi").fill("2020");
  await page.getByLabel("Ensirekisteröintivuosi").fill("2017");
  await page
    .getByRole("spinbutton", { name: "Nykyinen matkamittarilukema" })
    .fill("-1");
  await page.getByRole("button", { name: "Vahvista ajoneuvotiedot" }).click();

  await expect(
    page.getByText("Anna matkamittarilukema kokonaisina kilometreinä."),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Ensirekisteröintivuosi ei voi olla yli vuotta mallivuotta aikaisempi.",
    ),
  ).toBeVisible();
  await expect(page.getByTestId("confirmed-vehicle")).toHaveCount(0);
});

test("reload clears all vehicle data", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("textbox", { name: "Merkki" }).fill("Toyota");
  await page.getByRole("textbox", { name: "Malli" }).fill("Avensis");
  await page
    .getByRole("spinbutton", { name: "Nykyinen matkamittarilukema" })
    .fill("184000");
  await page.getByRole("button", { name: "Vahvista ajoneuvotiedot" }).click();
  await expect(page.getByTestId("confirmed-vehicle")).toBeVisible();

  await page.reload();

  await expect(page.getByRole("textbox", { name: "Merkki" })).toHaveValue("");
  await expect(page.getByRole("textbox", { name: "Malli" })).toHaveValue("");
  await expect(
    page.getByRole("spinbutton", { name: "Nykyinen matkamittarilukema" }),
  ).toHaveValue("");
  await expect(page.getByTestId("confirmed-vehicle")).toHaveCount(0);
  await expect(page.getByText("Ei vahvistettua ajoneuvoa")).toBeVisible();
});

test("does not persist vehicle data in browser storage or cookies", async ({
  context,
  page,
}) => {
  await page.goto("/");

  await page.getByRole("textbox", { name: "Merkki" }).fill("Toyota");
  await page.getByRole("textbox", { name: "Malli" }).fill("Avensis");
  await page
    .getByRole("spinbutton", { name: "Nykyinen matkamittarilukema" })
    .fill("184000");
  await page.getByRole("button", { name: "Vahvista ajoneuvotiedot" }).click();

  const storage = await page.evaluate(async () => ({
    localStorageKeys: Object.keys(window.localStorage),
    sessionStorageKeys: Object.keys(window.sessionStorage),
    indexedDatabases: (await window.indexedDB.databases()).map(
      (database) => database.name,
    ),
  }));

  expect(storage).toEqual({
    localStorageKeys: [],
    sessionStorageKeys: [],
    indexedDatabases: [],
  });
  expect(await context.cookies()).toEqual([]);
});

test("provides the full privacy disclosure", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Miten tietoja käsitellään/ }).click();

  await expect(page).toHaveURL(/\/tietosuoja$/);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /Tietojen käsittely on rajattu yhteen istuntoon/,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(/säilytys- ja väärinkäytön valvontakäytännöt/),
  ).toBeVisible();
});

test("disables response caching and content sniffing", async ({ request }) => {
  const response = await request.get("/");

  expect(response.ok()).toBe(true);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers()["pragma"]).toBe("no-cache");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-powered-by"]).toBeUndefined();
});

test("lets the extraction route reject a body above the proxy buffer limit", async ({
  request,
}) => {
  const oversizedImageBytes = 31 * 1_048_576;
  const response = await request.post("/api/extract", {
    multipart: {
      images: {
        name: "sanitized-1-large-synthetic.png",
        mimeType: "image/png",
        buffer: Buffer.alloc(oversizedImageBytes),
      },
      image_manifest: JSON.stringify([
        {
          clientId: "large-synthetic",
          fileName: "sanitized-1-large-synthetic.png",
          mediaType: "image/png",
          width: 1,
          height: 1,
        },
      ]),
    },
  });

  expect(response.status()).toBe(413);
  expect(await response.json()).toMatchObject({
    error: { code: "payload_too_large" },
  });

  const headers = response.headers();
  const requestBodyBytes = Number(
    headers["x-autohuolto-request-body-bytes"],
  );
  const requestLimitBytes = Number(
    headers["x-autohuolto-request-body-limit-bytes"],
  );

  expect(requestBodyBytes).toBeGreaterThan(30 * 1_048_576);
  expect(requestLimitBytes).toBeGreaterThan(requestBodyBytes);
});
