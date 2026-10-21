import { test, expect as baseExpect, type Page } from '@playwright/test';

const expect = baseExpect.configure({ timeout: 30000 });
test.setTimeout(300000);
test.use({ actionTimeout: 30000, video: 'off' });
async function login(page: Page) {
  await page.goto('/#admin');
  await page.getByRole('textbox', { name: 'Nom d’utilisateur' }).fill('admin');
  await page.getByLabel('Mot de passe', { exact: true }).fill('admin');
  const authenticated = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/api/v1/auth/login/'), { timeout: 90000 });
  await page.getByRole('button', { name: 'Se connecter' }).click();
  const response = await authenticated;
  expect(response.ok(), await response.text()).toBeTruthy();
  await expect(page.getByRole('button', { name: /Nouveau Collaborateur/i })).toBeVisible({ timeout: 30000 });
}
async function write(page: Page, method: string, url: string, data: object) {
  const csrf = (await page.context().cookies()).find(c => c.name === 'csrftoken')?.value;
  const response = await page.request.fetch(url, { method, data, headers: { 'X-CSRFToken': csrf || '' } });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}
const dates = { start_at: '2027-12-20T08:00:00Z', end_at: '2027-12-20T20:00:00Z' };

test('composition settings persist, new dossiers copy defaults and revisions preserve issued documents', async ({ page }) => {
  await login(page);
  const marker = Date.now();
  const customer = await write(page, 'POST', '/api/v1/customers/create/', { display_name: 'QA composition ' + marker, lifecycle_status: 'client', party_type: 'individual' });
  const terms = await (await page.request.get('/api/v1/hahitantsoa/commercial-terms/')).json();
  const old = await write(page, 'POST', '/api/v1/hahitantsoa/event-drafts/', { customer_id: customer.id, event_name: 'Salle ancienne ' + marker, rental_type: 'bare', ...dates, lines: [] });
  const oldDoc = await write(page, 'POST', `/api/v1/hahitantsoa/event-drafts/${old.id}/documents/`, { template_key: 'hahitantsoa.proforma.v1' });
  await write(page, 'POST', `/api/v1/hahitantsoa/event-drafts/${old.id}/documents/${oldDoc.id}/generate/`, {});
  const artifactUrl = `/api/v1/documents/instances/${oldDoc.id}/artifact/`;
  const oldHtml = await (await page.request.get(artifactUrl)).text();
  try {
    await page.goto('/#hahitantsoa-settings');
    await expect(page.getByLabel('Élément 1', { exact: true })).toHaveValue(terms.bare_rental_composition[0].label);
    await page.getByLabel('Élément 1', { exact: true }).fill('Salle paramétrée ' + marker);
    const save = page.waitForResponse(r => r.request().method() === 'PATCH' && r.url().endsWith('/commercial-terms/'));
    await page.locator('form').getByRole('button', { name: /Enregistrer/i }).click();
    expect((await save).ok()).toBeTruthy();
    await page.reload();
    await expect(page.getByLabel('Élément 1', { exact: true })).toHaveValue('Salle paramétrée ' + marker);
    const fresh = await write(page, 'POST', '/api/v1/hahitantsoa/event-drafts/', { customer_id: customer.id, event_name: 'Salle nouvelle ' + marker, rental_type: 'bare', guest_count: 100, ...dates, lines: [] });
    expect(fresh.bare_rental_composition[0].label).toBe('Salle paramétrée ' + marker);
    expect((await (await page.request.get(`/api/v1/hahitantsoa/event-drafts/${old.id}/`)).json()).bare_rental_composition).toEqual(old.bare_rental_composition);
    await page.goto('/#reservation-new/edit-hahitantsoa/' + fresh.id);
    await expect(page.getByLabel('Élément 1', { exact: true })).toHaveValue('Salle paramétrée ' + marker);
    await page.getByLabel('Élément 1', { exact: true }).fill('Salle du dossier ' + marker);
    await page.getByLabel('Quantité 1').fill('2');
    await page.reload();
    await page.getByRole('button', { name: /Reprendre le brouillon/i }).click();
    await expect(page.getByLabel('Élément 1', { exact: true })).toHaveValue('Salle du dossier ' + marker);
    await page.getByTestId('jump-to-proforma-step-btn').click();
    await page.getByRole('button', { name: /Émettre la nouvelle révision/i }).click();
    await expect(page.getByText('Nouvelle révision du proforma émise avec succès', { exact: true })).toBeVisible({ timeout: 45000 });
    const persisted = await (await page.request.get(`/api/v1/hahitantsoa/event-drafts/${fresh.id}/`)).json();
    expect(persisted.bare_rental_composition[0]).toEqual({ label: 'Salle du dossier ' + marker, quantity: 2 });
    const docs = await (await page.request.get(`/api/v1/hahitantsoa/event-drafts/${fresh.id}/documents/`)).json();
    const issued = docs.find((d: { status: string; template_key: string }) => ['generated', 'issued'].includes(d.status) && d.template_key === 'hahitantsoa.proforma.v1');
    expect(issued).toBeTruthy();
    const html = await (await page.request.get(`/api/v1/documents/instances/${issued.id}/artifact/`)).text();
    expect(html).toContain('Location nue');
    expect(html).toContain('002 Salle du dossier ' + marker);
    expect(html).not.toContain('Location nue de l’espace');
    expect(await (await page.request.get(artifactUrl)).text()).toBe(oldHtml);
  } finally { await write(page, 'PATCH', '/api/v1/hahitantsoa/commercial-terms/', { bare_rental_composition: terms.bare_rental_composition }); }
});

