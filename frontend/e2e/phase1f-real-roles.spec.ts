import { expect, test, type Page } from '@playwright/test';

// These are local-only fixture credentials documented by the tester guide and
// the Phase 1B fixture. They are intentionally overridable for another local
// fixture, but never read from .env or committed secrets.
const users = [
  {
    label: 'administrateur local',
    username: process.env.PHASE1F_ADMIN_USERNAME ?? 'admin',
    password: process.env.PHASE1F_ADMIN_PASSWORD ?? 'admin',
    isStaff: true,
    auditStatus: 200,
  },
  {
    label: 'opérateur standard',
    username: process.env.PHASE1F_OPERATOR_USERNAME ?? 'phase1b-e2e',
    password: process.env.PHASE1F_OPERATOR_PASSWORD ?? 'Test-only-Phase1B!',
    isStaff: false,
    auditStatus: 403,
  },
] as const;

async function login(page: Page, username: string, password: string) {
  await page.goto('/#profile');
  await expect(page.getByRole('heading', { name: 'Connexion opérateur' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Nom d’utilisateur' }).fill(username);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('heading', { name: 'Profil utilisateur', level: 1 })).toBeVisible();
}

test.describe('Phase 1F-D — permissions réelles multi-utilisateurs', () => {
  test('les comptes fixture produisent des sessions et une autorisation audit distinctes', async ({ page }) => {
    for (const user of users) {
      await login(page, user.username, user.password);

      const session = await page.request.get('/api/v1/auth/session/');
      expect(session.ok(), `${user.label}: session HTTP`).toBeTruthy();
      const sessionBody = await session.json();
      expect(sessionBody).toMatchObject({
        authenticated: true,
        user: { username: user.username, is_staff: user.isStaff },
      });

      const audit = await page.request.get('/api/v1/audit/events/');
      expect(audit.status(), `${user.label}: audit permission`).toBe(user.auditStatus);

      await page.getByRole('button', { name: 'Menu utilisateur' }).click();
      await page.getByRole('button', { name: 'Déconnexion' }).click();
      await expect(page.getByRole('heading', { name: 'Connexion opérateur' })).toBeVisible();
    }
  });
});
