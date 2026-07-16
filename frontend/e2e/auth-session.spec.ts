import { expect, test } from "@playwright/test";

const username = "phase1b-e2e";
const password = "Test-only-Phase1B!";

test("protège un deep-link, restaure la session et déconnecte réellement", async ({ page }) => {
  await page.goto("/#documents");
  await expect(page.getByRole("heading", { name: "Connexion opérateur" })).toBeVisible();

  await page.getByRole("textbox", { name: "Nom d’utilisateur" }).fill(username);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();

  await expect(page.getByRole("heading", { name: "Documents & Modèles" })).toBeVisible();
  await expect(page.getByText("phase1b-e2e", { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Documents & Modèles" })).toBeVisible();

  await page.getByRole("button", { name: "Menu utilisateur" }).click();
  await page.getByRole("button", { name: "Déconnexion" }).click();
  await expect(page.getByRole("heading", { name: "Connexion opérateur" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Connexion opérateur" })).toBeVisible();
});

test("le formulaire de connexion reste contenu à 320 px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/#dashboard");
  await expect(page.getByRole("heading", { name: "Connexion opérateur" })).toBeVisible();
  const widths = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(widths.scrollWidth).toBeLessThanOrEqual(widths.clientWidth);
});

test("affiche le profil backend et demande une reconnexion après expiration", async ({ page, context }) => {
  await page.goto("/#profile");
  await page.getByRole("textbox", { name: "Nom d’utilisateur" }).fill(username);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();

  await expect(page.getByRole("heading", { name: "Profil utilisateur", level: 1 })).toBeVisible();
  await expect(page.getByText(username, { exact: true })).toHaveCount(3);

  await context.clearCookies();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("erp:session-revalidation-required")));

  await expect(page.getByRole("heading", { name: "Connexion opérateur" })).toBeVisible();
  await expect(page.getByText(/Votre session a expiré/)).toBeVisible();
  await expect(page).toHaveURL(/#profile$/);
});
