import { expect, test, type Page } from '@playwright/test';

// The browser acceptance environment provisions this DEBUG-only admin via
// seed_dev_admin. The journey performs reservation-sensitive writes, so using
// the standard session fixture would correctly be denied by the application.
const username = 'admin';
const password = 'admin';

async function login(page: Page) {
  await page.goto('/#reservation-new');
  await expect(page.getByRole('heading', { name: 'Connexion opérateur' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Nom d’utilisateur' }).fill(username);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('heading', { name: 'Assistant de Création' })).toBeVisible({ timeout: 15_000 });
}

test('Titan : l’assistant émet les documents, enregistre l’acompte et persiste le dossier', async ({ page }) => {
  await login(page);

  await page.getByText('Commencer par le client', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sélection ou création du client' })).toBeVisible();
  await page.locator('[data-testid^="client-select-"]').first().click();
  await page.getByRole('button', { name: 'Continuer' }).click();

  await page.getByText('Titan Rental', { exact: true }).click();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.getByRole('heading', { name: 'Détails Location (Titan)' })).toBeVisible();
  await page.getByLabel('Nom du lieu').fill('Dépôt logistique Ankorondrano');
  await page.getByLabel('Commune ou ville').fill('Antananarivo');
  await page.getByLabel('Adresse complète').fill('Lot E2E 01, Antananarivo');
  await page.getByRole('button', { name: '+14 jours' }).click();
  await page.getByLabel('Heure de début de location').fill('09:00');
  await page.getByLabel('Heure de fin de location').fill('17:00');
  await page.getByRole('button', { name: /Aller au catalogue/i }).click();

  await expect(page.getByRole('heading', { name: 'Catalogue Matériels' })).toBeVisible();
  const quantity = page.locator('input[aria-label^="Quantité pour"]').first();
  await expect(quantity).toBeVisible();
  await quantity.fill('1');

  await page.getByRole('button', { name: 'Aller à la Livraison' }).click();
  await expect(page.getByRole('heading', { name: 'Option Livraison (Titan)' })).toBeVisible();

  const persisted = page.waitForResponse((response) =>
    response.request().method() === 'POST'
    && new URL(response.url()).pathname === '/api/v1/reservations/drafts/'
    && response.status() === 201,
  );
  await page.getByRole('button', { name: 'Vérifier le résumé' }).click();
  const persistedResponse = await persisted;
  const persistedDraft = await persistedResponse.json() as { id: string; status: string };
  expect(persistedDraft.id).toBeTruthy();
  expect(persistedDraft.status).toBe('draft');

  await expect(page.getByRole('heading', { name: 'Résumé modifiable' })).toBeVisible();
  await page.getByRole('button', { name: 'Générer Devis/Proforma' }).click();
  await expect(page.getByRole('heading', { name: 'Aperçu Proforma' })).toBeVisible();

  const proformaGenerated = page.waitForResponse((response) =>
    response.request().method() === 'POST'
    && /\/api\/v1\/documents\/reservation-drafts\/[^/]+\/instances\/[^/]+\/generate-pdf\/$/.test(new URL(response.url()).pathname)
    && response.ok(),
  );
  await page.getByRole('button', { name: 'Passer au paiement' }).click();
  await proformaGenerated;
  await expect(page.getByRole('heading', { name: 'Acompte / Paiement' })).toBeVisible();

  const paymentAmount = page.locator('#reservation-payment-amount');
  const requiredAmount = await paymentAmount.getAttribute('max');
  expect(requiredAmount).toBeTruthy();
  await paymentAmount.fill(requiredAmount!);
  const depositRecorded = page.waitForResponse((response) =>
    response.request().method() === 'POST'
    && new URL(response.url()).pathname === '/api/v1/payments/deposits/record/'
    && response.ok(),
  );
  await page.getByRole('button', { name: 'Enregistrer le paiement' }).click();
  await depositRecorded;
  await expect(page.getByRole('heading', { name: 'Aperçu Contrat' })).toBeVisible();

  const contractGenerated = page.waitForResponse((response) =>
    response.request().method() === 'POST'
    && /\/api\/v1\/documents\/instances\/[^/]+\/convert-to-contract\/$/.test(new URL(response.url()).pathname)
    && response.ok(),
  );
  await page.getByRole('button', { name: 'Générer le contrat et ouvrir le dossier' }).click();
  await contractGenerated;

  await page.goto(`/#reservation-detail/titan:${persistedDraft.id}`);
  await expect(page.getByRole('button', { name: 'Marquer contrat signé' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Marquer contrat signé' })).toBeVisible();

  const contractSigned = page.waitForResponse((response) =>
    response.request().method() === 'POST'
    && /\/api\/v1\/reservations\/drafts\/[^/]+\/contract-signed\/$/.test(new URL(response.url()).pathname)
    && response.ok(),
  );
  await page.getByRole('button', { name: 'Marquer contrat signé' }).click();
  await contractSigned;
  const confirmation = page.waitForResponse((response) =>
    response.request().method() === 'POST'
    && /\/api\/v1\/reservations\/drafts\/[^/]+\/confirm\/$/.test(new URL(response.url()).pathname)
    && response.ok(),
  );
  await page.getByRole('button', { name: 'Confirmer la réservation' }).click();
  await confirmation;
  await expect(page.getByText('Confirmée', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('Confirmée', { exact: true }).first()).toBeVisible();

  const persistedDocuments = await page.request.get(
    `/api/v1/documents/reservation-drafts/${persistedDraft.id}/instances/`,
  );
  expect(persistedDocuments.ok()).toBe(true);
  await expect(persistedDocuments.json()).resolves.toEqual(expect.arrayContaining([
    expect.objectContaining({ template_key: 'titan.proforma.v1' }),
    expect.objectContaining({ template_key: 'titan.contract.v1' }),
  ]));
});
