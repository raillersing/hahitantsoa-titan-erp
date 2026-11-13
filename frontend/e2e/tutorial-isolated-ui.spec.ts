import { expect, test } from "@playwright/test";

// UI qualification only: fake session and isolated read responses, no real backend.
test("tutorial remains in the current page and never sends a business write", async ({ page }) => {
  test.setTimeout(60000);
  const writes: string[] = [];
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (!["GET", "HEAD"].includes(request.method())) writes.push(`${request.method()} ${path}`);
    if (path === "/api/v1/auth/session/") {
      await route.fulfill({ json: { authenticated: true, user: { id: "tutorial-isolated", username: "tutorial", display_name: "Tutoriel", is_staff: false, roles: [], capabilities: { canSensitiveWrite: true } } } });
      return;
    }
    await route.fulfill({ json: { results: [] } });
  });
  await page.goto("/#help");
  await expect(page.getByRole("heading", { name: "Apprendre à utiliser l’ERP" })).toBeVisible();
  await page.getByRole("button", { name: "Guide interactif de cette page" }).click();
  await expect(page.getByRole("region", { name: "Guides de cette page" })).toBeVisible();
  await page.getByRole("region", { name: "Guides de cette page" }).getByRole("button", { name: /Bienvenue dans votre ERP/ }).click();
  await expect(page.getByRole("complementary", { name: /Guide interactif/ })).toBeVisible();
  await expect(page).toHaveURL(/#help/);
  await expect(page.locator("#tutorial-panel-slot aside")).toBeVisible();
  expect(writes).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("complementary", { name: /Guide interactif/ })).toHaveCount(0);
});
