import { expect, test } from "@playwright/test";

test("shows the Phase 0 Finnish shell without later-phase controls", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /Huoltohistoria selkeäksi/,
    }),
  ).toBeVisible();
  await expect(
    page.getByText(/Analyysi ei ole vielä käytössä\./),
  ).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveCount(0);
  await expect(page.locator("main button")).toHaveCount(0);
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
