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
      // Chromium can report an intentional navigation abort after the browser
      // already received the successful logout response.  Treat that lifecycle
      // noise as successful transport when a 2xx response for the same request
      // was observed; retain genuine failures for the assertion below.
      const hasSuccessfulResponse = evidence.apiResponses.some(
        (response) => response.url === request.url() && response.status >= 200 && response.status < 300,
      );
      if (!hasSuccessfulResponse) {
        evidence.failedApi.push(`${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'unknown'}`);
      }
    }
  });
  return evidence;
}

function statusesFor(evidence: RuntimeEvidence, path: string) {
  return evidence.apiResponses
    .filter((response) => new URL(response.url).pathname === path)
    .map((response) => response.status);
}

// AppShell aborts this background read on reload or session teardown. Complete
// the read before intentionally triggering those transitions, keeping genuine
// transport failures visible to collectRuntimeEvidence.
async function waitForUnreadNotifications(page: Page) {
  const response = await page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === 'GET'
      && url.pathname === '/api/v1/notifications/'
      && url.searchParams.get('unread_only') === 'true';
  });
  expect(response.status()).toBe(200);
  expect(await response.finished()).toBeNull();
}

async function login(page: Page) {
  await page.goto('/#documents');
  await expect(page.getByRole('heading', { name: 'Connexion opérateur' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Nom d’utilisateur' }).fill(username);
  await page.getByLabel('Mot de passe').fill(password);
  const notificationsLoaded = waitForUnreadNotifications(page);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('heading', { name: 'Documents', exact: true })).toBeVisible({ timeout: 15_000 });
  await notificationsLoaded;
}

test('recette réelle: session, rechargement, déconnexion et réseau applicatif', async ({ page }) => {
  const evidence = collectRuntimeEvidence(page);
  await login(page);

  await expect.poll(() => evidence.apiRequests.some((request) => request.includes('/api/v1/auth/login/'))).toBe(true);
  await expect.poll(() => evidence.apiRequests.some((request) => request.includes('/api/v1/auth/session/'))).toBe(true);
  expect(statusesFor(evidence, '/api/v1/auth/login/')).toEqual(expect.arrayContaining([200]));
  expect(statusesFor(evidence, '/api/v1/auth/session/').every((status) => status >= 200 && status < 300)).toBe(true);

  const notificationsReloaded = waitForUnreadNotifications(page);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Documents', exact: true })).toBeVisible({ timeout: 15_000 });
  await notificationsReloaded;

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
  const notificationsLoaded = waitForUnreadNotifications(page);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('heading', { name: 'Profil utilisateur', level: 1 })).toBeVisible({ timeout: 15_000 });
  await notificationsLoaded;

  await context.clearCookies();
  const sessionResponsePromise = page.waitForResponse((response) => {
    return new URL(response.url()).pathname === '/api/v1/auth/session/';
  });
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('erp:session-revalidation-required')));
  const sessionResponse = await sessionResponsePromise;
  await expect(page.getByRole('heading', { name: 'Connexion opérateur' })).toBeVisible();
  await expect(page.getByText(/Votre session a expiré/)).toBeVisible();
  expect([200, 401, 403]).toContain(sessionResponse.status());
  if (sessionResponse.status() === 200) {
    await expect(sessionResponse.json()).resolves.toMatchObject({ authenticated: false });
  }

  expect(evidence.failedApi, evidence.failedApi.join('\n')).toEqual([]);
  expect(evidence.pageErrors, evidence.pageErrors.join('\n')).toEqual([]);
  expect(evidence.consoleErrors, evidence.consoleErrors.join('\n')).toEqual([]);
});
