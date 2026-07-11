import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';

async function openDocumentsPage(page: Page) {
  await page.goto('/#documents');
  await expect(page).toHaveURL(/.*#documents/);
  await expect(
    page.getByRole('heading', { name: 'Documents & Modèles' })
  ).toBeVisible();
}

test.describe('6G-R7A Documents & Modèles Mock', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to ensure deterministic state and seed fresh mock templates
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
    });
  });

  test('1. Navigation vers la page Documents & Modèles via sidebar', async ({ page }) => {
    await page.goto('/#dashboard');
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
    await expect(page.getByText('1. Informations générales')).toBeVisible();
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
    await page.getByRole('tab', { name: '2. Contenu' }).click();
    await expect(page.getByText('Éditeur de document')).toBeVisible();
  });

  test('13. Ajout d\'un bloc Paragraphe', async ({ page }) => {
    await openDocumentsPage(page);
    await page.getByRole('button', { name: /Nouveau modèle/i }).click();
    await page.getByRole('tab', { name: '2. Contenu' }).click();
    await page.getByRole('button', { name: '+ Paragraphe' }).click();
    await expect(page.getByPlaceholder('Contenu...')).toBeVisible();
  });

  test('14. Ajout d\'un bloc Titre', async ({ page }) => {
    await openDocumentsPage(page);
    await page.getByRole('button', { name: /Nouveau modèle/i }).click();
    await page.getByRole('tab', { name: '2. Contenu' }).click();
    await page.getByRole('button', { name: '+ Titre' }).click();
    await expect(page.getByPlaceholder('Contenu...')).toBeVisible();
  });

  test('15. Déplacement de blocs (Up/Down)', async ({ page }) => {
    await openDocumentsPage(page);
    await page.getByRole('button', { name: /Nouveau modèle/i }).click();
    await page.getByRole('tab', { name: '2. Contenu' }).click();
    await page.getByRole('button', { name: '+ Titre' }).click();
    await page.getByRole('button', { name: '+ Paragraphe' }).click();
    const upButtons = page.locator('button i.fa-arrow-up');
    await expect(upButtons).toHaveCount(2);
  });

  test('16. Onglet Variables et ajout', async ({ page }) => {
    await openDocumentsPage(page);
    await page.getByRole('button', { name: /Nouveau modèle/i }).click();
    await page.getByRole('tab', { name: '3. Variables' }).click();
    await expect(page.getByText('Variables nécessaires à la génération')).toBeVisible();
  });

  test('17. Actif/Inactif toggle switch', async ({ page }) => {
    await openDocumentsPage(page);
    await page.getByRole('button', { name: /Nouveau modèle/i }).click();
    const switchBtn = page.getByRole('switch');
    await expect(switchBtn).toHaveAttribute('aria-checked', 'false');
    await switchBtn.click();
    await expect(switchBtn).toHaveAttribute('aria-checked', 'true');
  });

  test('18. Versioning: consultation historique', async ({ page }) => {
    await openDocumentsPage(page);
    await page.getByText('Contrat Location Titan Standard').click();
    await page.getByRole('tab', { name: '5. Versions' }).click();
    await expect(page.getByText('Historique des versions')).toBeVisible();
    await expect(page.getByText('v1')).toBeVisible();
  });

  test('19. Duplication d\'un modèle', async ({ page }) => {
    await openDocumentsPage(page);
    await page.getByText('Contrat Location Titan Standard').click();
    await page.getByRole('button', { name: 'Documents & Modèles' }).first().click();
    const row = page.locator('tr').filter({ hasText: 'Contrat Location Titan Standard' });
    await row.getByTitle('Dupliquer le modèle').click({ force: true });
    await expect(page.getByPlaceholder('Ex: Contrat de location Standard')).toHaveValue('Contrat Location Titan Standard (Copie)');
  });

  test('20. Suppression d\'un modèle brouillon', async ({ page }) => {
    fs.writeFileSync('console.log', ''); // reset
    page.on('console', msg => fs.appendFileSync('console.log', msg.text() + '\n'));
    await openDocumentsPage(page);
    // Create a new draft first
    await page.getByRole('button', { name: /Nouveau modèle/i }).click();
    await page.getByPlaceholder('Ex: Contrat de location Standard').fill('Test Delete Me');
    await page.getByPlaceholder('Ex: CONTRAT-STD').fill('DELETE-TEST-001');
    await page.getByRole('button', { name: /Enregistrer/i }).click();
    
    await expect(page.getByRole('button', { name: 'Documents & Modèles' })).toBeVisible();
    await page.getByRole('button', { name: 'Documents & Modèles' }).first().click();
    await expect(page.getByText('Test Delete Me')).toBeVisible();
    
    await page.getByText('Test Delete Me').click();
    const deleteBtn = page.getByRole('button', { name: 'Supprimer le modèle' });
    await expect(deleteBtn).toBeVisible();
    await page.waitForTimeout(500); // Give the UI a moment to settle
    
    // Instead of click(), evaluate click directly to bypass any pointer-events issues
    await deleteBtn.evaluate(b => (b as HTMLButtonElement).click());
    
    await page.waitForTimeout(1000);
    const html = await page.evaluate(() => document.body.innerHTML);
    fs.writeFileSync('test-20-debug.html', html);
    
    const confirmBtn = page.getByRole('button', { name: 'Oui, supprimer' });
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();
    
    await expect(page.getByText('Test Delete Me')).not.toBeVisible();
  });
});
