import { expect, test } from "@playwright/test";

test("keeps the complete demo within the mobile viewport", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
  await expectNoDocumentOverflow(page);

  const demoButton = page.getByRole("button", {
    name: "Load synthetic demo",
  });
  const demoButtonBox = await demoButton.boundingBox();
  expect(demoButtonBox?.height).toBeGreaterThanOrEqual(44);
  await demoButton.click();

  await expect(
    page.getByRole("heading", { name: "Nordica Aurora", level: 3 }),
  ).toBeVisible();
  await expectNoDocumentOverflow(page);

  const exportActions = page.locator(".reportExportActions");
  await exportActions.scrollIntoViewIfNeeded();
  await expect(exportActions).toHaveCSS("flex-direction", "column");
  await expectNoDocumentOverflow(page);

  const reportTableFrame = page.locator(".reportTableFrame").first();
  await expect(reportTableFrame).toBeVisible();
  const tableOverflow = await reportTableFrame.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(tableOverflow.scrollWidth).toBeGreaterThan(tableOverflow.clientWidth);
  await expectNoDocumentOverflow(page);

  await page.getByRole("link", { name: "Privacy", exact: true }).click();
  await expect(page).toHaveURL(/\/tietosuoja$/);
  await expectNoDocumentOverflow(page);
});

async function expectNoDocumentOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;

    return {
      clientWidth: viewportWidth,
      scrollWidth: document.documentElement.scrollWidth,
      candidates: Array.from(
        document.querySelectorAll<HTMLElement>("body *"),
      )
        .filter((element) => {
          const rectangle = element.getBoundingClientRect();
          return rectangle.right > viewportWidth + 1 || rectangle.left < -1;
        })
        .slice(0, 10)
        .map((element) => ({
          tag: element.tagName,
          className: element.className,
          right: Math.round(element.getBoundingClientRect().right),
          width: Math.round(element.getBoundingClientRect().width),
        })),
    };
  });

  expect(
    overflow.scrollWidth,
    JSON.stringify(overflow.candidates),
  ).toBeLessThanOrEqual(overflow.clientWidth);
}
