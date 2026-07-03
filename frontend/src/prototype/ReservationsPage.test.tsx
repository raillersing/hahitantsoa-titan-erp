import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ReservationsPage from './ReservationsPage';

describe('ReservationsPage', () => {
  it('affiche toutes les réservations et locations par défaut', () => {
    render(<ReservationsPage onNavigate={vi.fn()} />);
    expect(screen.getByText('RES-2026-0142')).toBeInTheDocument();
    expect(screen.getByText('LOC-2026-0089')).toBeInTheDocument();
    expect(screen.getByText('LOC-2026-0088')).toBeInTheDocument();
    expect(screen.getAllByText('Hahitantsoa').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Titan').length).toBeGreaterThanOrEqual(2);
  });

  it('filtre par Titan', () => {
    render(<ReservationsPage onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Titan/i }));
    expect(screen.queryByText('RES-2026-0142')).not.toBeInTheDocument();
    expect(screen.getByText('LOC-2026-0089')).toBeInTheDocument();
    expect(screen.getByText('LOC-2026-0088')).toBeInTheDocument();
  });

  it('filtre par Hahitantsoa', () => {
    render(<ReservationsPage onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Hahitantsoa/i }));
    expect(screen.getByText('RES-2026-0142')).toBeInTheDocument();
    expect(screen.queryByText('LOC-2026-0089')).not.toBeInTheDocument();
    expect(screen.queryByText('LOC-2026-0088')).not.toBeInTheDocument();
  });

  it('recherche par ID LOC-2026-0089', () => {
    render(<ReservationsPage onNavigate={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/Rechercher par ID/i), { target: { value: 'LOC-2026-0089' } });
    expect(screen.queryByText('RES-2026-0142')).not.toBeInTheDocument();
    expect(screen.getByText('LOC-2026-0089')).toBeInTheDocument();
  });

  it('recherche par ID RES-2026-0142', () => {
    render(<ReservationsPage onNavigate={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/Rechercher par ID/i), { target: { value: 'RES-2026-0142' } });
    expect(screen.getByText('RES-2026-0142')).toBeInTheDocument();
    expect(screen.queryByText('LOC-2026-0089')).not.toBeInTheDocument();
  });

  it('clic ID ouvre le bon détail', () => {
    const mockNavigate = vi.fn();
    render(<ReservationsPage onNavigate={mockNavigate} />);
    fireEvent.click(screen.getByRole('button', { name: /LOC-2026-0089/i }));
    expect(mockNavigate).toHaveBeenCalledWith('reservation-detail', 'LOC-2026-0089');
  });

  it('clic client ouvre la fiche client', () => {
    const mockNavigate = vi.fn();
    render(<ReservationsPage onNavigate={mockNavigate} />);
    const clientButtons = screen.getAllByRole('button', { name: /Ando Rakoto/i });
    fireEvent.click(clientButtons[0]);
    expect(mockNavigate).toHaveBeenCalledWith('customer', 'CUST-001');
  });

  it('affichage fallback quand aucun résultat', () => {
    render(<ReservationsPage onNavigate={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/Rechercher par ID/i), { target: { value: 'INEXISTANT' } });
    expect(screen.getByText(/Aucune réservation ne correspond à votre recherche/i)).toBeInTheDocument();
  });
});
