import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TitanPage from './TitanPage';
import HahitantsoaPage from './HahitantsoaPage';
import CustomersPage from './CustomersPage';
import PlanningPage from './PlanningPage';
import CustomerDetailPage from './CustomerDetailPage';
import ReservationDetailPage from './ReservationDetailPage';

describe('6F-R9 stabilization', () => {
  it('TitanPage - location numbers and client names are clickable', () => {
    const mockNavigate = vi.fn();
    render(<TitanPage onNavigate={mockNavigate} />);

    fireEvent.click(screen.getByRole('button', { name: /LOC-2026-0088/i }));
    expect(mockNavigate).toHaveBeenCalledWith('reservation-detail', 'LOC-2026-0088');

    mockNavigate.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /Société Construct\+/i }));
    expect(mockNavigate).toHaveBeenCalledWith('customer', 'CUST-003');

    mockNavigate.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /LOC-2026-0089/i }));
    expect(mockNavigate).toHaveBeenCalledWith('reservation-detail', 'LOC-2026-0089');

    mockNavigate.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /Ando R\./i }));
    expect(mockNavigate).toHaveBeenCalledWith('customer', 'CUST-001');
  });

  it('HahitantsoaPage - reservation numbers and client names are clickable', () => {
    const mockNavigate = vi.fn();
    render(<HahitantsoaPage onNavigate={mockNavigate} />);

    fireEvent.click(screen.getByRole('button', { name: /RES-2026-0142/i }));
    expect(mockNavigate).toHaveBeenCalledWith('reservation-detail', 'RES-2026-0142');

    mockNavigate.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /Ando R\./i }));
    expect(mockNavigate).toHaveBeenCalledWith('customer', 'CUST-001');
  });

  it('CustomersPage - client name and last dossier open correct routes, no Voir fiche column', () => {
    const mockNavigate = vi.fn();
    render(<CustomersPage onNavigate={mockNavigate} />);

    expect(screen.queryAllByRole('button', { name: /Voir fiche/i }).length).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: /Ando Rakoto/i }));
    expect(mockNavigate).toHaveBeenCalledWith('customer', 'CUST-001');

    mockNavigate.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /LOC-2026-0089/i }));
    expect(mockNavigate).toHaveBeenCalledWith('reservation-detail', 'LOC-2026-0089');
  });

  it('CustomerDetailPage - back button returns to customers, dossier ID navigates, edition works', () => {
    const mockNavigate = vi.fn();
    render(<CustomerDetailPage onNavigate={mockNavigate} param="CUST-001" />);

    fireEvent.click(screen.getByRole('button', { name: /Retour/i }));
    expect(mockNavigate).toHaveBeenCalledWith('customers');

    mockNavigate.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /RES-2026-0142/i }));
    expect(mockNavigate).toHaveBeenCalledWith('reservation-detail', 'RES-2026-0142');

    fireEvent.click(screen.getByRole('button', { name: /Modifier/i }));
    expect(screen.getByDisplayValue('ando.rakoto@email.mg')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Enregistrer \(local\)/i }));
    expect(screen.getByText(/Modifications enregistrées en local/i)).toBeInTheDocument();
  });

  it('CustomerDetailPage - enterprise client shows company fields', () => {
    render(<CustomerDetailPage onNavigate={vi.fn()} param="CUST-002" />);

    expect(screen.getAllByText(/Rasoa Nomena/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Entreprise/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole('button', { name: /Modifier/i })[0]);
    expect(screen.getByDisplayValue('rasoa.nomena@entreprise.mg')).toBeInTheDocument();
  });

  it('PlanningPage - event clicks navigate to reservation detail', () => {
    const mockNavigate = vi.fn();
    render(<PlanningPage onNavigate={mockNavigate} />);

    fireEvent.click(screen.getByRole('button', { name: /Visite Domaine Ambohimanga/i }));
    expect(mockNavigate).toHaveBeenCalledWith('reservation-detail', 'RES-2026-0142');

    mockNavigate.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /Installation mobilier Titan/i }));
    expect(mockNavigate).toHaveBeenCalledWith('reservation-detail', 'LOC-2026-0089');
  });

  it('ReservationDetailPage - renders all reservation IDs without crash', () => {
    const { rerender } = render(<ReservationDetailPage onNavigate={() => {}} param="LOC-2026-0088" />);
    expect(screen.getByText(/Réservation LOC-2026-0088/i)).toBeInTheDocument();

    rerender(<ReservationDetailPage onNavigate={() => {}} param="LOC-2026-0089" />);
    expect(screen.getByText(/Réservation LOC-2026-0089/i)).toBeInTheDocument();

    rerender(<ReservationDetailPage onNavigate={() => {}} param="RES-2026-0142" />);
    expect(screen.getByText(/Réservation RES-2026-0142/i)).toBeInTheDocument();
  });
});

// Keep 6F-R8 focused tests for non-regression of navigation patterns
describe('6F-R8 navigation affordances regression', () => {
  it('TitanPage - location numbers and client names are clickable', () => {
    const mockNavigate = vi.fn();
    render(<TitanPage onNavigate={mockNavigate} />);
    fireEvent.click(screen.getByRole('button', { name: /LOC-2026-0088/i }));
    expect(mockNavigate).toHaveBeenCalledWith('reservation-detail', 'LOC-2026-0088');
  });
});
