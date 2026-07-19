import { expect, test } from "@playwright/test";

test("provides named controls, unique IDs, landmarks, and a working skip link", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("lang", "fi");
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(
    page.getByRole("navigation", { name: "Päänavigaatio" }),
  ).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);

  const duplicateIds = await page.locator("[id]").evaluateAll((elements) => {
    const ids = elements.map((element) => element.id);
    return ids.filter((id, index) => ids.indexOf(id) !== index);
  });
  expect(duplicateIds).toEqual([]);

  const unnamedControls = await page
    .locator("button, a[href], input, select, textarea")
    .evaluateAll((elements) =>
      elements
        .filter((element) => {
          if (
            element instanceof HTMLInputElement &&
            element.type === "hidden"
          ) {
            return false;
          }
          const ariaLabel = element.getAttribute("aria-label")?.trim();
          const labelledBy = element
            .getAttribute("aria-labelledby")
            ?.trim();
          const text = element.textContent?.trim();
          const labels =
            element instanceof HTMLInputElement ||
            element instanceof HTMLSelectElement ||
            element instanceof HTMLTextAreaElement
              ? element.labels?.length ?? 0
              : 0;
          return !ariaLabel && !labelledBy && !text && labels === 0;
        })
        .map((element) => element.outerHTML.slice(0, 160)),
    );
  expect(unnamedControls).toEqual([]);

  await page.keyboard.press("Tab");
  const skipLink = page.getByRole("link", { name: "Siirry sisältöön" });
  await expect(skipLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#sisalto$/);
});

test("keeps the privacy disclosure keyboard-readable", async ({ page }) => {
  await page.goto("/tietosuoja");

  await expect(
    page.getByRole("heading", {
      level: 1,
      name: /Tietojen käsittely on rajattu yhteen istuntoon/,
    }),
  ).toBeVisible();
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.getByRole("link", { name: /OpenAI Enterprise Privacy/ }))
    .toHaveAttribute("rel", "noreferrer");
  await expect(page.locator("body")).toContainText(
    "Sivun sulkeminen tai päivittäminen poistaa nykyisen istunnon",
  );
});
