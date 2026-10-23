import React from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as api from '../api';
import type { Customer } from '../types';
import CustomersPage from './CustomersPage';

const customer = (changes: Partial<Customer> = {}): Customer => ({
  id: 'summary-client', display_name: 'Client suivi', lifecycle_status: 'client',
  party_type: 'individual', email: '', phone: '', address: '', notes: '',
  is_active: true, created_at: '', updated_at: '', is_deleted: false,
  deleted_at: null, created_by: null, updated_by: null,
  current_dossier_count: 0, closed_dossier_count: 0, draft_dossier_count: 0,
  cancelled_dossier_count: 0, ...changes,
});
const row = (name = 'Client suivi') => within(screen.getByText(name, { exact: true }).closest('tr')!);
const localDate = (offset = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

afterEach(() => vi.restoreAllMocks());

describe('Customer commercial columns', () => {
  it('shows authoritative counts and converted pipeline even after becoming a client', async () => {
    vi.spyOn(api, 'getCustomers').mockResolvedValue([customer({
      prospect_status: 'converted', current_dossier_count: 2,
      closed_dossier_count: 3, draft_dossier_count: 4, cancelled_dossier_count: 1,
      prospect_next_follow_up: localDate(-1),
    })]);
    render(<CustomersPage onNavigate={vi.fn()} />);
    await screen.findByText('Client suivi');
    expect(row().getByText('Converti')).toBeVisible();
    for (const text of ['Actuels : 2', 'Clos : 3', 'Brouillons : 4', 'Annulés : 1']) expect(row().getByText(text)).toBeVisible();
    expect(row().getByText(/Relance inactive/)).toBeVisible();
    expect(row().queryByText(/Dépassée/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /À relancer/ }));
    expect(screen.queryByText('Client suivi')).not.toBeInTheDocument();
  });

  it('includes Hahitantsoa active dossiers and excludes closed-only and draft-only contacts from active filter', async () => {
    vi.spyOn(api, 'getCustomers').mockResolvedValue([
      customer({ display_name: 'Hahitantsoa actuel', reservation_count: 0, event_count: 1, current_dossier_count: 1 }),
      customer({ id: 'closed', display_name: 'Déjà clos', reservation_count: 1, closed_dossier_count: 1 }),
      customer({ id: 'draft', display_name: 'En brouillon', reservation_count: 1, draft_dossier_count: 1 }),
    ]);
    render(<CustomersPage onNavigate={vi.fn()} />);
    await screen.findByText('Hahitantsoa actuel');
    fireEvent.click(screen.getByRole('button', { name: 'Avec dossier actif' }));
    expect(screen.getByText('Hahitantsoa actuel')).toBeVisible();
    expect(screen.queryByText('Déjà clos')).not.toBeInTheDocument();
    expect(screen.queryByText('En brouillon')).not.toBeInTheDocument();
  });

  it('does not invent zero counts when the API statistics are unavailable', async () => {
    vi.spyOn(api, 'getCustomers').mockResolvedValue([customer({ current_dossier_count: undefined })]);
    render(<CustomersPage onNavigate={vi.fn()} />);
    await screen.findByText('Client suivi');
    expect(row().getByText('Statistiques indisponibles')).toBeVisible();
    expect(row().queryByText('Actuels : 0')).not.toBeInTheDocument();
  });

  it('treats a calendar date today as due today, and any actionable past date as overdue', async () => {
    vi.spyOn(api, 'getCustomers').mockResolvedValue([
      customer({ prospect_status: 'contacted', prospect_next_follow_up: localDate() }),
      customer({ id: 'late', display_name: 'Relance passée', prospect_status: 'qualified', prospect_next_follow_up: localDate(-1) }),
      customer({ id: 'unscheduled', display_name: 'Non programmé', prospect_status: 'to_recall' }),
    ]);
    render(<CustomersPage onNavigate={vi.fn()} />);
    await screen.findByText('Client suivi');
    expect(row().queryByText(/Dépassée/)).not.toBeInTheDocument();
    expect(row('Relance passée').getByText(/Dépassée/)).toBeVisible();
    expect(row('Non programmé').getByText('À planifier')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /À relancer/ }));
    expect(screen.getByText('Client suivi')).toBeVisible();
  });

  it('refreshes on focus, ignores an older response, and keeps current filters', async () => {
    let resolveOld!: (data: Customer[]) => void;
    const get = vi.spyOn(api, 'getCustomers')
      .mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }))
      .mockResolvedValueOnce([customer({ prospect_status: 'contacted', current_dossier_count: 2 })]);
    render(<CustomersPage onNavigate={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/Rechercher nom/), { target: { value: 'suivi' } });
    fireEvent(window, new Event('focus'));
    await screen.findByText('Actuels : 2');
    await act(async () => resolveOld([customer({ display_name: 'Donnée périmée', current_dossier_count: 99 })]));
    expect(screen.queryByText('Donnée périmée')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Rechercher nom/)).toHaveValue('suivi');
    expect(get.mock.calls[0][1]?.aborted).toBe(true);
  });

  it('marks a failed refresh as stale and retries through the existing API', async () => {
    vi.spyOn(api, 'getCustomers').mockResolvedValueOnce([customer()])
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce([customer({ current_dossier_count: 1 })]);
    render(<CustomersPage onNavigate={vi.fn()} />);
    await screen.findByText('Actuels : 0');
    fireEvent.click(screen.getByRole('button', { name: 'Actualiser les fiches' }));
    expect(await screen.findByText(/informations affichées peuvent être anciennes/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await screen.findByText('Actuels : 1');
    await waitFor(() => expect(screen.queryByText(/informations affichées peuvent être anciennes/)).not.toBeInTheDocument());
  });
});
