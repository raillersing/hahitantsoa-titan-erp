import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
  });
});

test('Take screenshots', async ({ page }) => {
  await page.goto('/#documents');
  
  // 1. Liste principale
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/1-liste-principale.png', fullPage: true });

  // 2. Nouvel onglet 1
  await page.getByRole('button', { name: /Nouveau modèle/i }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/2-informations-generales.png', fullPage: true });

  // 3. Nouvel onglet 2
  await page.getByRole('tab', { name: '2. Contenu' }).click();
  await page.getByRole('button', { name: '+ Paragraphe' }).click();
  await page.getByRole('button', { name: '+ Titre' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/3-contenu.png', fullPage: true });

  // 4. Nouvel onglet 3
  await page.getByRole('tab', { name: '3. Variables' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/4-variables.png', fullPage: true });

  // 5. Nouvel onglet 4
  await page.getByRole('tab', { name: '4. Importer' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/5-importer.png', fullPage: true });

  // 6. Nouvel onglet 5
  await page.getByRole('tab', { name: '5. Prévisualisation' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/5-previsualisation.png', fullPage: true });

  // 6. Nouvel onglet 6
  await page.getByRole('tab', { name: '6. Versions' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/6-versions.png', fullPage: true });

  // 7. Vue édition existant
  await page.reload();
  await page.waitForTimeout(1000);
  await page.getByText('Contrat Location Titan Standard').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/7-edition-existant.png', fullPage: true });

  // 8. Modal de suppression sur un modèle non actif
  await page.getByRole('button', { name: 'Documents & Modèles' }).click();
  await page.getByRole('button', { name: /Nouveau modèle/i }).click();
  await page.getByRole('button', { name: 'Supprimer le modèle' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/8-modal-suppression.png' });

  // 9. Tableau dans Contenu
  await page.reload();
  await page.getByRole('button', { name: /Nouveau modèle/i }).click();
  await page.getByRole('tab', { name: '2. Contenu' }).click();
  await page.getByRole('button', { name: '+ Tableau' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/9-contenu-tableau.png', fullPage: true });

  // 10. Bouton archiver/supprimer dans la liste
  await page.getByRole('button', { name: 'Documents & Modèles' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/10-liste-actions.png', fullPage: true });
});
