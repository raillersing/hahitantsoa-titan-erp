import { expect, test, type Page } from "@playwright/test";

const ORIGIN = "http://127.0.0.1:5173";
const SESSION_PATH = "/api/v1/auth/session/";

type RoleFixture = {
  label: string;
  roles: string[];
  is_staff: boolean;
  canManageIdentity: boolean;
  canViewAudit: boolean;
  canSensitiveWrite: boolean;
};

const roleFixtures: RoleFixture[] = [
  {
    label: "aucun rôle",
    roles: [],
    is_staff: false,
    canManageIdentity: false,
    canViewAudit: false,
    canSensitiveWrite: false,
  },
  {
    label: "rôle inconnu",
    roles: ["unknown_role"],
    is_staff: false,
    canManageIdentity: false,
    canViewAudit: false,
    canSensitiveWrite: false,
  },
  {
    label: "identity_admin",
    roles: ["identity_admin"],
    is_staff: false,
    canManageIdentity: true,
    canViewAudit: false,
    canSensitiveWrite: false,
  },
  {
    label: "reservation_sensitive_operator",
    roles: ["reservation_sensitive_operator"],
    is_staff: false,
    canManageIdentity: false,
    canViewAudit: true,
    canSensitiveWrite: true,
  },
  {
    label: "staff",
    roles: [],
    is_staff: true,
    canManageIdentity: true,
    canViewAudit: true,
    canSensitiveWrite: true,
  },
];

function sessionResponse(role: RoleFixture) {
  return {
    authenticated: true,
    user: {
      id: `phase1f-${role.label.replaceAll(" ", "-")}`,
      username: `phase1f-${role.label.replaceAll(" ", "-")}`,
      display_name: `Phase 1F ${role.label}`,
      is_staff: role.is_staff,
      roles: role.roles,
    },
  };
}

async function installSessionFixture(page: Page, role: RoleFixture) {
  await page.route(`**${SESSION_PATH}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(sessionResponse(role)),
    });
  });
}

function collectRuntimeEvidence(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  const externalRequests: string[] = [];
  const unexpectedApiRequests: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    failedRequests.push(`${request.url()}: ${request.failure()?.errorText ?? "unknown"}`);
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.origin !== ORIGIN && ["http:", "https:"].includes(url.protocol)) {
      externalRequests.push(request.url());
    }
    if (url.origin === ORIGIN && url.pathname.startsWith("/api/") && url.pathname !== SESSION_PATH) {
      unexpectedApiRequests.push(`${request.method()} ${url.pathname}`);
    }
  });

  return { consoleErrors, pageErrors, failedRequests, externalRequests, unexpectedApiRequests };
}

async function expectRuntimeClean(evidence: ReturnType<typeof collectRuntimeEvidence>) {
  expect(evidence.consoleErrors, "console errors").toEqual([]);
  expect(evidence.pageErrors, "page errors").toEqual([]);
  expect(evidence.failedRequests, "failed requests").toEqual([]);
  expect(evidence.externalRequests, "unexpected external requests").toEqual([]);
  expect(evidence.unexpectedApiRequests, "unexpected API requests in fixture test").toEqual([]);
}

async function expectCapabilitiesOnProfile(page: Page, role: RoleFixture) {
  await expect(page.getByRole("heading", { name: "Profil utilisateur", level: 1 })).toBeVisible();

  // Font Awesome glyphs are part of the accessible link/button name in the
  // current shell, so use the stable human label as a substring.
  const administration = page.getByRole("link", { name: /Administration/ });
  const audit = page.getByRole("link", { name: /Audit & Sécurité/ });
  const newReservation = page.getByRole("button", { name: /Nouvelle réservation/ });

  await expect(administration).toHaveCount(role.canManageIdentity ? 1 : 0);
  await expect(audit).toHaveCount(role.canViewAudit ? 1 : 0);
  await expect(newReservation).toHaveCount(role.canSensitiveWrite ? 1 : 0);
}

test.describe("Phase 1F — acceptance multi-rôles et hygiène runtime", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  for (const role of roleFixtures) {
    test(`${role.label}: capacités visibles et deep-links refusés selon la session`, async ({ page }) => {
      const evidence = collectRuntimeEvidence(page);
      await installSessionFixture(page, role);
      await page.goto("/#profile", { waitUntil: "domcontentloaded" });
      await expectCapabilitiesOnProfile(page, role);

      if (!role.canManageIdentity) {
        await page.goto("/#admin", { waitUntil: "domcontentloaded" });
        await expect(page.getByRole("alert")).toContainText("Accès non autorisé");
      }
      if (!role.canViewAudit) {
        await page.goto("/#audit", { waitUntil: "domcontentloaded" });
        await expect(page.getByRole("alert")).toContainText("Accès non autorisé");
      }
      if (!role.canSensitiveWrite) {
        await page.goto("/#reservation-new", { waitUntil: "domcontentloaded" });
        await expect(page.getByRole("alert")).toContainText("Accès non autorisé");
      }

      await expectRuntimeClean(evidence);
    });
  }

  test("préserve le viewport mobile et le viewport desktop sans débordement global", async ({ page }) => {
    const evidence = collectRuntimeEvidence(page);
    await installSessionFixture(page, roleFixtures[4]);

    for (const viewport of [
      { width: 320, height: 568 },
      { width: 375, height: 667 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/#profile", { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Profil utilisateur", level: 1 })).toBeVisible();
      const widths = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(widths.scrollWidth, `scrollWidth at ${viewport.width}px`).toBeLessThanOrEqual(widths.clientWidth);
    }

    await expectRuntimeClean(evidence);
  });
});
