import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TitanPage from './TitanPage';
import HahitantsoaPage from './HahitantsoaPage';
import CustomersPage from './CustomersPage';
import PlanningPage from './PlanningPage';
import CustomerDetailPage from './CustomerDetailPage';
import ReservationDetailPage from './ReservationDetailPage';
import * as api from '../api';

beforeEach(() => {
  vi.spyOn(api, 'getCustomers').mockResolvedValue([
    { id: 'CUST-001', display_name: 'Ando Rakoto', lifecycle_status: 'client', party_type: 'individual', email: '', phone: '', address: '', notes: '', is_active: true, created_at: '', updated_at: '', is_deleted: false, deleted_at: null, created_by: null, updated_by: null },
  ]);
  vi.spyOn(api, 'getCustomer').mockImplementation(async (id: string) => ({
    id,
    display_name: id === 'CUST-002' ? 'Rasoa Nomena' : 'Ando Rakoto',
    lifecycle_status: 'client', party_type: id === 'CUST-002' ? 'company' : 'individual',
    email: id === 'CUST-002' ? 'rasoa.nomena@entreprise.mg' : 'ando.rakoto@email.mg',
    phone: '', address: '', notes: '', is_active: true, created_at: '', updated_at: '',
    is_deleted: false, deleted_at: null, created_by: null, updated_by: null,
  }));
  vi.spyOn(api, 'getReservationDraft').mockImplementation(async (id: string) => ({
    id: id || 'test-draft', customer_id: 'CUST-001', customer_display_name: 'Test Client',
    status: 'draft', public_reference: id || '',
    start_at: '2026-08-01T10:00:00Z', end_at: '2026-08-02T10:00:00Z', notes: '', lines: [],
    contract_signed_at: null, contract_signed_by_id: null,
    required_deposit_received_at: null, required_deposit_received_by_id: null,
    confirmed_at: null, confirmed_by_id: null, cancelled_at: null, cancelled_by_id: null,
    created_at: '', updated_at: '',
  } as any));
  vi.spyOn(api, 'getReservationDraftDocumentInstances').mockResolvedValue([]);
  vi.spyOn(api, 'markReservationDraftContractSigned').mockResolvedValue({ status: 'draft', public_reference: '', reservation_draft: {} as any, blocked_item_count: 0 } as any);
  vi.spyOn(api, 'markReservationDraftRequiredDepositReceived').mockResolvedValue({ status: 'draft', public_reference: '', reservation_draft: {} as any, blocked_item_count: 0 } as any);
  vi.spyOn(api, 'confirmReservationDraft').mockResolvedValue({ status: 'draft', public_reference: '', reservation_draft: {} as any, blocked_item_count: 0 } as any);
  vi.spyOn(api, 'getSession').mockResolvedValue({ authenticated: true, user: { id: '1', username: 'test', display_name: 'Test', is_staff: true, roles: [] } } as any);
  vi.spyOn(api, 'updateCustomer').mockResolvedValue({
    id: 'CUST-001', display_name: 'Ando Rakoto', lifecycle_status: 'client', party_type: 'individual', email: 'ando.rakoto@email.mg', phone: '', address: '', notes: '', is_active: true, created_at: '', updated_at: '', is_deleted: false, deleted_at: null, created_by: null, updated_by: null,
  });
});

describe('6F-R9 stabilization', () => {
  it('TitanPage - location numbers and client names are clickable', () => {
    const mockNavigate = vi.fn();
    render(<TitanPage onNavigate={mockNavigate} />);

    const titanBrand = screen.getByRole('img', { name: 'Titan Rental' });
    expect(titanBrand).toHaveClass('module-brand');
    expect(titanBrand.querySelector('img')).toHaveAttribute('src', '/assets/titan-rental-logo.png');

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

    const hahitantsoaBrand = screen.getByRole('img', { name: 'Hahitantsoa' });
    expect(hahitantsoaBrand).toHaveClass('module-brand');
    expect(hahitantsoaBrand.querySelector('img')).toHaveAttribute('src', '/assets/hahitantsoa-logo.png');

    fireEvent.click(screen.getByRole('button', { name: /RES-2026-0142/i }));
    expect(mockNavigate).toHaveBeenCalledWith('reservation-detail', 'RES-2026-0142');

    mockNavigate.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /Ando R\./i }));
    expect(mockNavigate).toHaveBeenCalledWith('customer', 'CUST-001');
  });

  it('CustomersPage - client name opens correct route, no mock dossier column', async () => {
    const mockNavigate = vi.fn();
    render(<CustomersPage onNavigate={mockNavigate} />);

    expect(screen.queryAllByRole('button', { name: /Voir fiche/i }).length).toBe(0);

    fireEvent.click(await screen.findByRole('button', { name: /Ando Rakoto/i }));
    expect(mockNavigate).toHaveBeenCalledWith('customer', 'CUST-001');
  });

  it('CustomerDetailPage - back button returns to customers and read-only edition state is explicit', async () => {
    const mockNavigate = vi.fn();
    render(<CustomerDetailPage onNavigate={mockNavigate} param="CUST-001" canSensitiveWrite />);

    expect(await screen.findByText('Fiche client — Ando Rakoto')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Retour/i }));
    expect(mockNavigate).toHaveBeenCalledWith('customers');

    mockNavigate.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /Modifier/i }));
    expect(screen.getByDisplayValue('ando.rakoto@email.mg')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Enregistrer$/i }));
    expect(await screen.findByText(/Modifications enregistrées/i)).toBeInTheDocument();
  });

  it('CustomerDetailPage - enterprise client shows company fields', async () => {
    render(<CustomerDetailPage onNavigate={vi.fn()} param="CUST-002" canSensitiveWrite />);

    expect(await screen.findAllByText(/Rasoa Nomena/i)).not.toHaveLength(0);
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

  it('ReservationDetailPage - renders all reservation IDs without crash', async () => {
    const { rerender } = render(<ReservationDetailPage onNavigate={() => {}} param="LOC-2026-0088" />);
    expect(await screen.findByText(/Réservation LOC-2026-0088/i)).toBeInTheDocument();

    rerender(<ReservationDetailPage onNavigate={() => {}} param="LOC-2026-0089" />);
    expect(await screen.findByText(/Réservation LOC-2026-0089/i)).toBeInTheDocument();

    rerender(<ReservationDetailPage onNavigate={() => {}} param="RES-2026-0142" />);
    expect(await screen.findByText(/Réservation RES-2026-0142/i)).toBeInTheDocument();
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
