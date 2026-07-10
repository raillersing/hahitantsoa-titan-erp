import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import InventoryPage from './InventoryPage';
import InventoryItemPage from './InventoryItemPage';
import StockMovementsPage from './StockMovementsPage';
import StockPreparationPage from './StockPreparationPage';
import LogisticsDispatchPage from './LogisticsDispatchPage';
import LogisticsReturnsPage from './LogisticsReturnsPage';
import BreakageLossPage from './BreakageLossPage';
import InventoryManagementPage from './InventoryManagementPage';

describe('Stock & Logistics Pages', () => {
  const mockNavigate = vi.fn();

  it('InventoryManagementPage - renders KPIs and articles', () => {
    render(<InventoryManagementPage onNavigate={mockNavigate} />);
    expect(screen.getAllByText('Total').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Dispo').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Réservé').length).toBeGreaterThan(0);
    
    // Check article
    expect(screen.getByText('Chaise Napoléon transparente')).toBeDefined();
    
    // Click article
    fireEvent.click(screen.getByText('Chaise Napoléon transparente'));
    expect(mockNavigate).toHaveBeenCalledWith('inventory-item', 'MAT-01');
  });

  it('InventoryPage (Catalogue) - renders grid of location articles', () => {
    render(<InventoryPage onNavigate={mockNavigate} />);
    expect(screen.getByText('Catalogue')).toBeInTheDocument();
    expect(screen.getByText('Chaise Napoléon transparente')).toBeInTheDocument();
    // It should not render table headers like "Total" or "Dispo" as pure text blocks (it has Stock and Location)
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('InventoryItemPage - renders stock info and history', () => {
    render(<InventoryItemPage onNavigate={mockNavigate} param="MAT-01" />);
    expect(screen.getByText('Chaise Napoléon transparente')).toBeDefined();
    expect(screen.getAllByText('Stock Total').length).toBeGreaterThan(0);
    expect(screen.getByText('Historique des mouvements')).toBeDefined();
    
    // Test Ajuster stock modal
    fireEvent.click(screen.getByRole('button', { name: /ajuster stock/i }));
    const adjustDialog = screen.getByRole('dialog');
    expect(adjustDialog).toBeInTheDocument();
    
    // Find nouveau stock total which should contain 200 (initial stock for MAT-01)
    const newTotalInput = screen.getByLabelText(/nouveau stock total/i);
    expect((newTotalInput as HTMLInputElement).value).toBe("200");
    
    // Cancel the modal
    fireEvent.click(screen.getByRole('button', { name: /annuler/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    
    // Test Modifier l'article normalization
    fireEvent.click(screen.getByRole('button', { name: /modifier l'article/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    
    // It should have stock-total-edit
    const stockTotalEdit = screen.getByLabelText('Stock Total');
    
    // Clear and enter 0200
    fireEvent.change(stockTotalEdit, { target: { value: '' } });
    expect((stockTotalEdit as HTMLInputElement).value).toBe('');
    
    fireEvent.change(stockTotalEdit, { target: { value: '0200' } });
    expect((stockTotalEdit as HTMLInputElement).value).toBe('0200');
    
    // Blur to trigger normalization
    fireEvent.blur(stockTotalEdit);
    expect((stockTotalEdit as HTMLInputElement).value).toBe('200');
    
    // Also test "00" -> "0"
    fireEvent.change(stockTotalEdit, { target: { value: '00' } });
    fireEvent.blur(stockTotalEdit);
    expect((stockTotalEdit as HTMLInputElement).value).toBe('0');
    
    // Also test "00050" -> "50"
    fireEvent.change(stockTotalEdit, { target: { value: '00050' } });
    fireEvent.blur(stockTotalEdit);
    expect((stockTotalEdit as HTMLInputElement).value).toBe('50');

    // Add reason and save
    const reasonSelect = screen.getByLabelText(/motif de la modification/i);
    fireEvent.change(reasonSelect, { target: { value: 'Correction de saisie' } });
    fireEvent.click(screen.getByRole('button', { name: /enregistrer/i }));
    
    // Check that modal closes
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /retour à l'inventaire/i }));
    expect(mockNavigate).toHaveBeenCalledWith('inventory-management');
  });

  it('StockMovementsPage - renders movements with types', () => {
    render(<StockMovementsPage onNavigate={mockNavigate} />);
    expect(screen.getByText('Nouveau Mouvement')).toBeDefined();
    // Assuming mock data has 'Sortie'
    expect(screen.getAllByText('Sortie').length).toBeGreaterThan(0);
  });

  it('StockPreparationPage - renders dossiers to prepare', () => {
    render(<StockPreparationPage onNavigate={mockNavigate} />);
    expect(screen.getByText('LOC-2026-0089')).toBeDefined(); // dossier from mock
  });

  it('LogisticsDispatchPage - renders modes', () => {
    render(<LogisticsDispatchPage onNavigate={mockNavigate} />);
    expect(screen.getByText('LOC-2026-0087')).toBeDefined();
    expect(screen.getAllByText(/Livraison Titan/i).length).toBeGreaterThan(0);
  });

  it('LogisticsReturnsPage - renders returns', () => {
    render(<LogisticsReturnsPage onNavigate={mockNavigate} />);
    expect(screen.getByText('LOC-2026-0087')).toBeDefined();
    expect(screen.getAllByText(/Pénalité retard applicable/i).length).toBeGreaterThan(0);
  });

  it('BreakageLossPage - renders breakage and caution', () => {
    render(<BreakageLossPage onNavigate={mockNavigate} />);
    expect(screen.getByText('LOC-2026-0087')).toBeDefined();
    expect(screen.getByText('Caution Disponible')).toBeDefined();
    expect(screen.getByText('Différence à payer')).toBeDefined();
  });
});