test('payment exposes the official receipt immediately, downloads its PDF and reopens it after reload', async ({ page }) => {
  await login(page);
  const marker = Date.now();
  const customer = await write(page, 'POST', '/api/v1/customers/create/', { display_name: 'QA reçu ' + marker, lifecycle_status: 'client', party_type: 'individual' });
  const item = await write(page, 'POST', '/api/v1/inventory/items/', { name: 'QA matériel reçu ' + marker, kind: 'material', reported_inventory_quantity: 10, rental_price: '10000.00' });
  const draft = await write(page, 'POST', '/api/v1/reservations/drafts/', { customer_id: customer.id, ...dates, lines: [{ inventory_item_id: item.id, quantity: 1 }] });
  await page.goto('/#reservation-detail/' + draft.id);
  await page.getByRole('button', { name: /Encaisser l.acompte/ }).click();
  const modal = page.getByRole('dialog');
  await modal.getByPlaceholder('Ex: 500000').fill(String(Number(draft.required_deposit_amount)));
  const saved = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/api/v1/payments/deposits/record/'));
  await modal.getByRole('button', { name: 'Enregistrer & Valider le versement' }).click();
  const response = await saved;
  expect(response.ok(), await response.text()).toBeTruthy();
  const result = await response.json();
  const receipt = result.payment.receipt_document;
  expect(receipt.id).toBeTruthy();
  await expect(modal.getByTitle('Reçu officiel de paiement')).toHaveAttribute('srcdoc', new RegExp(receipt.document_reference));
  const download = page.waitForEvent('download');
  await modal.getByRole('button', { name: 'Télécharger le reçu PDF' }).click();
  expect((await download).suggestedFilename()).toContain('.pdf');
  const pdf = await page.request.get(`/api/v1/documents/instances/${receipt.id}/pdf/`);
  expect(pdf.ok()).toBeTruthy();
  expect((await pdf.body()).subarray(0, 4).toString()).toBe('%PDF');
  await page.reload();
  await page.getByRole('button', { name: /Reçu$/ }).first().click();
  await expect(page.getByTitle('Reçu officiel de paiement')).toHaveAttribute('srcdoc', new RegExp(receipt.document_reference));
  const rows = await (await page.request.get('/api/v1/payments/?reservation_draft_id=' + draft.id)).json();
  expect(rows.filter((p: { id: string }) => p.id === result.payment.id)).toHaveLength(1);
});
