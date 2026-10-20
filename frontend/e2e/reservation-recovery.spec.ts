import { test, expect, type Page } from '@playwright/test';

test.setTimeout(120000);
test.use({ actionTimeout: 30000, video: 'off' });

async function login(page: Page) {
  await page.goto('/#customers');
  await page.getByRole('textbox', { name: 'Nom d’utilisateur' }).fill('admin');
  await page.getByLabel('Mot de passe', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('button', { name: /Nouveau client/i })).toBeVisible();
}
async function write(page: Page, url: string, data: object) {
  const csrf = (await page.context().cookies()).find(cookie => cookie.name === 'csrftoken')?.value;
  const response = await page.request.post(url, { data, headers: { 'X-CSRFToken': csrf || '' } });
  expect(response.status(), await response.text()).toBe(201);
  return response.json();
}
function futureDate(days: number) {
  const date = new Date(); date.setDate(date.getDate() + days);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

test('client creation survives reload with identity photos and corrected fields', async ({ page }) => {
  await login(page);
  const originalName = 'QA reprise client ' + Date.now();
  await page.getByRole('button', { name: /Nouveau client/i }).click();
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  await page.getByPlaceholder('Ex: Rakoto Jean').fill(originalName);
  await page.getByPlaceholder('Ex: 034 00 000 00').fill('0341234567');
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
  await page.getByLabel('Ajouter une pièce jointe pour CIN').setInputFiles([
    { name: 'recto-reprise.png', mimeType: 'image/png', buffer: image },
    { name: 'verso-reprise.png', mimeType: 'image/png', buffer: image },
  ]);
  const session = await (await page.request.get('/api/v1/auth/session/')).json();
  const key = 'customerWizardDraft:' + session.user.id;
  await expect.poll(() => page.evaluate(key => new Promise<number>(resolve => {
    const opening = indexedDB.open('erp-wizard-files', 1);
    opening.onsuccess = () => {
      const database = opening.result;
      const request = database.transaction('drafts').objectStore('drafts').get(key);
      request.onsuccess = () => { resolve(Object.keys(request.result || {}).length); database.close(); };
    };
  }), key)).toBe(2);
  await page.reload();
  await page.getByRole('button', { name: 'Reprendre la création du client' }).click();
  await expect(page.getByAltText('Aperçu CIN')).toHaveCount(2);
  await page.getByRole('button', { name: 'Retour', exact: true }).last().click();
  await expect(page.getByPlaceholder('Ex: Rakoto Jean')).toHaveValue(originalName);
  await expect(page.getByPlaceholder('Ex: 034 00 000 00')).toHaveValue('0341234567');
  await page.getByPlaceholder('Ex: Rakoto Jean').fill(originalName + ' corrigé');
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  const saved = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/api/v1/customers/create/'));
  await page.getByRole('button', { name: 'Créer le client', exact: true }).click();
  const response = await saved;
  expect(response.status(), await response.text()).toBe(201);
  const customer = await response.json();
  await expect(page).toHaveURL(/#customer\//);
  expect((await (await page.request.get('/api/v1/customers/' + customer.id + '/')).json()).display_name).toBe(originalName + ' corrigé');
  await page.reload();
  await expect(page.getByText('recto-reprise.png', { exact: true })).toBeVisible();
  await expect(page.getByText('verso-reprise.png', { exact: true })).toBeVisible();
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBeNull();
});

test('reservation resumes across navigation, validates dates and updates the same client and draft', async ({ page }) => {
  await login(page);
  const marker = Date.now();
  const customer = await write(page, '/api/v1/customers/create/', { display_name: 'QA réservation ' + marker, lifecycle_status: 'client', party_type: 'individual' });
  const item = await write(page, '/api/v1/inventory/items/', { name: 'QA matériel reprise ' + marker, kind: 'material', reported_inventory_quantity: 10, rental_price: '1000.00' });
  await page.goto('/#reservation-new/titan');
  await page.getByTestId('client-select-' + customer.id).click();
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  await page.getByRole('button', { name: 'Aller au catalogue', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('dates et heures valides');
  await page.getByLabel('Date début de location').fill(futureDate(15));
  await page.getByLabel('Date fin de location').fill(futureDate(14));
  await page.getByRole('button', { name: 'Aller au catalogue', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('postérieure');
  await page.getByLabel('Date fin de location').fill(futureDate(16));
  await page.reload();
  await page.getByRole('button', { name: /Reprendre le brouillon/i }).click();
  await expect(page.getByLabel('Date début de location')).toHaveValue(futureDate(15));
  await page.getByLabel('Date début de location').fill(futureDate(22));
  await page.getByLabel('Date fin de location').fill(futureDate(23));
  await page.getByRole('button', { name: 'Aller au catalogue', exact: true }).click();
  await page.getByLabel('Quantité pour ' + item.name).fill('1');
  await page.getByRole('button', { name: 'Aller à la Livraison', exact: true }).click();
  const createdDraftResponse = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/api/v1/reservations/drafts/'));
  await page.getByRole('button', { name: 'Vérifier le résumé', exact: true }).click();
  const response = await createdDraftResponse;
  expect(response.status(), await response.text()).toBe(201);
  const draft = await response.json();
  await page.goto('/#dashboard');
  await page.goto('/#reservation-new');
  await page.getByRole('button', { name: /Reprendre le brouillon/i }).click();
  await expect(page.getByRole('heading', { name: 'Résumé modifiable', exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Modifier', exact: true }).first().click();
  await page.getByRole('button', { name: 'Corriger les informations du client' }).click();
  await page.getByPlaceholder('Ex: Jean Dupont').fill(customer.display_name + ' corrigé');
  const clientUpdate = page.waitForResponse(result => result.request().method() === 'POST' && result.url().endsWith('/api/v1/customers/' + customer.id + '/update/'));
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  const clientResponse = await clientUpdate;
  expect(clientResponse.ok(), await clientResponse.text()).toBeTruthy();
  await expect(page.getByRole('heading', { name: 'Détails Location (Titan)' })).toBeVisible();
  const correctedCustomer = await (await page.request.get('/api/v1/customers/' + customer.id + '/')).json();
  expect(correctedCustomer.display_name).toBe(customer.display_name + ' corrigé');
  await page.getByRole('button', { name: 'Aller au catalogue', exact: true }).click();
  await page.getByRole('button', { name: 'Aller à la Livraison', exact: true }).click();
  const update = page.waitForResponse(result => result.request().method() === 'PATCH' && result.url().endsWith('/api/v1/reservations/drafts/' + draft.id + '/'));
  await page.getByRole('button', { name: 'Vérifier le résumé', exact: true }).click();
  expect((await update).ok()).toBeTruthy();
  const persisted = await (await page.request.get('/api/v1/reservations/drafts/' + draft.id + '/')).json();
  expect(persisted.customer_id).toBe(customer.id);
  expect(persisted.start_at.slice(0, 10)).toBe(futureDate(22));
  expect(persisted.end_at.slice(0, 10)).toBe(futureDate(23));
  await page.reload();
  await page.getByRole('button', { name: /Reprendre le brouillon/i }).click();
  await expect(page.getByText(customer.display_name + ' corrigé', { exact: true })).toBeVisible();
});
