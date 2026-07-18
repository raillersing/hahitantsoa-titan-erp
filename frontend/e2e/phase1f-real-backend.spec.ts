import { expect, test, type Page } from '@playwright/test';

// This is the repository's non-secret, test-only backend fixture.  Do not replace
// it with values read from .env or with a mock response: this suite is the
// evidence that the prototype is talking to Django on the configured origin.
const username = 'phase1b-e2e';
const password = 'Test-only-Phase1B!';

type RuntimeEvidence = {
  consoleErrors: string[];
  pageErrors: string[];
  failedApi: string[];
  apiRequests: string[];
  apiResponses: Array<{ url: string; status: number }>;
};

function collectRuntimeEvidence(page: Page): RuntimeEvidence {
  const evidence: RuntimeEvidence = {
    consoleErrors: [],
    pageErrors: [],
    failedApi: [],
    apiRequests: [],
    apiResponses: [],
  };

  page.on('console', (message) => {
    if (message.type() === 'error') evidence.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => evidence.pageErrors.push(error.message));
  page.on('request', (request) => {
    if (request.url().includes('/api/')) evidence.apiRequests.push(`${request.method()} ${request.url()}`);
  });
  page.on('response', (response) => {
    if (response.url().includes('/api/')) {
      evidence.apiResponses.push({ url: response.url(), status: response.status() });
    }
  });
  page.on('requestfailed', (request) => {
    if (request.url().includes('/api/')) {
      evidence.failedApi.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'unknown'}`);
    }
  });
  return evidence;
}

function statusesFor(evidence: RuntimeEvidence, path: string) {
  return evidence.apiResponses
    .filter((response) => new URL(response.url).pathname === path)
    .map((response) => response.status);
}

async function login(page: Page) {
  await page.goto('/#documents');
  await expect(page.getByRole('heading', { name: 'Connexion opérateur' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Nom d’utilisateur' }).fill(username);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('heading', { name: 'Documents & Modèles' })).toBeVisible();
}

test('recette réelle: session, rechargement, déconnexion et réseau applicatif', async ({ page }) => {
  const evidence = collectRuntimeEvidence(page);
  await login(page);

  await expect.poll(() => evidence.apiRequests.some((request) => request.includes('/api/v1/auth/login/'))).toBe(true);
  await expect.poll(() => evidence.apiRequests.some((request) => request.includes('/api/v1/auth/session/'))).toBe(true);
  expect(statusesFor(evidence, '/api/v1/auth/login/')).toEqual(expect.arrayContaining([200]));
  expect(statusesFor(evidence, '/api/v1/auth/session/').every((status) => status >= 200 && status < 300)).toBe(true);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Documents & Modèles' })).toBeVisible();

  await page.getByRole('button', { name: 'Menu utilisateur' }).click();
  await page.getByRole('button', { name: 'Déconnexion' }).click();
  await expect(page.getByRole('heading', { name: 'Connexion opérateur' })).toBeVisible();
  await expect.poll(() => evidence.apiRequests.some((request) => request.includes('/api/v1/auth/logout/'))).toBe(true);
  expect(statusesFor(evidence, '/api/v1/auth/logout/').every((status) => status >= 200 && status < 300)).toBe(true);

  expect(evidence.failedApi, evidence.failedApi.join('\n')).toEqual([]);
  expect(evidence.pageErrors, evidence.pageErrors.join('\n')).toEqual([]);
  expect(evidence.consoleErrors, evidence.consoleErrors.join('\n')).toEqual([]);
});

test('recette réelle: expiration de session redirige sans fallback métier', async ({ page, context }) => {
  const evidence = collectRuntimeEvidence(page);
  await page.goto('/#profile');
  await page.getByRole('textbox', { name: 'Nom d’utilisateur' }).fill(username);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('heading', { name: 'Profil utilisateur', level: 1 })).toBeVisible();

  await context.clearCookies();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('erp:session-revalidation-required')));
  await expect(page.getByRole('heading', { name: 'Connexion opérateur' })).toBeVisible();
  await expect(page.getByText(/Votre session a expiré/)).toBeVisible();
  await expect.poll(() => statusesFor(evidence, '/api/v1/auth/session/').some((status) => status === 401 || status === 403)).toBe(true);

  expect(evidence.failedApi, evidence.failedApi.join('\n')).toEqual([]);
  expect(evidence.pageErrors, evidence.pageErrors.join('\n')).toEqual([]);
  expect(evidence.consoleErrors, evidence.consoleErrors.join('\n')).toEqual([]);
});
