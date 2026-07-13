import { test, expect } from '@playwright/test';

async function firstTemplateEntry(page: import('@playwright/test').Page) {
  const mobileEntry = page.getByRole('button', { name: /^Ouvrir le modèle / }).first();
  if (await mobileEntry.isVisible()) return mobileEntry;
  return page.locator('tbody tr').first();
}

async function expectCompleteMobileCard(page: import('@playwright/test').Page) {
  const card = page.locator('[data-template-card]').first();
  await expect(card).toContainText('Avenant Hahitantsoa Standard');
  await expect(card).toContainText('HAH-AVENANT');
  await expect(card).toContainText('Hahitantsoa');
  await expect(card).toContainText('Avenant');
  await expect(card).toContainText('v1.0');
  await expect(card).toContainText('11/07/2026');
  await expect(card).toContainText('Actif');
  await expect(card).toContainText('Actions');
  await expect(card.getByTitle('Dupliquer le modèle')).toBeVisible();
  await expect(card.getByTitle('Supprimer le modèle')).toBeVisible();
}

test.describe('Responsive and Search Hotfix R6', () => {
  let errors: string[] = [];
  let externalRequests: string[] = [];
  let failedRequests: string[] = [];

  test.beforeEach(async ({ page }) => {
    errors = [];
    externalRequests = [];
    failedRequests = [];
    page.on('pageerror', err => errors.push(`Page error: ${err.message}`));
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(`Console error: ${msg.text()}`);
      }
    });
    page.on('request', request => {
      const requestUrl = new URL(request.url());
      if (requestUrl.protocol.startsWith('http') && requestUrl.origin !== 'http://127.0.0.1:5173') {
        externalRequests.push(request.url());
      }
    });
    page.on('requestfailed', request => {
      failedRequests.push(`${request.url()}: ${request.failure()?.errorText || 'échec inconnu'}`);
    });

    await page.goto('http://127.0.0.1:5173/#documents', { waitUntil: 'domcontentloaded' });
  });

  test('loads UI assets locally without network or console errors', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    const interLoaded = await page.evaluate(async () => {
      await document.fonts.ready;
      return document.fonts.check('400 16px "Inter Variable"');
    });

    expect(interLoaded).toBe(true);
    expect(externalRequests).toEqual([]);
    expect(failedRequests).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('Search input should have single clear button and be functional', async ({ page }) => {
    const searchInput = page.getByRole('searchbox', { name: 'Rechercher un modèle' });
    await expect(searchInput).toBeVisible();

    const clearButton = page.getByRole('button', { name: 'Effacer la recherche' });
    await expect(clearButton).not.toBeVisible();

    await searchInput.fill('Contrat');
    await expect(clearButton).toBeVisible();

    // Verify it doesn't have the webkit native search cancel button visually (hard to test natively but we check the type is text)
    await expect(searchInput).toHaveAttribute('type', 'text');

    await clearButton.click();
    await expect(searchInput).toHaveValue('');
    await expect(searchInput).toBeFocused();
    await expect(clearButton).not.toBeVisible();

    expect(errors).toHaveLength(0);
  });

  test('Layout and accessibility at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });

    // Check main list actions
    await expectCompleteMobileCard(page);
    const firstRow = await firstTemplateEntry(page);
    await firstRow.focus();
    await expect(firstRow).toBeFocused();
    const duplicateBtn = firstRow.getByTitle(/Dupliquer/);
    const visibleDuplicateBtn = (await duplicateBtn.isVisible())
      ? duplicateBtn
      : page.locator('button:visible[title="Dupliquer le modèle"]').first();
    await expect(visibleDuplicateBtn).toBeVisible();
    await visibleDuplicateBtn.scrollIntoViewIfNeeded();
    await expect(visibleDuplicateBtn).toBeInViewport();

    // Open editor
    await firstRow.click();

    // Check header actions
    const saveBtn = page.getByRole('button', { name: 'Enregistrer' });
    await expect(saveBtn).toBeVisible();
    await saveBtn.scrollIntoViewIfNeeded();
    await expect(saveBtn).toBeInViewport();

    const backBtn = page.getByRole('button', { name: /Documents & Modèles/ });
    await expect(backBtn).toBeVisible();

    // Check all 6 tabs are present and accessible (might require horizontal scrolling but exist in DOM and are visible)
    const tabs = ['1. Informations générales', '2. Contenu', '3. Variables', '4. Importer', '5. Prévisualisation', '6. Versions'];
    const isCompactNavigation = page.viewportSize()?.width && page.viewportSize()!.width < 1280;
    if (isCompactNavigation) {
      const selectBox = page.getByRole('combobox', { name: 'Section du modèle' });
      await expect(selectBox).toBeVisible();
      // On mobile, the options are part of the select, we don't need to check each tab role, just that the select exists
      // If we want to check options, we can check the text content of the select
      for (const tab of tabs) {
        await expect(page.locator('option').filter({ hasText: tab })).toHaveCount(1);
      }
    } else {
      for (const tab of tabs) {
        const tabBtn = page.getByRole('tab', { name: tab });
        await expect(tabBtn).toBeVisible();
      }
    }

    // Check absence of global horizontal scroll
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);

    expect(errors).toHaveLength(0);
  });

  test('Layout and accessibility at 375px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });

    await expectCompleteMobileCard(page);
    const firstRow = await firstTemplateEntry(page);
    await firstRow.click();

    // Switch to Contenu
    if (page.viewportSize()?.width && page.viewportSize()!.width < 1280) {
      await page.getByRole('combobox', { name: 'Section du modèle' }).selectOption('2. Contenu');
    } else {
      await page.getByRole('tab', { name: '2. Contenu' }).click();
    }

    const paragraphBtn = page.getByRole('button', { name: '+ Paragraphe' });
    const titleBtn = page.getByRole('button', { name: '+ Titre' });
    await expect(paragraphBtn).toBeVisible();
    await paragraphBtn.scrollIntoViewIfNeeded();
    await expect(paragraphBtn).toBeInViewport();
    await titleBtn.scrollIntoViewIfNeeded();
    await expect(titleBtn).toBeInViewport();

    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);

    expect(errors).toHaveLength(0);
  });

  test('Layout and accessibility at 768px (Editor and Preview stacking)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });

    const firstRow = await firstTemplateEntry(page);
    await firstRow.click();

    if (page.viewportSize()?.width && page.viewportSize()!.width < 1280) {
      await page.getByRole('combobox', { name: 'Section du modèle' }).selectOption('2. Contenu');
    } else {
      await page.getByRole('tab', { name: '2. Contenu' }).click();
    }

    const editorTitle = page.getByRole('heading', { name: 'Éditeur structuré' });
    const previewTitle = page.getByRole('heading', { name: 'Aperçu rendu' });

    await expect(editorTitle).toBeVisible();
    await expect(previewTitle).toBeVisible();

    // Check vertical stacking: editor top should be less than preview top
    const editorBox = await editorTitle.boundingBox();
    const previewBox = await previewTitle.boundingBox();

    expect(editorBox?.y).toBeLessThan(previewBox!.y);

    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);

    expect(errors).toHaveLength(0);
  });

  test('keeps every Documents section within the viewport at required widths', async ({ page }) => {
    const viewports = [
      { width: 320, height: 568 },
      { width: 375, height: 667 },
      { width: 768, height: 1024 },
      { width: 1440, height: 900 },
    ];
    const sections = ['1. Informations générales', '2. Contenu', '3. Variables', '4. Importer', '5. Prévisualisation', '6. Versions'];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto('http://127.0.0.1:5173/#dashboard', { waitUntil: 'domcontentloaded' });
      await page.goto('http://127.0.0.1:5173/#documents', { waitUntil: 'domcontentloaded' });
      await expect.poll(() => page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }))).toEqual({ scrollWidth: viewport.width, clientWidth: viewport.width });
      await (await firstTemplateEntry(page)).click();

      for (const section of sections) {
        if (viewport.width < 1280) {
          await page.getByRole('combobox', { name: 'Section du modèle' }).selectOption({ label: section });
        } else {
          await page.getByRole('tab', { name: section }).click();
        }
        await expect.poll(() => page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }))).toEqual({ scrollWidth: viewport.width, clientWidth: viewport.width });
      }
    }
  });

});
