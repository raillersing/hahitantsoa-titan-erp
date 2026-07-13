import { test, expect, Page } from '@playwright/test';

async function openDocumentsPage(page: Page) {
  await page.goto('/#documents', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/.*#documents/);
  await expect(
    page.getByRole('heading', { name: 'Documents & Modèles' })
  ).toBeVisible();
}

async function openEditorSection(page: Page, section: string) {
  const compactNavigation = page.getByRole('combobox', { name: 'Section du modèle' });
  if (await compactNavigation.isVisible()) {
    await compactNavigation.selectOption({ label: section });
    return;
  }
  await page.getByRole('tab', { name: section }).click();
}

async function templateEntry(page: Page, name: string) {
  const cardButton = page.getByRole('button', { name: `Ouvrir le modèle ${name}`, exact: true });
  if (await cardButton.isVisible()) return cardButton;
  return page.locator('tr').filter({ hasText: name }).first();
}

async function templateContainer(page: Page, name: string) {
  const card = page.locator('[data-template-card]').filter({ hasText: name }).first();
  if (await card.isVisible()) return card;
  return page.locator('tr').filter({ hasText: name }).first();
}

test.describe('6G-R7A Documents & Modèles Mock', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to ensure deterministic state and seed fresh mock templates
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.clear();
    });
  });

  test('1. Navigation vers la page Documents & Modèles via sidebar', async ({ page }) => {
    await page.goto('/#dashboard', { waitUntil: 'domcontentloaded' });
    const docLink = page.getByRole('link', { name: 'Documents & Modèles' });
    await docLink.click();
    await expect(page).toHaveURL(/.*#documents/);
    await expect(page.getByRole('heading', { name: 'Documents & Modèles' })).toBeVisible();
  });

  test('2. Vérification de la présence des 13 modèles de base', async ({ page }) => {
    await openDocumentsPage(page);
    await page.getByRole('searchbox').fill('');
    await expect(page.locator('tbody tr')).toHaveCount(13);
  });

  test('3. Filtrage par volet (Hahitantsoa)', async ({ page }) => {
    await openDocumentsPage(page);
    await page.getByLabel('Filtrer par volet').selectOption('Hahitantsoa');
    await expect(page.locator('tbody tr')).toHaveCount(7);
  });

  test('4. Filtrage par volet (Titan)', async ({ page }) => {
    await openDocumentsPage(page);
    await page.getByLabel('Filtrer par volet').selectOption('Titan');
    await expect(page.locator('tbody tr')).toHaveCount(6);
  });

  test('5. Filtrage par type (Contrat)', async ({ page }) => {
    await openDocumentsPage(page);
    await page.getByLabel('Filtrer par type').selectOption('Contrat');
    await expect(page.locator('tbody tr')).toHaveCount(2);
  });

  test('6. Filtrage combiné', async ({ page }) => {
    await openDocumentsPage(page);
    await page.getByLabel('Filtrer par volet').selectOption('Titan');
    await page.getByLabel('Filtrer par type').selectOption('Facture');
    await expect(page.locator('tbody tr')).toHaveCount(1);
  });

  test('7. Recherche fonctionnelle', async ({ page }) => {
    await openDocumentsPage(page);
    await page.getByRole('searchbox').fill('TITAN-BL');
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await expect(page.locator('tbody tr').first()).toContainText('TITAN-BL');
  });

  test('8. Bouton d\'effacement de la recherche', async ({ page }) => {
    await openDocumentsPage(page);
    await page.getByRole('searchbox').fill('TestSearch');
    await page.getByLabel('Effacer la recherche').click();
    await expect(page.getByRole('searchbox')).toHaveValue('');
  });

  test('9. Accès au formulaire de création', async ({ page }) => {
    await openDocumentsPage(page);
    await page.getByRole('button', { name: /Nouveau modèle/i }).click();
    const compactNavigation = page.getByRole('combobox', { name: 'Section du modèle' });
    if (await compactNavigation.isVisible()) {
      await expect(compactNavigation).toBeVisible();
    } else {
      await expect(page.getByRole('tab', { name: '1. Informations générales' })).toBeVisible();
    }
  });

  test('9b. Ouverture clavier d’un modèle depuis la liste desktop', async ({ page }) => {
    await openDocumentsPage(page);
    const openButton = page.getByRole('button', { name: 'Ouvrir le modèle Contrat Location Titan Standard' });
    await openButton.focus();
    await expect(openButton).toBeFocused();
    await openButton.press('Enter');
    await expect(page.getByRole('button', { name: 'Documents & Modèles' })).toBeVisible();
  });

  test('10. Remplissage des informations générales', async ({ page }) => {
    await openDocumentsPage(page);
    await page.getByRole('button', { name: /Nouveau modèle/i }).click();
    await page.getByPlaceholder('Ex: Contrat de location Standard').fill('Test E2E Model');
    await page.getByPlaceholder('Ex: CONTRAT-STD').fill('E2E-CODE');
    await expect(page.getByPlaceholder('Ex: Contrat de location Standard')).toHaveValue('Test E2E Model');
  });

  test('11. Validation de l\'unicité du code bloquée', async ({ page }) => {
    await openDocumentsPage(page);
    await page.getByRole('button', { name: /Nouveau modèle/i }).click();
    await page.getByPlaceholder('Ex: Contrat de location Standard').fill('Test Duplicate');
    await page.getByPlaceholder('Ex: CONTRAT-STD').fill('TITAN-BL');
    await page.getByRole('button', { name: /Enregistrer/i }).click();
    await expect(page.getByText('Ce code existe déjà pour un autre modèle.')).toBeVisible();
  });

  test('12. Passage à l\'onglet Contenu', async ({ page }) => {
    await openDocumentsPage(page);
    await page.getByRole('button', { name: /Nouveau modèle/i }).click();
    await openEditorSection(page, '2. Contenu');
    await expect(page.getByText('Éditeur structuré')).toBeVisible();
  });

  test('13. Ajout d\'un bloc Paragraphe', async ({ page }) => {
    await openDocumentsPage(page);
    await page.getByRole('button', { name: /Nouveau modèle/i }).click();
    await openEditorSection(page, '2. Contenu');
    await page.getByRole('button', { name: '+ Paragraphe' }).click();
    await expect(page.getByPlaceholder('Saisissez votre contenu')).toBeVisible();
  });

  test('14. Ajout d\'un bloc Titre', async ({ page }) => {
    await openDocumentsPage(page);
    await page.getByRole('button', { name: /Nouveau modèle/i }).click();
    await openEditorSection(page, '2. Contenu');
    await page.getByRole('button', { name: '+ Titre' }).click();
    await expect(page.getByPlaceholder('Titre de section')).toBeVisible();
  });

  test('15. Déplacement de blocs (Up/Down)', async ({ page }) => {
    await openDocumentsPage(page);
    await page.getByRole('button', { name: /Nouveau modèle/i }).click();
    await openEditorSection(page, '2. Contenu');
    await page.getByRole('button', { name: '+ Titre' }).click();
    await page.getByRole('button', { name: '+ Paragraphe' }).click();
    await page.getByRole('button', { name: '+ Paragraphe' }).click();
    const editors = page.locator('textarea');
    await editors.nth(0).fill('Titre alpha');
    await editors.nth(1).fill('Paragraphe beta');
    await editors.nth(2).fill('Paragraphe gamma');
    await page.getByRole('button', { name: 'Fermer' }).click();

    await page.getByTitle('Monter').nth(1).click();
    await expect(editors.nth(0)).toHaveValue('Paragraphe beta');
    await page.getByTitle('Descendre').nth(0).click();
    await expect(editors.nth(0)).toHaveValue('Titre alpha');

    const blockCards = page.locator('[draggable="true"]');
    await blockCards.nth(0).dragTo(blockCards.nth(1), {
      sourcePosition: { x: 12, y: 12 },
      targetPosition: { x: 12, y: 12 },
    });
    await expect(editors.nth(0)).toHaveValue('Paragraphe beta');
    await expect(editors.nth(1)).toHaveValue('Titre alpha');
    await expect(editors.nth(2)).toHaveValue('Paragraphe gamma');
  });

  test('16. Insertion depuis le bouton Variable de la toolbar', async ({ page }) => {
    await openDocumentsPage(page);
    await page.getByRole('button', { name: /Nouveau modèle/i }).click();
    await openEditorSection(page, '2. Contenu');
    await page.getByRole('button', { name: '+ Variable' }).click();

    const variableButton = page.getByRole('button', { name: 'Nom complet du client', exact: true });
    await expect(variableButton).toBeVisible();
    await variableButton.click();
    await expect(page.locator('textarea').first()).toHaveValue(/\{\{client\.name\}\}/);
  });

  test('17. Onglet Variables et ajout', async ({ page }) => {
    await openDocumentsPage(page);
    await page.getByRole('button', { name: /Nouveau modèle/i }).click();
    await openEditorSection(page, '3. Variables');
    await expect(page.getByText('Dictionnaire de variables')).toBeVisible();
  });

  test('18. Actif/Inactif toggle switch', async ({ page }) => {
    await openDocumentsPage(page);
    await page.getByRole('button', { name: /Nouveau modèle/i }).click();
    const switchBtn = page.getByRole('switch');
    await expect(switchBtn).toHaveAttribute('aria-checked', 'false');
    await switchBtn.click();
    await expect(switchBtn).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByText('Modèle protégé')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Supprimer le modèle' })).not.toBeVisible();
  });

  test('19. Versioning: consultation historique', async ({ page }) => {
    await openDocumentsPage(page);
    await (await templateEntry(page, 'Contrat Location Titan Standard')).click();
    await openEditorSection(page, '6. Versions');
    await expect(page.getByText('Historique des versions')).toBeVisible();
    await expect(page.getByText('v1')).toBeVisible();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exporter JSON' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('titan-contrat.json');
    await expect(page.getByText('Export JSON local/mock téléchargé.')).toBeVisible();
  });

  test('20. Duplication d\'un modèle', async ({ page }) => {
    await openDocumentsPage(page);
    await (await templateEntry(page, 'Contrat Location Titan Standard')).click();
    await page.getByRole('button', { name: 'Documents & Modèles' }).first().click();
    const row = await templateContainer(page, 'Contrat Location Titan Standard');
    await row.getByTitle('Dupliquer le modèle').click({ force: true });
    await expect(page.getByPlaceholder('Ex: Contrat de location Standard')).toHaveValue('Contrat Location Titan Standard (Copie)');
  });

  test('21. Suppression d\'un modèle brouillon', async ({ page }) => {
    await openDocumentsPage(page);
    // Create a new draft first
    await page.getByRole('button', { name: /Nouveau modèle/i }).click();
    await page.getByPlaceholder('Ex: Contrat de location Standard').fill('Test Delete Me');
    await page.getByPlaceholder('Ex: CONTRAT-STD').fill('DELETE-TEST-001');
    await page.getByRole('button', { name: /Enregistrer/i }).click();

    await expect(page.getByRole('button', { name: 'Documents & Modèles' })).toBeVisible();
    await page.getByRole('button', { name: 'Documents & Modèles' }).first().click();
    await (await templateEntry(page, 'Test Delete Me')).click();
    const deleteBtn = page.getByRole('button', { name: 'Supprimer le modèle' });
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    const confirmBtn = page.getByRole('button', { name: 'Oui, supprimer' });
    await expect(page.getByRole('dialog', { name: 'Supprimer définitivement ce modèle ?' })).toBeVisible();
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    await expect(page.getByText('Test Delete Me')).not.toBeVisible();
  });
});
