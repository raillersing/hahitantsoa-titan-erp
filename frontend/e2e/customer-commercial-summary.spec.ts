import { test, expect, type Page } from '@playwright/test';

// Explicitly seeded, isolated read-model fixture: two dossiers in each category,
// one per domain. Never seed synthetic confirmed/closed dossiers in a user database.
// This fixture is consumed by conversion: re-provision its contacted prospect state
// before EVERY execution. Automatic retries cannot safely reset that persisted state.
const fixtureId = process.env.ERP_CUSTOMER_SUMMARY_FIXTURE_ID;
test.skip(!fixtureId, 'Requires the explicitly provisioned isolated customer-summary fixture.');
test.describe.configure({ retries: 0 });

async function write(page: Page, path: string, data: object) {
  const csrf = (await page.context().cookies()).find(cookie => cookie.name === 'csrftoken')?.value;
  const response = await page.request.post(path, { data, headers: { 'X-CSRFToken': csrf || '' } });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}

test('customer commercial columns reflect persisted mixed dossiers and cross-tab CRM changes', async ({ page, context }) => {
  await page.goto('/#customers');
  await page.getByRole('textbox', { name: 'Nom d’utilisateur' }).fill('qa-customer-columns');
  await page.getByLabel('Mot de passe', { exact: true }).fill('qa-local-columns');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  const search = page.getByPlaceholder(/Rechercher nom/);
  await search.fill('QA colonnes commerciales 20261023');
  const row = page.getByRole('row').filter({ hasText: 'QA colonnes commerciales 20261023' });
  const assertCounts = async () => {
    for (const label of ['Actuels', 'Clos', 'Brouillons', 'Annulés']) await expect(row.getByText(`${label} : 2`, { exact: true })).toBeVisible();
  };
  const detail = await (await page.request.get(`/api/v1/customers/${fixtureId}/`)).json();
  expect(detail.prospect_status, 'Re-provision the isolated contacted-prospect fixture before each run.').toBe('contacted');
  for (const field of ['current_dossier_count', 'closed_dossier_count', 'draft_dossier_count', 'cancelled_dossier_count']) expect(detail[field]).toBe(2);
  await assertCounts();
  await expect(row.getByText('Contacté', { exact: true })).toBeVisible();
  await expect(row.getByText(/Dépassée/)).toHaveCount(0);

  const editor = await context.newPage();
  await editor.goto('/#customers');
  await editor.bringToFront();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const date = [yesterday.getFullYear(), String(yesterday.getMonth() + 1).padStart(2, '0'), String(yesterday.getDate()).padStart(2, '0')].join('-');
  await write(editor, `/api/v1/customers/${fixtureId}/prospect-status/`, { prospect_status: 'qualified', next_follow_up: date });
  await page.bringToFront();
  // Chromium automation keeps tabs focused: explicitly deliver the return event.
  // API writes, subsequent GETs, rendering, and persisted reload remain real.
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(row.getByText('Qualifié', { exact: true })).toBeVisible();
  await expect(row.getByText(/Dépassée/)).toBeVisible();
  await expect(search).toHaveValue('QA colonnes commerciales 20261023');
  await assertCounts();

  await editor.bringToFront();
  await write(editor, `/api/v1/customers/${fixtureId}/convert/`, {});
  await page.bringToFront();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(row.getByText('Converti', { exact: true })).toBeVisible();
  await expect(row.getByText('Client', { exact: true })).toBeVisible();
  await expect(row.getByText(/Relance inactive/)).toBeVisible();
  await assertCounts();
  await page.getByRole('button', { name: /À relancer/ }).click();
  await expect(row).toHaveCount(0);
  await page.getByRole('button', { name: /Tous/ }).click();
  await assertCounts();

  await page.route('**/api/v1/customers/', route => route.abort('failed'), { times: 1 });
  await page.getByRole('button', { name: 'Actualiser les fiches' }).click();
  await expect(page.getByRole('alert')).toContainText('informations affichées peuvent être anciennes');
  await page.getByRole('button', { name: 'Réessayer', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await assertCounts();
  await page.reload();
  await search.fill('QA colonnes commerciales 20261023');
  await expect(row.getByText('Converti', { exact: true })).toBeVisible();
  await assertCounts();
  const persisted = await (await page.request.get(`/api/v1/customers/${fixtureId}/`)).json();
  expect(persisted.lifecycle_status).toBe('client');
  expect(persisted.prospect_status).toBe('converted');
  await editor.close();
});
