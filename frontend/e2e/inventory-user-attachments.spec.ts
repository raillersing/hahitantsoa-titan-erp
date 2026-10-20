import { test, expect, type Page } from '@playwright/test';

test.setTimeout(120000);
test.use({ actionTimeout: 30000, video: 'off' });
async function login(page: Page) {
  await page.goto('/#admin');
  await page.getByRole('textbox', { name: 'Nom d’utilisateur' }).fill('admin');
  await page.getByLabel('Mot de passe', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('button', { name: /Nouveau Collaborateur/i })).toBeVisible({ timeout: 15000 });
}
async function write(page: Page, method: string, url: string, data?: object) {
  const csrf = (await page.context().cookies()).find(c => c.name === 'csrftoken')?.value;
  return page.request.fetch(url, { method, data, headers: { 'X-CSRFToken': csrf || '' } });
}

test('inventory detail writes survive reload and deletion returns to inventory', async ({ page }) => {
  await login(page);
  const name = 'QA inventory ' + Date.now();
  const created = await write(page, 'POST', '/api/v1/inventory/items/', { name, kind: 'material', reported_inventory_quantity: 10 });
  expect(created.status()).toBe(201);
  const item = await created.json();
  await page.goto('/#inventory-item/' + item.id);
  await page.getByRole('button', { name: "Modifier l'article" }).click();
  await page.getByRole('dialog').locator('input').nth(1).fill(name + ' edited');
  await page.getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByRole('heading', { name: name + ' edited', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: name + ' edited', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Ajuster stock' }).click();
  await page.getByLabel('Ajustement (ex: +5, -2)').fill('2');
  await page.getByLabel(/Motif de la modification/).selectOption('Nouvel achat');
  await page.getByRole('button', { name: 'Appliquer', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(async () => (await (await page.request.get('/api/v1/inventory/items/' + item.id + '/')).json()).stock_summary.current_stock).toBe(12);
  await page.reload();
  await page.getByRole('button', { name: 'Désactiver', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Réactiver', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Réactiver', exact: true })).toBeVisible();
  await page.goto('/#inventory-management');
  await expect(page.getByRole('button', { name: 'Réactiver ' + name + ' edited', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Détail ' + name + ' edited', exact: true }).click();
  await page.getByRole('button', { name: 'Réactiver', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Désactiver', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Désactiver', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Supprimer', exact: true }).click();
  await page.getByRole('button', { name: "Supprimer l'article", exact: true }).click();
  await expect(page).toHaveURL(/#inventory-management/);
  const removed = await page.request.get('/api/v1/inventory/items/' + item.id + '/');
  expect(removed.status()).toBe(404);
});

test('user creation closes the form, announces success and refreshes the list', async ({ page }) => {
  await login(page);
  const username = 'qa.user.' + Date.now();
  await page.getByRole('button', { name: /Nouveau Collaborateur/i }).click();
  await page.getByPlaceholder('Ex: Jean', { exact: true }).fill('QA');
  await page.getByPlaceholder('Ex: Dupont', { exact: true }).fill('Collaborateur');
  await page.getByPlaceholder('ex: jean.dupont', { exact: true }).fill(username);
  const saved = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/api/v1/identity/users/'));
  await page.getByRole('button', { name: /Créer le collaborateur/ }).click();
  const response = await saved;
  expect(response.status(), await response.text()).toBe(201);
  const user = await response.json();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('créé avec succès');
  await expect(page.getByText('@' + username, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('@' + username, { exact: true })).toBeVisible();
  expect((await write(page, 'PATCH', '/api/v1/identity/users/' + user.id + '/', { is_active: false })).ok()).toBeTruthy();
});

test('customer identity accepts multiple pages and preserves every upload after reload', async ({ page }) => {
  await login(page);
  await page.goto('/#customers');
  const name = 'QA recto verso ' + Date.now();
  await page.getByRole('button', { name: /Nouveau client/i }).click();
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  await page.getByPlaceholder('Ex: Rakoto Jean').fill(name);
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  const photo = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
  await page.getByLabel('Ajouter une pièce jointe pour CIN').setInputFiles([
    { name: 'recto.png', mimeType: 'image/png', buffer: photo },
    { name: 'verso.png', mimeType: 'image/png', buffer: photo },
  ]);
  await page.getByLabel('Ajouter une pièce jointe pour CIN').setInputFiles({ name: 'page-3.png', mimeType: 'image/png', buffer: photo });
  await expect(page.getByAltText('Aperçu CIN')).toHaveCount(3);
  await page.getByRole('button', { name: 'Retirer page-3.png' }).click();
  await expect(page.getByAltText('Aperçu CIN')).toHaveCount(2);
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  await page.getByRole('button', { name: 'Créer le client', exact: true }).click();
  await expect(page).toHaveURL(new RegExp('#customer/'));
  await expect(page.getByText('recto.png', { exact: true })).toBeVisible();
  await expect(page.getByText('verso.png', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('recto.png', { exact: true })).toBeVisible();
  await expect(page.getByText('verso.png', { exact: true })).toBeVisible();
});
