import { test, expect, type Page } from '@playwright/test';

test.setTimeout(300000);
test.use({ actionTimeout: 30000, video: 'off' });

async function login(page: Page) {
  await page.goto('/#customers');
  await page.getByRole('textbox', { name: 'Nom d’utilisateur' }).fill('admin');
  await page.getByLabel('Mot de passe', { exact: true }).fill('admin');
  const loggedIn = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/api/v1/auth/login/'));
  await page.getByRole('button', { name: 'Se connecter' }).click();
  expect((await loggedIn).ok()).toBeTruthy();
  await expect(page.getByRole('button', { name: /Nouveau client/i })).toBeVisible();
}

async function create(page: Page, url: string, data: object) {
  const csrf = (await page.context().cookies()).find(c => c.name === 'csrftoken')?.value;
  const response = await page.request.post(url, { data, headers: { 'X-CSRFToken': csrf || '' } });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}

test('new prospect submits Hahitantsoa services, payment retry keeps one receipt and customer links open both domains', async ({ page }) => {
  await login(page);
  const marker = Date.now();
  const customer = await create(page, '/api/v1/customers/create/', {
    display_name: 'QA prospect parcours ' + marker, lifecycle_status: 'prospect', prospect_status: 'new', party_type: 'individual',
    civilite: 'Monsieur', birth_date: '1990-01-01', birth_place: 'Antananarivo',
    id_type: 'CIN', id_number: '101010101010', id_issue_date: '2020-01-01', id_issue_place: 'Antananarivo',
    address: 'Adresse de test', phone: '0341234567', email: 'qa@example.test',
  });
  const terms = await (await page.request.get('/api/v1/hahitantsoa/commercial-terms/')).json();
  const services = await (await page.request.get('/api/v1/hahitantsoa/services/?active=true')).json();
  const service = services.find((row: { category: string }) => row.category === 'drapery');
  expect(service).toBeTruthy();
  await page.goto('/#reservation-new/hahitantsoa');
  await page.getByTestId('client-select-' + customer.id).click();
  await page.getByRole('button', { name: 'Continuer', exact: true }).click();
  await page.getByLabel('Date début événement').fill('2027-12-22');
  await page.getByRole('button', { name: /Suivant \(Services\)/ }).click();
  await page.getByRole('heading', { name: service.name, exact: true }).locator('..').getByRole('button').click();
  const submitted = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/api/v1/hahitantsoa/event-drafts/'));
  await page.getByRole('button', { name: 'Vérifier le résumé', exact: true }).click();
  const response = await submitted;
  expect(response.status(), await response.text()).toBe(201);
  const draft = await response.json();
  expect(draft.service_notes).toContain(service.name);
  expect((await (await page.request.get(`/api/v1/customers/${customer.id}/`)).json()).prospect_status).toBe('new');
  await page.getByRole('button', { name: 'Générer Devis/Proforma', exact: true }).click();
  await page.getByRole('button', { name: /Passer au paiement/ }).click();
  await page.getByLabel(/Montant de ce paiement \(Ar\)/).fill(String(Number(terms.bare_deposit_amount)));

  // Lose the response after a real committed payment, then retry through the same UI.
  let firstPaymentId = '';
  await page.route('**/api/v1/payments/deposits/record/', async route => {
    const committed = await route.fetch();
    expect(committed.ok(), await committed.text()).toBeTruthy();
    firstPaymentId = (await committed.json()).payment.id;
    await route.abort('failed');
  }, { times: 1 });
  await page.getByRole('button', { name: 'Enregistrer le versement & continuer', exact: true }).click();
  await expect(page.getByText(/Erreur de soumission/)).toBeVisible();
  const replayed = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/api/v1/payments/deposits/record/'));
  await page.getByRole('button', { name: 'Enregistrer le versement & continuer', exact: true }).click();
  const result = await (await replayed).json();
  expect(result.replayed).toBe(true);
  expect(result.payment.id).toBe(firstPaymentId);
  const receipt = result.payment.receipt_document;
  await expect(page.getByTitle('Reçu officiel de paiement')).toBeVisible();
  await expect(page.getByTitle('Reçu officiel de paiement')).toHaveAttribute('srcdoc', new RegExp(receipt.document_reference));
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Télécharger le reçu PDF' }).click();
  expect((await download).suggestedFilename()).toContain('.pdf');
  const secondDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Télécharger le reçu PDF' }).click();
  expect((await secondDownload).suggestedFilename()).toContain('.pdf');
  await page.getByRole('button', { name: /Générer le contrat et ouvrir le dossier/ }).click();
  await expect(page).toHaveURL(new RegExp('reservation-detail/hahitantsoa(?::|%3A)' + draft.id));
  await page.reload();
  const payments = await (await page.request.get(`/api/v1/payments/?hahitantsoa_event_draft_id=${draft.id}`)).json();
  expect(payments).toHaveLength(1);
  expect(payments[0].id).toBe(firstPaymentId);
  expect(payments[0].receipt_document.id).toBe(receipt.id);
  const pdf = await page.request.get(`/api/v1/documents/instances/${receipt.id}/pdf/`);
  expect(pdf.ok()).toBeTruthy();
  expect((await pdf.body()).subarray(0, 4).toString()).toBe('%PDF');

  const item = await create(page, '/api/v1/inventory/items/', { name: 'QA linked material ' + marker, kind: 'material', reported_inventory_quantity: 5, rental_price: '1000.00' });
  const titan = await create(page, '/api/v1/reservations/drafts/', { customer_id: customer.id, start_at: '2027-12-23T08:00:00Z', end_at: '2027-12-23T20:00:00Z', lines: [{ inventory_item_id: item.id, quantity: 1 }] });
  await page.goto('/#customer/' + customer.id);
  await page.reload();
  const table = page.getByRole('table');
  await table.getByRole('button').filter({ hasText: draft.public_reference }).click();
  await expect(page).toHaveURL(new RegExp('reservation-detail/hahitantsoa(?::|%3A)' + draft.id));
  await page.goto('/#customer/' + customer.id);
  await table.getByRole('button').filter({ hasText: titan.public_reference }).click();
  await expect(page).toHaveURL(new RegExp('reservation-detail/titan(?::|%3A)' + titan.id));
});

test('failed customer history shows retry instead of a false empty dossier list', async ({ page }) => {
  await login(page);
  const customer = await create(page, '/api/v1/customers/create/', { display_name: 'QA histoire ' + Date.now(), lifecycle_status: 'client', party_type: 'individual' });
  await page.route(`**/api/v1/customers/${customer.id}/timeline/`, route => route.abort('failed'), { times: 1 });
  await page.goto('/#customer/' + customer.id);
  await expect(page.getByText('Impossible de charger les dossiers liés.', { exact: true })).toBeVisible();
  await expect(page.getByText('Aucun dossier trouvé pour ce contact.')).toHaveCount(0);
  await page.getByRole('button', { name: 'Réessayer les dossiers', exact: true }).click();
  await expect(page.getByText('Aucun dossier trouvé pour ce contact.')).toBeVisible();
});
