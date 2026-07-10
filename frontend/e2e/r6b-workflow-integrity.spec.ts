import { test, expect } from '@playwright/test';

function setupErrorListeners(page) {
  const errors = [];
  page.on('pageerror', err => errors.push(`PageError: ${err.message}`));
  page.on('console', msg => {
    if (msg.type() === 'error' && !msg.text().includes('404')) errors.push(`ConsoleError: ${msg.text()}`);
  });
  page.on('dialog', async dialog => {
    errors.push(`UnexpectedDialog: ${dialog.type()} - ${dialog.message()}`);
    await dialog.dismiss();
  });
  return errors;
}

test('Groupe A - Notifications et feedbacks', async ({ page }) => {
  const errors = setupErrorListeners(page);
  await page.goto('/#reservation-new');
  
  // On trouve le sélecteur Client
  const clientSelect = page.getByLabel(/Client/i).first();
  if (await clientSelect.isVisible()) {
    await clientSelect.click();
  }
  
  // On vérifie l'absence de notification parasite
  await expect(page.locator('.toast')).toHaveCount(0);
  expect(errors).toHaveLength(0);
});

test('Groupe B - Dates et horaires', async ({ page }) => {
  const errors = setupErrorListeners(page);
  await page.goto('/#reservation-new');
  
  const startDateInput = page.getByLabel(/Date de début/i).first();
  const dateInput = page.getByLabel(/Date de fin/i).first();
  
  if (await startDateInput.isVisible() && await dateInput.isVisible()) {
    // Si la logique de min bloque la saisie native, on peut forcer la valeur ou on s'assure que c'est bien géré.
    await startDateInput.fill('2050-01-01');
    await dateInput.fill('2040-01-01');
    
    // Attendu : erreur inline
    await expect(page.getByText(/La date de fin ne peut pas être antérieure/i).first()).toBeVisible();
  }
  expect(errors).toHaveLength(0);
});

test('Groupe C - Recherche Inventaire', async ({ page }) => {
  const errors = setupErrorListeners(page);
  await page.goto('/#inventory-management');
  
  const searchInput = page.getByRole('searchbox', { name: /Rechercher un article/i });
  await expect(searchInput).toBeVisible();

  await searchInput.fill('Chaise');
  await expect(page.locator('table')).toBeVisible();

  await searchInput.clear();
  await searchInput.fill('XYZ-999');
  await expect(page.getByText(/Aucun article/i).first()).toBeVisible();
  
  expect(errors).toHaveLength(0);
});

test('Groupe D - Modification du stock total et Ajuster stock', async ({ page }) => {
  const errors = setupErrorListeners(page);
  await page.goto('/#inventory-item/MAT-01');

  // Test Ajuster stock button and modal
  const adjustButton = page.getByRole('button', { name: /ajuster stock/i });
  await expect(adjustButton).toBeVisible();
  await expect(adjustButton).toBeEnabled();
  await adjustButton.click();

  const adjustDialog = page.getByRole('dialog', { name: /ajuster le stock/i });
  await expect(adjustDialog).toBeVisible();
  
  // Find "Nouveau Stock Total" and verify value
  const newTotalInput = page.getByLabel(/nouveau stock total/i);
  await expect(newTotalInput).toBeVisible();
  
  await page.getByRole('button', { name: /annuler/i }).click();
  await expect(adjustDialog).not.toBeVisible();

  // Test Normalisation 0200
  const modifyBtn = page.getByRole('button', { name: /modifier l'article/i }).first();
  await modifyBtn.click();
  
  const modifyDialog = page.getByRole('dialog');
  await expect(modifyDialog).toBeVisible();

  const stockInput = page.getByLabel(/Stock Total/i).first();
  await expect(stockInput).toBeVisible();
  await expect(stockInput).toBeEditable();
  
  await stockInput.fill('0200');
  
  // Trigger blur
  await stockInput.blur();
  await expect(stockInput).toHaveValue('200');
  
  // Fill with a different value to trigger Motif select
  await stockInput.fill('0050');
  await stockInput.blur();
  await expect(stockInput).toHaveValue('50');
  
  // Validate that we need a motif
  await page.getByRole('button', { name: /enregistrer/i }).click();
  await expect(page.getByText(/Motif de la modification/i)).toBeVisible();
  
  const motifSelect = page.locator('select').last();
  await motifSelect.selectOption({ label: 'Correction de saisie' });
  
  await page.getByRole('button', { name: /enregistrer/i }).click();
  
  // Succès
  await expect(page.getByText(/Article modifié avec succès/i)).toBeVisible();
  
  expect(errors).toHaveLength(0);
});

test('Groupe E - Switch Pack actif/inactif', async ({ page }) => {
  const errors = setupErrorListeners(page);
  await page.goto('/#packages');

  const switchBtn = page.locator('button').filter({ hasText: '' }).locator('.bg-emerald-500').first().or(page.locator('.bg-slate-300').first());
  if (await switchBtn.isVisible()) {
    await switchBtn.click();
    await expect(page.getByText(/Inactif|Actif/i).first()).toBeVisible();
  }
  
  expect(errors).toHaveLength(0);
});
