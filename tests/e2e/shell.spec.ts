import { expect, test } from "@playwright/test";

test("shows the Phase 9 MVP, demo, workflow, and report controls", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /A clear service history/,
    }),
  ).toBeVisible();
  await expect(page.getByText("Phase 9 / MVP available")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Load synthetic demo" }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Make" })).toBeVisible();
  await expect(
    page.getByRole("spinbutton", { name: "Current odometer reading" }),
  ).toBeVisible();
  await expect(page.getByLabel("Select images")).toHaveAttribute(
    "accept",
    "image/jpeg,image/png,image/webp",
  );
  await expect(
    page.getByRole("heading", {
      name: "Extracted service events are normalized here.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Narrow down the exact vehicle variant using sources.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Review maintenance intervals one source at a time.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Maintenance status is calculated from verified evidence.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Review the report and save it to your device.",
    }),
  ).toBeVisible();
});

test("validates, confirms, and resets vehicle data in memory", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByRole("textbox", { name: "Make" }).fill("Toyota");
  await page.getByRole("textbox", { name: "Model" }).fill("Avensis");
  await page.getByLabel("Model year").fill("2015");
  await page.getByLabel("First registration year").fill("2015");
  await page
    .getByRole("spinbutton", { name: "Current odometer reading" })
    .fill("184000");
  await page.getByRole("button", { name: "Confirm vehicle details" }).click();

  const summary = page.getByTestId("confirmed-vehicle");
  await expect(summary.getByText("Toyota Avensis")).toBeVisible();
  await expect(summary.getByText(/184.?000 km/)).toBeVisible();

  await page.getByRole("button", { name: "Clear session" }).click();
  await expect(page.getByRole("textbox", { name: "Make" })).toHaveValue("");
  await expect(page.getByRole("textbox", { name: "Model" })).toHaveValue("");
  await expect(
    page.getByRole("spinbutton", { name: "Current odometer reading" }),
  ).toHaveValue("");
  await expect(summary).toHaveCount(0);
  await expect(page.getByText("Session cleared")).toBeVisible();
});

test("rejects invalid odometer and year combinations", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("textbox", { name: "Make" }).fill("Toyota");
  await page.getByRole("textbox", { name: "Model" }).fill("Avensis");
  await page.getByLabel("Model year").fill("2020");
  await page.getByLabel("First registration year").fill("2017");
  await page
    .getByRole("spinbutton", { name: "Current odometer reading" })
    .fill("-1");
  await page.getByRole("button", { name: "Confirm vehicle details" }).click();

  await expect(
    page.getByText("Enter the odometer reading as whole kilometres."),
  ).toBeVisible();
  await expect(
    page.getByText(
      "The first registration year cannot be more than one year before the model year.",
    ),
  ).toBeVisible();
  await expect(page.getByTestId("confirmed-vehicle")).toHaveCount(0);
});

test("reload clears all vehicle data", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("textbox", { name: "Make" }).fill("Toyota");
  await page.getByRole("textbox", { name: "Model" }).fill("Avensis");
  await page
    .getByRole("spinbutton", { name: "Current odometer reading" })
    .fill("184000");
  await page.getByRole("button", { name: "Confirm vehicle details" }).click();
  await expect(page.getByTestId("confirmed-vehicle")).toBeVisible();

  await page.reload();

  await expect(page.getByRole("textbox", { name: "Make" })).toHaveValue("");
  await expect(page.getByRole("textbox", { name: "Model" })).toHaveValue("");
  await expect(
    page.getByRole("spinbutton", { name: "Current odometer reading" }),
  ).toHaveValue("");
  await expect(page.getByTestId("confirmed-vehicle")).toHaveCount(0);
  await expect(page.getByText("No confirmed vehicle")).toBeVisible();
});

test("does not persist vehicle data in browser storage or cookies", async ({
  context,
  page,
}) => {
  await page.goto("/");

  await page.getByRole("textbox", { name: "Make" }).fill("Toyota");
  await page.getByRole("textbox", { name: "Model" }).fill("Avensis");
  await page
    .getByRole("spinbutton", { name: "Current odometer reading" })
    .fill("184000");
  await page.getByRole("button", { name: "Confirm vehicle details" }).click();

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
  await page.getByRole("link", { name: /How data is handled/ }).click();

  await expect(page).toHaveURL(/\/tietosuoja$/);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /Data handling is limited to one session/,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(/data retention and abuse monitoring policies/),
  ).toBeVisible();
});

test("disables response caching and content sniffing", async ({ request }) => {
  const response = await request.get("/");

  expect(response.ok()).toBe(true);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers()["pragma"]).toBe("no-cache");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response.headers()["x-powered-by"]).toBeUndefined();
  expect(response.headers()["content-security-policy"]).toContain(
    "default-src 'self'",
  );
  expect(response.headers()["content-security-policy"]).toContain(
    "connect-src 'self' blob:",
  );
  expect(response.headers()["content-security-policy"]).not.toContain(
    "'unsafe-eval'",
  );
  expect(response.headers()["permissions-policy"]).toContain("camera=()");
  expect(response.headers()["cross-origin-opener-policy"]).toBe("same-origin");
  expect(response.headers()["strict-transport-security"]).toContain(
    "max-age=31536000",
  );
});

test("loads the complete synthetic demo locally and clears it on reload", async ({
  page,
}) => {
  const apiRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/")) {
      apiRequests.push(request.url());
    }
  });
  await page.goto("/");

  await page
    .getByRole("button", { name: "Load synthetic demo" })
    .click();

  await expect(page.getByTestId("confirmed-vehicle")).toContainText(
    "Nordica Aurora",
  );
  await expect(
    page
      .getByRole("complementary", { name: "Normalized values" })
      .getByText("160 934,4 km", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Nordica Aurora", level: 3 }),
  ).toBeVisible();
  await expect(page.getByText("Conflicting sources").first()).toBeVisible();
  expect(apiRequests).toEqual([]);

  await page.reload();
  await expect(page.getByRole("textbox", { name: "Make" })).toHaveValue("");
  await expect(page.getByTestId("confirmed-vehicle")).toHaveCount(0);
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
