import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, afterEach, it, expect, vi } from 'vitest';
import ReservationDetailPage from './ReservationDetailPage';
import type { ReservationDraft } from '../types';

const MOCK_DRAFT: ReservationDraft = {
  id: 'draft-test',
  public_reference: 'TEST-REF',
  status: 'draft',
  customer_id: 'CUST-001',
  customer_display_name: 'Test Client',
  start_at: '2026-06-14T09:00:00Z',
  end_at: '2026-06-16T12:00:00Z',
  notes: '',
  contract_signed_at: null,
  contract_signed_by_id: null,
  required_deposit_received_at: null,
  required_deposit_received_by_id: null,
  confirmed_at: null,
  confirmed_by_id: null,
  cancelled_at: null,
  cancelled_by_id: null,
  lines: [],
  created_at: '2026-06-01T10:00:00Z',
  updated_at: '2026-06-01T10:00:00Z',
};

const DRAFTS: Record<string, ReservationDraft> = {
  'LOC-2026-0088': { ...MOCK_DRAFT, id: 'draft-088', public_reference: 'LOC-2026-0088' },
  'LOC-2026-0089': { ...MOCK_DRAFT, id: 'draft-089', public_reference: 'LOC-2026-0089' },
  'RES-2026-0142': { ...MOCK_DRAFT, id: 'draft-142', public_reference: 'RES-2026-0142' },
};

const mockGetReservationDraft = vi.fn();
const mockGetCustomer = vi.fn();

vi.mock('../api', () => ({
  getReservationDraft: (...args: any[]) => mockGetReservationDraft(...args),
  getCustomer: (...args: any[]) => mockGetCustomer(...args),
  getReservationDraftDocumentInstances: vi.fn().mockResolvedValue([]),
  markReservationDraftContractSigned: vi.fn(),
  markReservationDraftRequiredDepositReceived: vi.fn(),
  confirmReservationDraft: vi.fn(),
}));

describe('ReservationDetailPage crash safety', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders LOC-2026-0088 without crash', async () => {
    mockGetReservationDraft.mockResolvedValue(DRAFTS['LOC-2026-0088']);
    mockGetCustomer.mockResolvedValue({ id: 'CUST-001', display_name: 'Test Client', email: '', phone: '', address: '', notes: '', is_active: true, created_at: '', updated_at: '', is_deleted: false, deleted_at: null, created_by: null, updated_by: null });
    render(<ReservationDetailPage onNavigate={() => {}} param="LOC-2026-0088" />);
    await waitFor(() => {
      expect(screen.getByText(/Réservation LOC-2026-0088/i)).toBeInTheDocument();
    });
  });

  it('renders LOC-2026-0089 without crash', async () => {
    mockGetReservationDraft.mockResolvedValue(DRAFTS['LOC-2026-0089']);
    mockGetCustomer.mockResolvedValue({ id: 'CUST-001', display_name: 'Test Client', email: '', phone: '', address: '', notes: '', is_active: true, created_at: '', updated_at: '', is_deleted: false, deleted_at: null, created_by: null, updated_by: null });
    render(<ReservationDetailPage onNavigate={() => {}} param="LOC-2026-0089" />);
    await waitFor(() => {
      expect(screen.getByText(/Réservation LOC-2026-0089/i)).toBeInTheDocument();
    });
  });

  it('renders RES-2026-0142 without crash', async () => {
    mockGetReservationDraft.mockResolvedValue(DRAFTS['RES-2026-0142']);
    mockGetCustomer.mockResolvedValue({ id: 'CUST-001', display_name: 'Test Client', email: '', phone: '', address: '', notes: '', is_active: true, created_at: '', updated_at: '', is_deleted: false, deleted_at: null, created_by: null, updated_by: null });
    render(<ReservationDetailPage onNavigate={() => {}} param="RES-2026-0142" />);
    await waitFor(() => {
      expect(screen.getByText(/Réservation RES-2026-0142/i)).toBeInTheDocument();
    });
  });
});
