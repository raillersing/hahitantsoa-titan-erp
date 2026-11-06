import { expect, test, type Page, type Request } from '@playwright/test';

// This is the repository's non-secret, test-only backend fixture.  Do not replace
// it with values read from .env or with a mock response: this suite is the
// evidence that the prototype is talking to Django on the configured origin.
const username = 'phase1b-e2e';
const password = 'Test-only-Phase1B!';

type RuntimeEvidence = {
  beginNotificationRead: () => void;
  consoleErrors: string[];
  pageErrors: string[];
  failedApi: string[];
  apiRequests: string[];
  apiResponses: Array<{ url: string; status: number; request: Request }>;
};

function collectRuntimeEvidence(page: Page): RuntimeEvidence {
  let notificationReadSequence = 0;
  const requests = new Map<Request, { order: number; sequence: number }>();
  const failedRequests: Request[] = [];
  const completedRequests = new Set<Request>();
  const evidence: RuntimeEvidence = {
    beginNotificationRead: () => { notificationReadSequence += 1; },
    consoleErrors: [],
    pageErrors: [],
    get failedApi() {
      return failedRequests.filter((request) => {
        if (completedRequests.has(request)) return false;
        const url = new URL(request.url());
        // Chromium may abort navigation after receiving this exact logout's
        // successful response. A different request at the same URL is no proof.
        if (request.method() === 'POST'
          && url.pathname === '/api/v1/auth/logout/'
          && request.failure()?.errorText === 'net::ERR_ABORTED'
          && evidence.apiResponses.some((response) => response.request === request
            && response.status >= 200 && response.status < 300)) return false;
        const observed = requests.get(request);
        if (request.method() !== 'GET'
          || url.pathname !== '/api/v1/notifications/'
          || url.search !== '?unread_only=true'
          || request.failure()?.errorText !== 'net::ERR_ABORTED'
          || !observed) return true;
        // StrictMode may cancel the first mount's read. Only a later completed
        // replacement in this same read sequence/frame explains that abort.
        return !evidence.apiResponses.some((response) => {
          const replacement = requests.get(response.request);
          return response.status === 200
            && response.url === request.url()
            && response.request.method() === 'GET'
            && response.request.frame() === request.frame()
            && replacement?.sequence === observed.sequence
            && replacement.order > observed.order
            && completedRequests.has(response.request);
        });
      }).map((request) => `${request.method()} ${request.url()}: ${request.failure()?.errorText ?? 'unknown'}`);
    },
    apiRequests: [],
    apiResponses: [],
  };

  page.on('console', (message) => {
    if (message.type() === 'error') evidence.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => evidence.pageErrors.push(error.message));
  page.on('request', (request) => {
    if (request.url().includes('/api/')) {
      requests.set(request, { order: requests.size, sequence: notificationReadSequence });
      evidence.apiRequests.push(`${request.method()} ${request.url()}`);
    }
  });
  page.on('response', (response) => {
    if (response.url().includes('/api/')) {
      evidence.apiResponses.push({ url: response.url(), status: response.status(), request: response.request() });
      const url = new URL(response.url());
      if (response.status() === 200 && response.request().method() === 'GET'
        && url.pathname === '/api/v1/notifications/' && url.search === '?unread_only=true') {
        void response.finished().then((error) => {
          if (error === null) completedRequests.add(response.request());
        }).catch(() => { /* Teardown cannot establish successful completion. */ });
      }
    }
  });
  page.on('requestfailed', (request) => {
    if (request.url().includes('/api/')) failedRequests.push(request);
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
async function waitForUnreadNotifications(page: Page, evidence: RuntimeEvidence) {
  evidence.beginNotificationRead();
  const response = await page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === 'GET'
      && url.pathname === '/api/v1/notifications/'
      && url.searchParams.get('unread_only') === 'true';
  });
  expect(response.status()).toBe(200);
  expect(await response.finished()).toBeNull();
}

async function login(page: Page, evidence: RuntimeEvidence) {
  await page.goto('/#documents');
  await expect(page.getByRole('heading', { name: 'Connexion opérateur' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Nom d’utilisateur' }).fill(username);
  await page.getByLabel('Mot de passe').fill(password);
  const notificationsLoaded = waitForUnreadNotifications(page, evidence);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('heading', { name: 'Documents', exact: true })).toBeVisible({ timeout: 15_000 });
  await notificationsLoaded;
}

test('recette réelle: session, rechargement, déconnexion et réseau applicatif', async ({ page }) => {
  const evidence = collectRuntimeEvidence(page);
  await login(page, evidence);

  await expect.poll(() => evidence.apiRequests.some((request) => request.includes('/api/v1/auth/login/'))).toBe(true);
  await expect.poll(() => evidence.apiRequests.some((request) => request.includes('/api/v1/auth/session/'))).toBe(true);
  expect(statusesFor(evidence, '/api/v1/auth/login/')).toEqual(expect.arrayContaining([200]));
  expect(statusesFor(evidence, '/api/v1/auth/session/').every((status) => status >= 200 && status < 300)).toBe(true);

  const notificationsReloaded = waitForUnreadNotifications(page, evidence);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Documents', exact: true })).toBeVisible({ timeout: 15_000 });
  await notificationsReloaded;

  await page.getByRole('button', { name: 'Menu utilisateur' }).click();
  const logoutResponsePromise = page.waitForResponse((response) =>
    response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/v1/auth/logout/');
  await page.getByRole('button', { name: 'Déconnexion' }).click();
  expect((await logoutResponsePromise).status()).toBe(204);
  await expect(page.getByRole('heading', { name: 'Connexion opérateur' })).toBeVisible();
  await expect.poll(() => evidence.apiRequests.some((request) => request.includes('/api/v1/auth/logout/'))).toBe(true);
  expect(statusesFor(evidence, '/api/v1/auth/logout/').every((status) => status >= 200 && status < 300)).toBe(true);

  const sessionAfterLogout = await page.request.get('/api/v1/auth/session/');
  expect(sessionAfterLogout.status()).toBe(200);
  await expect(sessionAfterLogout.json()).resolves.toMatchObject({ authenticated: false });

  expect(evidence.failedApi, evidence.failedApi.join('\n')).toEqual([]);
  expect(evidence.pageErrors, evidence.pageErrors.join('\n')).toEqual([]);
  expect(evidence.consoleErrors, evidence.consoleErrors.join('\n')).toEqual([]);
});

test('recette réelle: expiration de session redirige sans fallback métier', async ({ page, context }) => {
  const evidence = collectRuntimeEvidence(page);
  await page.goto('/#profile');
  await page.getByRole('textbox', { name: 'Nom d’utilisateur' }).fill(username);
  await page.getByLabel('Mot de passe').fill(password);
  const notificationsLoaded = waitForUnreadNotifications(page, evidence);
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


// These cases qualify the observer itself with controlled browser transport.
// The session scenarios above continue to use the real authenticated backend.
for (const scenario of [
  { method: 'GET', name: 'annulation remplacée', path: '/api/v1/notifications/?unread_only=true', error: 'aborted', replace: true, nextSequence: false, successFirst: false, status: 200, failures: 0 },
  { method: 'GET', name: 'panne réseau remplacée', path: '/api/v1/notifications/?unread_only=true', error: 'failed', replace: true, nextSequence: false, successFirst: false, status: 200, failures: 1 },
  { method: 'GET', name: 'autre lecture annulée', path: '/api/v1/auth/session/', error: 'aborted', replace: true, nextSequence: false, successFirst: false, status: 200, failures: 1 },
  { method: 'GET', name: 'annulation sans remplacement', path: '/api/v1/notifications/?unread_only=true', error: 'aborted', replace: false, nextSequence: false, successFirst: false, status: 200, failures: 1 },
  { method: 'GET', name: 'remplacement dans une autre séquence', path: '/api/v1/notifications/?unread_only=true', error: 'aborted', replace: true, nextSequence: true, successFirst: false, status: 200, failures: 1 },
  { method: 'GET', name: 'succès antérieur', path: '/api/v1/notifications/?unread_only=true', error: 'aborted', replace: true, nextSequence: false, successFirst: true, status: 200, failures: 1 },
  { method: 'GET', name: 'remplacement HTTP500', path: '/api/v1/notifications/?unread_only=true', error: 'aborted', replace: true, nextSequence: false, successFirst: false, status: 500, failures: 1 },
  { method: 'POST', name: 'déconnexion annulée avant réponse puis autre succès', path: '/api/v1/auth/logout/', error: 'aborted', replace: true, nextSequence: false, successFirst: false, status: 204, failures: 1 },
]) {
  test(`observateur réseau: ${scenario.name}`, async ({ page }) => {
    await page.route('**/api/v1/auth/session/', (route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ authenticated: false }),
    }));
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Connexion opérateur' })).toBeVisible();
    const evidence = collectRuntimeEvidence(page);
    evidence.beginNotificationRead();
    let requestCount = 0;
    await page.route(`**${scenario.path}`, async (route) => {
      requestCount += 1;
      if (requestCount === (scenario.successFirst ? 2 : 1)) {
        await route.abort(scenario.error);
      } else {
        await route.fulfill({ status: scenario.status, contentType: 'application/json', body: '[]' });
      }
    });
    const fetchRead = () => page.evaluate(async (path) => {
      try { await (await fetch(path.url, { method: path.method })).text(); } catch { /* Intentional harness transport failure. */ }
    }, { url: scenario.path, method: scenario.method });
    await fetchRead();
    if (scenario.replace) {
      if (scenario.nextSequence) evidence.beginNotificationRead();
      await fetchRead();
    }
    await expect.poll(() => evidence.failedApi.length).toBe(scenario.failures);
  });
}
