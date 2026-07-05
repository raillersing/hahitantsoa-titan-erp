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
    expect(screen.getByText('Stock Total')).toBeDefined();
    expect(screen.getByText('Historique des mouvements')).toBeDefined();
    
    fireEvent.click(screen.getByText('Retour à l\'inventaire'));
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
