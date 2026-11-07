import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import ReservationNewPage, {
  calculateHahitantsoaPaymentSchedule,
  calculateReservationTotals,
  formatHahitantsoaServiceNotes,
  resolveHahitantsoaEventName,
} from './prototype/ReservationNewPage';
import {
  ApiError, getWizardSessions, getWizardSession, downloadWizardFile, updateWizardSession, createWizardDraft, prepareWizardProforma, getReservationDraftDocumentInstances, convertProspectToClient,
  getCustomers,
  getHahitantsoaVenues,
  getHahitantsoaVenueOccupancy,
  getHahitantsoaServices,
  getHahitantsoaCommercialTerms,
  getTitanClosedDays,
  getInventoryItems,
  getMaterialPackages,
  getReservationAvailabilitySummary,
  getReservationAvailableItemPreviews,
  createReservationDraft,
  updateReservationDraft,
  createReservationDraftDocumentInstance,
  generateReservationDraftDocumentInstance,
  generateReservationDraftDocumentInstancePdf,
  createHahitantsoaEventDraft,
  updateHahitantsoaEventDraft,
  createHahitantsoaEventDraftDocumentInstance,
  generateHahitantsoaEventDraftDocumentInstance,
  generateHahitantsoaEventDraftDocumentInstancePdf,
  getHahitantsoaEventDraftDocumentInstances,
  convertProformaToContract,
  createCustomer,
  updateCustomer,
  uploadAttachment,
  recordConfirmedDeposit,
  getPayments,
  getHahitantsoaEventDraftPayments,
  getDocumentArtifactHtml,
  getDocumentTemplatePreview,
  getReservationDrafts,
  getReservationDraft,
  getHahitantsoaEventDraft,
  getHahitantsoaEventDraftDocumentPreview,
} from './api';

// ---- Shared mock data ----
const mockCustomersData = [
  {
    id: 'CUST-001',
    display_name: 'Ando Rakoto',
    party_type: 'individual',
    lifecycle_status: 'client',
    phone: '+261 34 00 000 01',
    email: 'ando@example.com',
    address: 'Lot 123 Ankorondrano',
    notes: '',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    is_deleted: false,
    deleted_at: null,
    created_by: null,
    updated_by: null,
  },
  {
    id: 'CUST-002',
    display_name: 'Rija Andria',
    party_type: 'individual',
    lifecycle_status: 'client',
    phone: '+261 34 00 000 02',
    email: 'rija@example.com',
    address: 'Lot 456 Analakely',
    notes: '',
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    is_deleted: false,
    deleted_at: null,
    created_by: null,
    updated_by: null,
  },
];

const mockVenuesData = [
  {
    id: 'VEN-001',
    name: 'Salle des fêtes + jardin',
    type: 'location_event',
    capacity: 200,
    active: true,
    price: 1500000,
  },
];

const mockServicesData = [
  {
    id: 'SRV-001',
    name: 'Traiteur',
    desc: 'Service de restauration pour vos événements',
    price: 500000,
    active: true,
  },
  {
    id: 'SRV-002',
    name: 'Décoration',
    desc: 'Service de décoration événementielle',
    price: 300000,
    active: true,
  },
  {
    id: 'SRV-003',
    name: 'Guinguette linéaire',
    desc: 'Guirlande guinguette linéaire blanc chaud',
    category: 'starry_sky',
    pricing_type: 'per_line',
    unit_label: 'ligne',
    price: 100000,
    active: true,
  },
];

const mockCatalogData = [
  {
    inventory_item_id: 'MAT-01',
    inventory_item_name: 'Chaise Napoléon transparente',
    inventory_item_kind: 'material',
    start_at: '2026-07-20T08:00:00',
    end_at: '2026-07-20T20:00:00',
    status: 'available',
  },
  {
    inventory_item_id: 'MAT-02',
    inventory_item_name: 'Table rectangulaire',
    inventory_item_kind: 'material',
    start_at: '2026-07-20T08:00:00',
    end_at: '2026-07-20T20:00:00',
    status: 'available',
  },
  {
    inventory_item_id: 'MAT-04',
    inventory_item_name: 'Sonorisation',
    inventory_item_kind: 'article',
    start_at: '2026-07-20T08:00:00',
    end_at: '2026-07-20T20:00:00',
    status: 'available',
  },
  {
    inventory_item_id: 'MAT-05',
    inventory_item_name: 'Chaise Chiavari',
    inventory_item_kind: 'material',
    start_at: '2026-07-20T08:00:00',
    end_at: '2026-07-20T20:00:00',
    status: 'available',
  },
  {
    inventory_item_id: 'MAT-06',
    inventory_item_name: 'Éclairage LED',
    inventory_item_kind: 'article',
    start_at: '2026-07-20T08:00:00',
    end_at: '2026-07-20T20:00:00',
    status: 'available',
  },
];

const mockInventoryData = mockCatalogData.map((item, index) => ({
  id: item.inventory_item_id,
  name: item.inventory_item_name,
  kind: item.inventory_item_kind,
  description: '',
  section: index % 2 === 0 ? 'Mobilier' : 'Technique',
  rental_price: String((index + 1) * 10000),
  reported_inventory_quantity: 100,
  stock_summary: {
    reported_inventory_quantity: 100,
    reported_damaged_quantity: 0,
    current_stock: 100,
    available_stock: 100,
    reserved_stock: 0,
    out_stock: 0,
    return_stock: 0,
    damaged_lost_stock: 0,
  },
}));

// ---- Mock API ----
vi.mock('./api', async importOriginal => ({
  ...(await importOriginal<typeof import('./api')>()),
  createWizardDraft: vi.fn().mockImplementation(async (_id, version) => ({ draft: { id: 'ATOMIC-DRAFT', status: 'draft', required_deposit_amount: '150000' }, version: version + 1, proforma_id: 'AUTO-PROFORMA' })),
  promoteWizardFile: vi.fn().mockImplementation(async (_id, version) => ({ attachment: { id: 'PROMOTED' }, version: version + 1 })),
  createWizardDischarge: vi.fn(),
  prepareWizardProforma: vi.fn().mockImplementation(async (_id, version) => ({ document: { id: "REV-PROFORMA", template_key: "titan.proforma.v1", status: "prepared", pdf_storage_path: null }, version: version + 1 })),
  convertProspectToClient: vi.fn(),
  getReservationDraftDocumentInstances: vi.fn().mockResolvedValue([]),
  getWizardSessions: vi.fn().mockResolvedValue([]),
  getWizardSession: vi.fn(),
  downloadWizardFile: vi.fn(),
  createWizardSession: vi.fn().mockImplementation(async (key) => ({ id: 'SESSION-1', client_key: key, version: 1, files: [], state: {} })),
  updateWizardSession: vi.fn().mockImplementation(async (id, version, value) => ({ id, version: version + 1, files: [], ...value })),
  uploadWizardFile: vi.fn(),
  deleteWizardFile: vi.fn().mockImplementation(async (_id, version) => ({ version: version + 1 })),
  getCustomers: vi.fn(),
  getTitanClosedDays: vi.fn(),
  getHahitantsoaVenues: vi.fn(),
  getHahitantsoaVenueOccupancy: vi.fn(),
  getHahitantsoaEventDrafts: vi.fn().mockResolvedValue([]),
  getHahitantsoaServices: vi.fn(),
  getHahitantsoaCommercialTerms: vi.fn(),
  getInventoryItems: vi.fn(),
  getMaterialPackages: vi.fn(),
  getReservationAvailabilitySummary: vi.fn(),
  getReservationAvailableItemPreviews: vi.fn(),
  createReservationDraft: vi.fn(),
  updateReservationDraft: vi.fn(),
  createReservationDraftDocumentInstance: vi.fn(),
  generateReservationDraftDocumentInstance: vi.fn(),
  generateReservationDraftDocumentInstancePdf: vi.fn(),
  createHahitantsoaEventDraft: vi.fn(),
  updateHahitantsoaEventDraft: vi.fn(),
  createHahitantsoaEventDraftDocumentInstance: vi.fn(),
  generateHahitantsoaEventDraftDocumentInstance: vi.fn(),
  generateHahitantsoaEventDraftDocumentInstancePdf: vi.fn(),
  getHahitantsoaEventDraftDocumentInstances: vi.fn().mockResolvedValue([]),
  convertProformaToContract: vi.fn(),
  createCustomer: vi.fn(),
  updateCustomer: vi.fn(),
  uploadAttachment: vi.fn(),
  recordConfirmedDeposit: vi.fn(),
  getPayments: vi.fn(),
  getHahitantsoaEventDraftPayments: vi.fn(),
  getDocumentArtifactHtml: vi.fn(),
  getDocumentTemplatePreview: vi.fn(),
  getReservationDrafts: vi.fn(),
  getReservationDraft: vi.fn(),
  getHahitantsoaEventDraft: vi.fn(),
  getReservationDraftDocumentPreview: vi.fn().mockResolvedValue('<html><body>Titan proforma mock</body></html>'),
  getHahitantsoaEventDraftDocumentPreview: vi.fn().mockResolvedValue('<html><body>Hahitantsoa proforma mock</body></html>'),
  previewNextPublicReference: vi.fn().mockResolvedValue({ brand: 'titan', year: 2026, next_reference: '001/2026', next_number: 1, prefix: '' }),
}));

describe('ReservationNewPage', () => {
  let mockNavigate: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate = vi.fn();
    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
    localStorage.clear();
    vi.mocked(getWizardSessions).mockResolvedValue([]);

    // Apply mock implementations before each test
    vi.mocked(getCustomers).mockResolvedValue(mockCustomersData as any);
    vi.mocked(getReservationDrafts).mockResolvedValue([]);
    vi.mocked(getHahitantsoaVenues).mockResolvedValue(mockVenuesData as any);
    vi.mocked(getHahitantsoaVenueOccupancy).mockResolvedValue({ items: [], count: 0 });
    vi.mocked(getHahitantsoaServices).mockResolvedValue(mockServicesData as any);
    vi.mocked(getHahitantsoaCommercialTerms).mockResolvedValue({
      base_space_rental_amount: '6500000.00',
      included_guest_count: 250,
      excess_guest_amount: '5000.00',
      bare_deposit_amount: '1000000.00',
      logistics_deposit_amount: '1500000.00',
      contract_validity_days: 15,
      night_option_1_amount: '300000.00',
      night_option_2_amount: '500000.00',
      night_security_amount: '120000.00',
      caution_amount: '500000.00',
      updated_at: '2026-01-01T00:00:00Z',
    });
    vi.mocked(getTitanClosedDays).mockResolvedValue([]);
    vi.mocked(getInventoryItems).mockResolvedValue(mockInventoryData as any);
    vi.mocked(getMaterialPackages).mockResolvedValue([
      {
        id: 'PKG-001',
        name: 'Package de test',
        description: 'Package API de test',
        price: 200000,
        is_active: true,
        lines: [
          { id: 'PKG-LINE-001', inventory_item: 'MAT-01', inventory_item_name: 'Chaise Napoléon transparente', quantity: 10, created_at: '2026-01-01T00:00:00Z' },
        ],
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ] as any);
    vi.mocked(getReservationAvailabilitySummary).mockResolvedValue({
      start_at: '2026-07-23T00:00:00Z',
      end_at: '2026-07-24T00:00:00Z',
      available_item_count: 5,
      available_preview_count: 1,
      available_item_kinds: ['material'],
    });
    vi.mocked(getReservationAvailableItemPreviews).mockResolvedValue(mockCatalogData as any);
    vi.mocked(createReservationDraft).mockResolvedValue({ id: 'DRAFT-001', status: 'draft' } as any);
    vi.mocked(updateReservationDraft).mockResolvedValue({ id: 'DRAFT-001', status: 'draft' } as any);
    vi.mocked(createReservationDraftDocumentInstance).mockResolvedValue({ id: 'DOC-T-001' } as any);
    vi.mocked(generateReservationDraftDocumentInstance).mockResolvedValue({ id: 'DOC-T-001' } as any);
    vi.mocked(generateReservationDraftDocumentInstancePdf).mockResolvedValue({ id: 'DOC-T-001' } as any);
    vi.mocked(createHahitantsoaEventDraft).mockResolvedValue({ id: 'EVENT-001', status: 'draft' } as any);
    vi.mocked(updateHahitantsoaEventDraft).mockResolvedValue({ id: 'EVENT-001', status: 'draft' } as any);
    vi.mocked(createHahitantsoaEventDraftDocumentInstance).mockResolvedValue({ id: 'DOC-H-001' } as any);
    vi.mocked(generateHahitantsoaEventDraftDocumentInstance).mockResolvedValue({ id: 'DOC-H-001' } as any);
    vi.mocked(generateHahitantsoaEventDraftDocumentInstancePdf).mockResolvedValue({ id: 'DOC-H-001' } as any);
    vi.mocked(getHahitantsoaEventDraftDocumentInstances).mockResolvedValue([]);
    vi.mocked(convertProformaToContract).mockResolvedValue({ id: 'CONTRACT-001', reservation_public_reference: 'RES-001' } as any);
    vi.mocked(createCustomer).mockResolvedValue({ id: 'CUST-NEW', display_name: 'New Client' } as any);
    vi.mocked(uploadAttachment).mockResolvedValue({ id: 'ATT-001' } as any);
    vi.mocked(recordConfirmedDeposit).mockResolvedValue({ payment: { id: 'PAY-001' }, replayed: false } as any);
    vi.mocked(getDocumentArtifactHtml).mockResolvedValue('<html><body>Document émis officiel</body></html>');
    vi.mocked(getDocumentTemplatePreview).mockResolvedValue('<html><body>Document officiel</body></html>');
    vi.mocked(getHahitantsoaEventDraftDocumentPreview).mockResolvedValue('<html><body>Document officiel</body></html>');
  });

  afterEach(() => {
    expect(window.alert).not.toHaveBeenCalled();
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it('offers a server recovery on an empty second device and restores actual file bytes', async () => {
    const file = new File(['%PDF-1.4'], 'cin.pdf', { type: 'application/pdf' });
    const session = { id: 'server-session', client_key: 'client-key', version: 7, step: 1, domain: null, status: 'active', updated_at: '2026-11-07T10:00:00Z', state: { step: 1, path: 'client_first', clientMode: 'new', newClient: { name: 'Reprise privée' }, clientAttachments: [{ id: 'page', name: 'cin.pdf', category: 'CIN' }] }, files: [{ id: 'file', client_file_key: 'page', original_name: 'cin.pdf', content_type: 'application/pdf' }] };
    vi.mocked(getWizardSessions).mockResolvedValue([session] as never);
    vi.mocked(getWizardSession).mockResolvedValue(session as never);
    vi.mocked(downloadWizardFile).mockResolvedValue(file);
    render(<ReservationNewPage currentUserId="operator" onNavigate={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Reprendre cette version serveur' }));
    await waitFor(() => expect(screen.getByDisplayValue('Reprise privée')).toBeInTheDocument());
    expect(downloadWizardFile).toHaveBeenCalledWith('server-session', session.files[0]);
    await waitFor(() => expect(localStorage.getItem('prototypeReservationDraft:operator')).toContain('Reprise privée'));
  });
  it('keeps a newly selected existing customer after a previous customer creation', async () => {
    localStorage.setItem('prototypeReservationDraft:operator', JSON.stringify({ step: 1, path: 'client_first', clientMode: 'new', newClient: { name: 'Client A' } }));
    render(<ReservationNewPage currentUserId="operator" onNavigate={mockNavigate} />);
    fireEvent.click(await screen.findByRole('button', { name: /Reprendre le secours local de cet appareil/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Continuer' }));
    await waitFor(() => expect(createCustomer).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('Titan Rental')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Retour' }));
    fireEvent.click(await screen.findByTestId('client-select-CUST-002'));
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    await waitFor(() => expect(updateWizardSession).toHaveBeenLastCalledWith(expect.any(String), expect.any(Number), expect.objectContaining({ customer_id: 'CUST-002', state: expect.objectContaining({ selectedClientId: 'CUST-002' }) })));
    expect(createCustomer).toHaveBeenCalledTimes(1);
  });

  it('keeps the entire local fallback when server payment revalidation fails before restoration', async () => {
    const local = JSON.stringify({ step: 1, path: 'client_first', clientMode: 'new', newClient: { name: 'Saisie locale préservée' } });
    localStorage.setItem('prototypeReservationDraft:operator', local);
    const session = { id: 'payment-failure', client_key: 'remote-key', version: 3, step: 8, domain: 'titan', status: 'active', updated_at: '2026-11-07T10:00:00Z', state: { step: 8, domain: 'titan', selectedClientId: 'CUST-002', prospectProformaEmission: { domain: 'titan', draftId: 'REMOTE-DRAFT', htmlGenerated: true } }, files: [] };
    vi.mocked(getWizardSessions).mockResolvedValue([session] as never);
    vi.mocked(getWizardSession).mockResolvedValue(session as never);
    vi.mocked(getReservationDraft).mockResolvedValue({ id: 'REMOTE-DRAFT', status: 'draft', contract_signed_at: null } as never);
    vi.mocked(getPayments).mockRejectedValueOnce(new Error('Paiements indisponibles'));
    render(<ReservationNewPage currentUserId="operator" onNavigate={mockNavigate} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Reprendre cette version serveur' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Paiements indisponibles');
    expect(localStorage.getItem('prototypeReservationDraft:operator')).toBe(local);
    expect(localStorage.getItem('prototypeReservationDraft:operator:server-client-key')).toBeNull();
    expect(updateWizardSession).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Reprendre le secours local de cet appareil/i }));
    expect(await screen.findByDisplayValue('Saisie locale préservée')).toBeInTheDocument();
  });

  it('creates the real-identity dossier through the atomic wizard action and retains its auto-proforma', async () => {
    localStorage.setItem('prototypeReservationDraft:operator', JSON.stringify({ step: 5, maxReachedStep: 5, path: 'client_first', domain: 'titan', selectedClientId: 'CUST-001', clientMode: 'existing', tDetails: { startDate: '2027-08-25', endDate: '2027-08-26' }, selectedMaterials: [{ id: 'ITEM-1', name: 'Chaise', price: 5000, quantity: 1 }] }));
    render(<ReservationNewPage currentUserId="operator" onNavigate={mockNavigate} />);
    fireEvent.click(await screen.findByRole('button', { name: /Reprendre le secours local de cet appareil/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Vérifier le résumé' }));
    await waitFor(() => expect(createWizardDraft).toHaveBeenCalledWith(expect.any(String), expect.any(Number), 'titan', expect.objectContaining({ customer_id: 'CUST-001', lines: [{ inventory_item_id: 'ITEM-1', quantity: 1, notes: '' }] }), 15));
    expect(createReservationDraft).not.toHaveBeenCalled();
    expect(createReservationDraftDocumentInstance).not.toHaveBeenCalled();
    await waitFor(() => expect(JSON.parse(localStorage.getItem('prototypeReservationDraft:operator')!).prospectProformaEmission).toMatchObject({ draftId: 'ATOMIC-DRAFT', documentId: 'AUTO-PROFORMA' }));
  });

  it('recovers an atomically linked dossier after its creation response was lost before the snapshot update', async () => {
    const session = { id: 'committed-session', client_key: 'committed-key', version: 6, step: 5, domain: 'titan', customer_id: 'CUST-001', reservation_draft_id: 'COMMITTED-DRAFT', status: 'active', updated_at: '2026-11-07T10:00:00Z', state: { step: 5, maxReachedStep: 5, path: 'client_first', domain: 'titan', clientMode: 'existing', selectedClientId: 'CUST-001', tDetails: { startDate: '2027-08-25', endDate: '2027-08-26' }, selectedMaterials: [{ id: 'ITEM-1', name: 'Chaise', price: 5000, quantity: 1 }] }, files: [] };
    vi.mocked(getWizardSessions).mockResolvedValue([session] as never);
    vi.mocked(getWizardSession).mockResolvedValue(session as never);
    vi.mocked(getReservationDraft).mockResolvedValue({ id: 'COMMITTED-DRAFT', status: 'draft', contract_signed_at: null } as never);
    vi.mocked(updateReservationDraft).mockResolvedValue({ id: 'COMMITTED-DRAFT', status: 'draft' } as never);
    render(<ReservationNewPage currentUserId="operator" onNavigate={mockNavigate} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Reprendre cette version serveur' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Vérifier le résumé' }));
    await waitFor(() => expect(updateReservationDraft).toHaveBeenCalledWith('COMMITTED-DRAFT', expect.any(Object)));
    expect(createWizardDraft).not.toHaveBeenCalled();
    expect(createReservationDraft).not.toHaveBeenCalled();
    await waitFor(() => expect(JSON.parse(localStorage.getItem('prototypeReservationDraft:operator')!).prospectProformaEmission.draftId).toBe('COMMITTED-DRAFT'));
  });

  it.each([7, 8])('blocks every commercial write after a known conflict at step %s', async step => {
    vi.mocked(getCustomers).mockResolvedValue([{ ...mockCustomersData[0], lifecycle_status: 'prospect' }] as never);
    vi.mocked(getReservationDraft).mockResolvedValue({ id: 'EXISTING', status: 'draft', contract_signed_at: null, required_deposit_amount: '100' } as never);
    vi.mocked(getPayments).mockResolvedValue([]);
    localStorage.setItem('prototypeReservationDraft:operator', JSON.stringify({ step, maxReachedStep: step, path: 'client_first', domain: 'titan', clientMode: 'existing', selectedClientId: 'CUST-001', selectedMaterials: [{ id: 'ITEM-1', name: 'Chaise', price: 1000, quantity: 1 }], payment: { method: 'Espèces', amount: '100', percent: '10' }, prospectProformaEmission: { domain: 'titan', draftId: 'EXISTING', documentId: 'EXISTING-PROFORMA', htmlGenerated: true, documentPdfGenerated: true, requiredDepositAmount: 100 } }));
    render(<ReservationNewPage currentUserId="operator" onNavigate={mockNavigate} />);
    fireEvent.click(await screen.findByRole('button', { name: /Reprendre le secours local de cet appareil/i }));
    await screen.findByRole('heading', { name: step === 7 ? 'Aperçu Proforma' : 'Acompte / Paiement' });
    vi.mocked(updateWizardSession).mockRejectedValueOnce(new ApiError('Conflit serveur', 409));
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer la sauvegarde serveur' }));
    await screen.findByText(/^Conflit : une autre version est enregistrée/);
    const privateWrites = vi.mocked(updateWizardSession).mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: step === 7 ? 'Émettre le proforma' : 'Enregistrer le versement & continuer' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('autre version'));
    expect(updateWizardSession).toHaveBeenCalledTimes(privateWrites);
    expect(updateReservationDraft).not.toHaveBeenCalled();
    expect(convertProspectToClient).not.toHaveBeenCalled();
    expect(recordConfirmedDeposit).not.toHaveBeenCalled();
    expect(createReservationDraftDocumentInstance).not.toHaveBeenCalled();
    expect(generateReservationDraftDocumentInstance).not.toHaveBeenCalled();
    expect(prepareWizardProforma).not.toHaveBeenCalled();
  });

  it('persists an intentional legacy proforma revision before emission and reuses its key on another terminal after a lost response', async () => {
    vi.mocked(getReservationDraft).mockResolvedValue({ id: 'LEGACY', status: 'draft', contract_signed_at: null } as never);
    vi.mocked(updateReservationDraft).mockResolvedValue({ id: 'LEGACY', status: 'draft' } as never);
    vi.mocked(getReservationDraftDocumentInstances).mockResolvedValue([{ id: 'LEGACY-PROFORMA', template_key: 'titan.proforma.v1', status: 'generated' }] as never);
    vi.mocked(prepareWizardProforma).mockRejectedValueOnce(new Error('Réponse de révision perdue'));
    localStorage.setItem('prototypeReservationDraft:operator', JSON.stringify({ step: 7, maxReachedStep: 7, path: 'client_first', domain: 'titan', clientMode: 'existing', selectedClientId: 'CUST-001', tDetails: { startDate: '2027-08-25', endDate: '2027-08-26' }, editingDraftContext: { isEditing: true, draftId: 'LEGACY', domain: 'titan', publicReference: 'LOC-LEGACY', loading: false, error: null }, prospectProformaEmission: { domain: 'titan', draftId: 'LEGACY', htmlGenerated: false, needsRevision: true } }));
    const first = render(<ReservationNewPage currentUserId="operator" onNavigate={mockNavigate} />);
    fireEvent.click(await screen.findByRole('button', { name: /Reprendre le secours local de cet appareil/i }));
    fireEvent.click(await screen.findByRole('button', { name: 'Émettre la nouvelle révision' }));
    await waitFor(() => expect(prepareWizardProforma).toHaveBeenCalledTimes(1));
    const firstOptions = vi.mocked(prepareWizardProforma).mock.calls[0][3]!;
    expect(firstOptions).toMatchObject({ proforma_id: 'LEGACY-PROFORMA', revision_key: expect.any(String) });
    const savedState = JSON.parse(JSON.stringify([...vi.mocked(updateWizardSession).mock.calls].reverse().find(([, , value]) => (value.state?.prospectProformaEmission as { revisionKey?: string })?.revisionKey === firstOptions.revision_key)![2].state!));
    expect((JSON.parse(localStorage.getItem('prototypeReservationDraft:operator')!).prospectProformaEmission).revisionKey).toBe(firstOptions.revision_key);
    const saveOrder = vi.mocked(updateWizardSession).mock.invocationCallOrder[vi.mocked(updateWizardSession).mock.calls.findIndex(([, , value]) => (value.state?.prospectProformaEmission as { revisionKey?: string })?.revisionKey === firstOptions.revision_key)];
    expect(saveOrder).toBeLessThan(vi.mocked(prepareWizardProforma).mock.invocationCallOrder[0]);
    first.unmount(); localStorage.clear();
    const remote = { id: 'remote-session', client_key: 'remote-key', version: 12, step: 7, domain: 'titan', customer_id: 'CUST-001', reservation_draft_id: 'LEGACY', status: 'active', updated_at: '2026-11-07T10:00:00Z', state: savedState, files: [] };
    vi.mocked(getWizardSessions).mockResolvedValue([remote] as never);
    vi.mocked(getWizardSession).mockResolvedValue(remote as never);
    render(<ReservationNewPage currentUserId="operator" onNavigate={mockNavigate} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Reprendre cette version serveur' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Émettre la nouvelle révision' }));
    await waitFor(() => expect(prepareWizardProforma).toHaveBeenCalledTimes(2));
    expect(vi.mocked(prepareWizardProforma).mock.calls[1][3]).toEqual(firstOptions);
    await waitFor(() => expect(generateReservationDraftDocumentInstance).toHaveBeenCalledWith('LEGACY', 'REV-PROFORMA'));
    expect(createReservationDraftDocumentInstance).not.toHaveBeenCalled();
    expect(createWizardDraft).not.toHaveBeenCalled();
  });

  it('rejects malformed server state without replacing the existing local fallback', async () => {
    localStorage.setItem('prototypeReservationDraft:operator', JSON.stringify({ step: 1, newClient: { name: 'Saisie locale' } }));
    const session = { id: 'broken', step: 3, status: 'active', updated_at: '2026-11-07T10:00:00Z', state: { step: 3, selectedMaterials: [null] }, files: [] };
    vi.mocked(getWizardSessions).mockResolvedValue([session] as never);
    vi.mocked(getWizardSession).mockResolvedValue(session as never);
    render(<ReservationNewPage currentUserId="operator" onNavigate={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Reprendre cette version serveur' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('champs incompatibles');
    expect(localStorage.getItem('prototypeReservationDraft:operator')).toContain('Saisie locale');
    expect(updateWizardSession).not.toHaveBeenCalled();
  });
  it('présente quatre étapes métier sans supprimer les sous-écrans du parcours', async () => {
    render(<ReservationNewPage onNavigate={mockNavigate} param="titan" />);

    expect(await screen.findByRole('button', { name: /client & volet/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /date & disponibilité/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /offre & logistique/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /vérification & documents/i })).toBeInTheDocument();
  });

  it('calcule les deux tranches Hahitantsoa sans pourcentage d’acompte', () => {
    expect(calculateHahitantsoaPaymentSchedule(6510000, 1000000, '2026-09-30')).toEqual({
      depositAmount: 1000000,
      remaining: 5510000,
      firstInstallment: 2755000,
      secondInstallment: 2755000,
      firstDue: '2026-08-30',
      secondDue: '2026-09-20',
    });
  });

  it('calcule un total cohérent quand un package est ajusté ou retiré', () => {
    const packageData = {
      id: 'PKG-001',
      name: 'Package de test',
      description: '',
      price: 200000,
      is_active: true,
      lines: [{ id: 'LINE-001', inventory_item: 'MAT-01', inventory_item_name: 'Chaise', quantity: 10, created_at: '' }],
      created_at: '',
      updated_at: '',
    };
    const selectedMaterials = [
      { id: 'MAT-01', name: 'Chaise', price: 10000, quantity: 12 },
      { id: 'MAT-02', name: 'Table complémentaire', price: 20000, quantity: 2 },
    ];
    const hDetails = {
      rentalType: 'Location + logistique', venuePrice: 0, logisticsPrice: 0,
      durationOptionPrice: 0, packageMode: 'package' as const, packageId: 'PKG-001',
    };

    const withPackage = calculateReservationTotals({
      domain: 'hahitantsoa', hDetails, selectedMaterials, selectedServices: [],
      packages: [packageData], catalog: [], deliveryFee: '', discountValue: 0, discountIsPercentage: false,
    });
    expect(withPackage.packageAdjustedTotal).toBe(220000);
    expect(withPackage.complementaryMaterialsTotal).toBe(40000);
    expect(withPackage.subTotalAmount).toBe(260000);
    expect(withPackage.totalAmount).toBe(260000);

    const withoutPackage = calculateReservationTotals({
      domain: 'hahitantsoa', hDetails: { ...hDetails, packageMode: 'free' }, selectedMaterials,
      selectedServices: [], packages: [packageData], catalog: [], deliveryFee: '', discountValue: 0, discountIsPercentage: false,
    });
    expect(withoutPackage.packageTotal).toBe(0);
    expect(withoutPackage.subTotalAmount).toBe(160000);
  });


  it('restores an older incomplete snapshot with defaults and keeps manually chosen movement dates', async () => {
    localStorage.setItem('prototypeReservationDraft', JSON.stringify({ path: 'domain_first', step: 3, maxReachedStep: 3, domain: 'titan', selectedClientId: 'CUST-001', deliveryModifiedManually: true, returnModifiedManually: true, tDetails: { startDate: '2027-08-25', endDate: '2027-08-26', pickupDate: '2027-08-20', returnDate: '2027-08-30' } }));
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    fireEvent.click(await screen.findByRole('button', { name: /Reprendre le secours local de cet appareil/i }));
    expect(await screen.findByLabelText('Date début de location')).toHaveValue('2027-08-25');
    expect(screen.getByLabelText('Heure de début de location')).toHaveValue('08:00');
    await waitFor(() => expect(JSON.parse(localStorage.getItem('prototypeReservationDraft')!).tDetails.pickupDate).toBe('2027-08-20'));
    expect(JSON.parse(localStorage.getItem('prototypeReservationDraft')!).tDetails.returnDate).toBe('2027-08-30');
  });

  it('blocks progression for empty or reversed dates and accepts corrected dates', async () => {
    render(<ReservationNewPage onNavigate={mockNavigate} param="titan" />);
    fireEvent.click(await screen.findByTestId('client-select-CUST-001'));
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Aller au catalogue' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('dates et heures valides');
    fireEvent.change(screen.getByLabelText('Date début de location'), { target: { value: '2027-08-25' } });
    fireEvent.change(screen.getByLabelText('Date fin de location'), { target: { value: '2027-08-24' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aller au catalogue' }));
    expect(screen.getByRole('alert')).toHaveTextContent('postérieure');
    fireEvent.change(screen.getByLabelText('Date fin de location'), { target: { value: '2027-08-26' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aller au catalogue' }));
    expect(await screen.findByRole('button', { name: 'Aller à la Livraison' })).toBeInTheDocument();
  });

  it('updates the chosen customer from the wizard without creating a duplicate', async () => {
    vi.mocked(updateCustomer).mockResolvedValue({ ...mockCustomersData[0], display_name: 'Ando corrigé' } as never);
    render(<ReservationNewPage onNavigate={mockNavigate} param="titan" />);
    fireEvent.click(await screen.findByTestId('client-select-CUST-001'));
    fireEvent.click(screen.getByRole('button', { name: 'Corriger les informations du client' }));
    fireEvent.change(screen.getByDisplayValue('Ando Rakoto'), { target: { value: 'Ando corrigé' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    await waitFor(() => expect(updateCustomer).toHaveBeenCalledWith('CUST-001', expect.objectContaining({ display_name: 'Ando corrigé' })));
    expect(createCustomer).not.toHaveBeenCalled();
    expect(Object.hasOwn(vi.mocked(updateCustomer).mock.calls[0][1], 'idempotency_key')).toBe(false);
    expect(await screen.findByRole('heading', { name: 'Détails Location (Titan)' })).toBeInTheDocument();
  });


  it('rechecks server payments before resuming a contract preview and refuses an uncovered deposit', async () => {
    vi.mocked(getReservationDraft).mockResolvedValue({ id: 'DRAFT-001', status: 'draft', required_deposit_amount: '100.00', contract_signed_at: null } as never);
    vi.mocked(getPayments).mockResolvedValue([{ id: 'PAY-1', payment_status: 'confirmed', amount: '20.00', payment_method: 'cash' }] as never);
    localStorage.setItem('prototypeReservationDraft', JSON.stringify({ path: 'domain_first', step: 9, maxReachedStep: 9, domain: 'titan', selectedClientId: 'CUST-001', clientMode: 'existing', recordedPayments: [{ id: 'FAKE-LOCAL', amount: 10000, method: 'Espèces' }], prospectProformaEmission: { domain: 'titan', draftId: 'DRAFT-001', requiredDepositAmount: 100 }, selectedMaterials: [{ id: 'MAT-01', name: 'Chaise', quantity: 1, price: 100 }], tDetails: { startDate: '2027-08-25', endDate: '2027-08-26' } }));
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    fireEvent.click(await screen.findByRole('button', { name: /Reprendre le secours local de cet appareil/i }));
    expect(await screen.findByRole('heading', { name: 'Acompte / Paiement' })).toBeInTheDocument();
    expect(getPayments).toHaveBeenCalledWith('DRAFT-001');
    expect(screen.queryByRole('heading', { name: 'Aperçu Contrat' })).not.toBeInTheDocument();
    expect(recordConfirmedDeposit).not.toHaveBeenCalled();
  });


  it('uses the local calendar day for shortcuts and minima after midnight', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2027-03-09T21:30:00Z'));
    try {
      render(<ReservationNewPage onNavigate={mockNavigate} param="titan" />);
      fireEvent.click(await screen.findByTestId('client-select-CUST-001'));
      fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
      fireEvent.click((await screen.findAllByRole('button', { name: "Aujourd'hui" }))[0]);
      const local = [new Date().getFullYear(), String(new Date().getMonth() + 1).padStart(2, '0'), String(new Date().getDate()).padStart(2, '0')].join('-');
      expect(screen.getByLabelText('Date début de location')).toHaveValue(local);
      expect(screen.getByLabelText('Date début de location')).toHaveAttribute('min', local);
    } finally { vi.useRealTimers(); }
  });

  it('1. la première étape affiche les deux chemins si pas de param', async () => {
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    await waitFor(() => {
      expect(screen.getByText('Comment voulez-vous commencer ?')).toBeInTheDocument();
    });
    expect(screen.getByText('Commencer par le client')).toBeInTheDocument();
    expect(screen.getByText('Commencer par le volet')).toBeInTheDocument();
  });

  it('2. parcours "client d\'abord" fonctionne jusqu\'au résumé', async () => {
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    await waitFor(() => {
      expect(screen.getByText('Comment voulez-vous commencer ?')).toBeInTheDocument();
    });

    // Step 0
    fireEvent.click(screen.getByText('Commencer par le client'));

    // Step 1: Client
    await waitFor(() => {
      expect(screen.getByTestId('client-select-CUST-001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('client-select-CUST-001'));
    fireEvent.click(screen.getByText('Continuer'));

    // Step 2: Domain
    await waitFor(() => {
      expect(screen.getByText('Hahitantsoa')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Hahitantsoa'));
    fireEvent.click(screen.getByText('Continuer'));

    // Step 3: Details
    await waitFor(() => {
      expect(screen.getByText('Suivant (Services)')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText('Date début événement'), { target: { value: '2027-08-01' } });
    fireEvent.change(screen.getByLabelText('Date fin événement'), { target: { value: '2027-08-02' } });
    fireEvent.click(screen.getByText('Suivant (Services)'));

    // Step 5: Services (Hahitantsoa) (skipped catalogue)
    await waitFor(() => {
      expect(screen.getByText('Services Hahitantsoa')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Vérifier le résumé'));

    // Step 6: Summary
    await waitFor(() => {
      expect(screen.getByText('Résumé modifiable', { exact: false })).toBeInTheDocument();
    });
    expect(screen.getByText('Ando Rakoto')).toBeInTheDocument();
  });

  it('3. Titan n\'affiche pas de champs événementiels mais propose la livraison', async () => {
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    await waitFor(() => {
      expect(screen.getByText('Commencer par le volet')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Commencer par le volet'));
    fireEvent.click(screen.getByText('Titan Rental'));
    fireEvent.click(screen.getByText('Continuer'));

    await waitFor(() => {
      expect(screen.getByTestId('client-select-CUST-001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('client-select-CUST-001'));
    fireEvent.click(screen.getByText('Continuer'));

    // Details Titan
    await waitFor(() => {
      expect(screen.getByText('Détails Location (Titan)')).toBeInTheDocument();
    });
    expect(screen.queryByText("Type d'événement")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Date début de location'), { target: { value: '2027-08-01' } });
    fireEvent.change(screen.getByLabelText('Date fin de location'), { target: { value: '2027-08-02' } });
    fireEvent.click(screen.getByText('Aller au catalogue'));

    // Catalogue
    await waitFor(() => {
      expect(screen.getByText('Aller à la Livraison')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Aller à la Livraison'));

    // Livraison Titan
    await waitFor(() => {
      expect(screen.getByText('Option Livraison (Titan)')).toBeInTheDocument();
    });
    const deliveryInput = screen.getByPlaceholderText('Ex: 50000');
    fireEvent.change(deliveryInput, { target: { value: '100000' } });
    fireEvent.click(screen.getByText('Vérifier le résumé'));

    // Summary Titan
    await waitFor(() => {
      expect(screen.getAllByText(/100\s*000\s*Ar/)[0]).toBeInTheDocument();
    });
  });

  it('4. Hahitantsoa propose les services', async () => {
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    await waitFor(() => {
      expect(screen.getByText('Commencer par le volet')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Commencer par le volet'));
    fireEvent.click(screen.getByText('Hahitantsoa'));
    fireEvent.click(screen.getByText('Continuer'));

    await waitFor(() => {
      expect(screen.getByTestId('client-select-CUST-001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('client-select-CUST-001'));
    fireEvent.click(screen.getByText('Continuer'));

    await waitFor(() => {
      expect(screen.getByText('Suivant (Services)')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText('Date début événement'), { target: { value: '2027-08-01' } });
    fireEvent.change(screen.getByLabelText('Date fin événement'), { target: { value: '2027-08-02' } });
    fireEvent.click(screen.getByText('Suivant (Services)'));

    expect(screen.getByText('Services Hahitantsoa')).toBeInTheDocument();
  });

  it('5. La finalisation montre le proforma puis le paiement puis le contrat', async () => {
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    // Fast path to Proforma
    await waitFor(() => {
      expect(screen.getByText('Commencer par le volet')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Commencer par le volet'));
    fireEvent.click(screen.getByText('Titan Rental'));
    fireEvent.click(screen.getByText('Continuer'));

    await waitFor(() => {
      expect(screen.getByTestId('client-select-CUST-001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('client-select-CUST-001'));
    fireEvent.click(screen.getByText('Continuer'));

    await waitFor(() => {
      expect(screen.getByText('Aller au catalogue')).toBeInTheDocument();
    });
    const contractDateInputs = screen.getAllByDisplayValue('').filter(el => el.getAttribute('type') === 'date');
    const contractTimeInputs = screen.getAllByDisplayValue('').filter(el => el.getAttribute('type') === 'time');
    if (contractDateInputs.length >= 2) {
      fireEvent.change(contractDateInputs[0], { target: { value: '2026-08-01' } });
      fireEvent.change(contractDateInputs[1], { target: { value: '2026-08-02' } });
    }
    if (contractTimeInputs.length >= 2) {
      fireEvent.change(contractTimeInputs[0], { target: { value: '08:00' } });
      fireEvent.change(contractTimeInputs[1], { target: { value: '20:00' } });
    }
    fireEvent.click(screen.getByText('Aller au catalogue'));

    await waitFor(() => {
      expect(screen.getByText('Aller à la Livraison')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Aller à la Livraison'));

    await waitFor(() => {
      expect(screen.getByText('Vérifier le résumé')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Vérifier le résumé'));

    // In summary
    await waitFor(() => {
      expect(screen.getByText('Générer Devis/Proforma')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Générer Devis/Proforma'));

    // Proforma preview
    await waitFor(() => {
      expect(screen.getByText('Aperçu Proforma')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Passer au paiement'));

    // Payment step
    await waitFor(() => {
      expect(screen.getByText('Acompte / Paiement')).toBeInTheDocument();
    });
    expect(screen.getByText(/Acompte contractuel Titan/)).toBeInTheDocument();
    expect(screen.getByText(/25% du total/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Acompte %/)).not.toBeInTheDocument();
    const paymentProof = new File(['proof'], 'recu-acompte.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByPlaceholderText("Ex. reçu d'acompte"), { target: { value: "Reçu acompte" } });
    fireEvent.change(document.getElementById('paymentFile')!, { target: { files: [paymentProof] } });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));

    fireEvent.click(screen.getByRole('button', { name: 'Passer à l’aperçu du contrat' }));

    // Contract preview
    await waitFor(() => {
      expect(screen.getByText('Aperçu Contrat')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Générer le contrat et ouvrir le dossier'));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('reservation-detail', 'titan:DRAFT-001');
    });
    expect(createReservationDraft).toHaveBeenCalledWith(expect.objectContaining({
      customer_id: 'CUST-001',
      start_at: '2026-08-01T08:00:00Z',
      end_at: '2026-08-02T22:00:00Z',
      delivery_fee: 0,
      discount_amount: 0,
      discount_reason: '',
    }));
    expect(convertProformaToContract).toHaveBeenCalledWith('DOC-T-001');
    expect(uploadAttachment).toHaveBeenCalledWith(
      paymentProof,
      'Justificatif paiement',
      expect.objectContaining({ reservationDraftId: 'DRAFT-001' }),
      undefined,
      'Reçu acompte',
    );
  });

  it('6. les documents officiels ont des champs dédiés et sont exclus des pièces jointes générales', async () => {
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    await waitFor(() => {
      expect(screen.getByText('Comment voulez-vous commencer ?')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Commencer par le client'));
    fireEvent.click(screen.getByText('Nouveau client'));

    // Check attachment UI
    await waitFor(() => {
      expect(screen.getByText('Pièces jointes client')).toBeInTheDocument();
    });
    const identityInput = screen.getByLabelText(/ajouter une pièce jointe pour CIN/i);
    expect(identityInput).toHaveAttribute('multiple');
    const recto = new File(['recto'], 'recto.png', { type: 'image/png' });
    const verso = new File(['verso'], 'verso.png', { type: 'image/png' });
    fireEvent.change(identityInput, { target: { files: [recto, verso] } });
    fireEvent.change(identityInput, { target: { files: [new File(['extra'], 'extra.png', { type: 'image/png' })] } });
    expect(screen.getAllByRole('button', { name: /Retirer .*\.png/ })).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Retirer extra.png' }));
    expect(screen.getAllByRole('button', { name: /Retirer .*\.png/ })).toHaveLength(2);
    expect(screen.getByPlaceholderText('Ex. justificatif domicile')).toBeInTheDocument();
    const generalCategories = Array.from((document.getElementById('clientCat') as HTMLSelectElement).options).map(option => option.value);
    expect(generalCategories).not.toContain('CIN');
    expect(generalCategories).not.toContain('Passeport');
    expect(generalCategories).not.toContain('NIF');
    expect(generalCategories).not.toContain('STAT');
    expect(generalCategories).not.toContain('RCS');
    expect(screen.queryByRole('option', { name: 'Photo' })).not.toBeInTheDocument();
  });

  it('7. Le catalogue permet d\'ajouter un matériel au tableau', async () => {
    const firstRender = render(<ReservationNewPage onNavigate={mockNavigate} />);
    await waitFor(() => {
      expect(screen.getByText('Commencer par le volet')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Commencer par le volet'));
    fireEvent.click(screen.getByText('Titan Rental'));
    fireEvent.click(screen.getByText('Continuer'));

    await waitFor(() => {
      expect(screen.getByTestId('client-select-CUST-001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('client-select-CUST-001'));
    fireEvent.click(screen.getByText('Continuer'));

    await waitFor(() => {
      expect(screen.getByText('Aller au catalogue')).toBeInTheDocument();
    });
    // Set dates so the catalog availability API is triggered
    const dateInputs7 = screen.getAllByDisplayValue('').filter(el => el.getAttribute('type') === 'date');
    const timeInputs7 = screen.getAllByDisplayValue('').filter(el => el.getAttribute('type') === 'time');
    if (dateInputs7.length >= 2) {
      fireEvent.change(dateInputs7[0], { target: { value: '2026-08-01' } });
      fireEvent.change(dateInputs7[1], { target: { value: '2026-08-02' } });
    }
    if (timeInputs7.length >= 2) {
      fireEvent.change(timeInputs7[0], { target: { value: '08:00' } });
      fireEvent.change(timeInputs7[1], { target: { value: '20:00' } });
    }
    fireEvent.click(screen.getByText('Aller au catalogue'));

    // Enter quantity in catalogue
    await waitFor(() => {
      const inputs = screen.getAllByPlaceholderText('0');
      expect(inputs.length).toBeGreaterThan(0);
    });
    fireEvent.change(screen.getByLabelText('Rechercher un article'), { target: { value: 'Chaise' } });
    expect(screen.getByText('Chaise Napoléon transparente')).toBeInTheDocument();
    expect(screen.queryByText('Table rectangulaire')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Faire défiler jusqu'à l'action suivante/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Réinitialiser' }));
    const inputs = screen.getAllByPlaceholderText('0');
    fireEvent.change(inputs[0], { target: { value: '5' } }); // Chaise

    fireEvent.click(screen.getByText('Aller à la Livraison')); // to livraison
    await waitFor(() => {
      expect(screen.getByText('Vérifier le résumé')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Vérifier le résumé')); // to summary

    // Check table in summary
    await waitFor(() => {
      expect(screen.getByText('Matériels sélectionnés')).toBeInTheDocument();
    });
    expect(screen.getByText('Chaise Napoléon transparente')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument(); // Qté
    expect(createReservationDraft).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem('prototypeReservationDraft') || '{}')).toMatchObject({
        prospectProformaEmission: { domain: 'titan', draftId: 'DRAFT-001' },
      });
    });

    firstRender.unmount();
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    fireEvent.click(await screen.findByRole('button', { name: /Reprendre le secours local de cet appareil/i }));
    expect(await screen.findByText('Générer Devis/Proforma')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Générer Devis/Proforma'));
    expect(await screen.findByText('Aperçu Proforma')).toBeInTheDocument();
    expect(createReservationDraft).toHaveBeenCalledTimes(1);
  });

  it('8. Le stepper permet de naviguer entre les étapes', async () => {
    render(<ReservationNewPage onNavigate={mockNavigate} />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Commencer par le client')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Commencer par le client'));

    // Verify step 1 shows client selection
    await waitFor(() => {
      expect(screen.getByText('Sélection ou création du client')).toBeInTheDocument();
    });
  });

  it('9. Le wizard et résumé Titan affichent les bons champs géographiques', async () => {
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    await waitFor(() => {
      expect(screen.getByText('Commencer par le volet')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Commencer par le volet'));
    fireEvent.click(screen.getByText('Titan Rental'));
    fireEvent.click(screen.getByText('Continuer'));

    await waitFor(() => {
      expect(screen.getByTestId('client-select-CUST-001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('client-select-CUST-001'));
    fireEvent.click(screen.getByText('Continuer'));

    // Check wizard labels
    await waitFor(() => {
      expect(screen.getByText("Type d'usage")).toBeInTheDocument();
    });
    expect(screen.getByText('Nom du lieu')).toBeInTheDocument();
    expect(screen.getByText('Adresse complète')).toBeInTheDocument();
    expect(screen.getByText('Commune / Ville')).toBeInTheDocument();
    expect(screen.getByText('Contact sur place')).toBeInTheDocument();
    expect(screen.getByText('Téléphone contact')).toBeInTheDocument();
    expect(screen.getByText('Latitude')).toBeInTheDocument();
    expect(screen.getByText('Longitude')).toBeInTheDocument();
    expect(screen.getByLabelText("Type d'usage")).toBeInTheDocument();
    expect(screen.getByLabelText('Nom du lieu')).toBeInTheDocument();
    expect(screen.getByLabelText('Commune ou ville')).toBeInTheDocument();
    expect(screen.getByLabelText('Adresse complète')).toBeInTheDocument();
    expect(screen.getByLabelText('Latitude')).toBeInTheDocument();
    expect(screen.getByLabelText('Longitude')).toBeInTheDocument();

    // Fill the fields
    const venueNameInput = screen.getByPlaceholderText('Ex: Espace Fitiavana, Villa privée, Salle communale, Domicile client');
    fireEvent.change(venueNameInput, { target: { value: 'Villa Privée' } });

    fireEvent.change(screen.getByPlaceholderText('Ex: Lot XYZ Ambohibao'), { target: { value: 'Lot 123' } });
    fireEvent.change(screen.getByPlaceholderText('Ex: Antananarivo'), { target: { value: 'Tana' } });

    // GPS
    fireEvent.change(screen.getByPlaceholderText('Ex: -18.8792'), { target: { value: '-18.0' } });
    fireEvent.change(screen.getByPlaceholderText('Ex: 47.5079'), { target: { value: '47.0' } });

    fireEvent.change(screen.getByLabelText('Date début de location'), { target: { value: '2027-08-01' } });
    fireEvent.change(screen.getByLabelText('Date fin de location'), { target: { value: '2027-08-02' } });
    fireEvent.click(screen.getByText('Aller au catalogue'));

    await waitFor(() => {
      expect(screen.getByText('Aller à la Livraison')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Aller à la Livraison'));

    await waitFor(() => {
      expect(screen.getByText('Vérifier le résumé')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Vérifier le résumé'));

    // In summary
    await waitFor(() => {
      expect(screen.getByText('Résumé modifiable')).toBeInTheDocument();
    });
    expect(screen.getByText('Mariage')).toBeInTheDocument(); // default usage type
    expect(screen.getByText(/Villa Privée/)).toBeInTheDocument();
    expect(screen.getByText('Lot 123 - Tana')).toBeInTheDocument();

    const gpsLink = screen.getByText('Ouvrir dans Google Maps (GPS)');
    expect(gpsLink).toBeInTheDocument();
    expect(gpsLink.closest('a')).toHaveAttribute('href', 'https://www.google.com/maps/search/?api=1&query=-18.0,47.0');
  });

  it('10. Le résumé Titan utilise l\'adresse si pas de GPS', async () => {
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    await waitFor(() => {
      expect(screen.getByText('Commencer par le volet')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Commencer par le volet'));
    fireEvent.click(screen.getByText('Titan Rental'));
    fireEvent.click(screen.getByText('Continuer'));

    await waitFor(() => {
      expect(screen.getByTestId('client-select-CUST-002')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('client-select-CUST-002'));
    fireEvent.click(screen.getByText('Continuer'));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ex: Lot XYZ Ambohibao')).toBeInTheDocument();
    });
    fireEvent.change(screen.getByPlaceholderText('Ex: Lot XYZ Ambohibao'), { target: { value: 'Lot 123' } });
    fireEvent.change(screen.getByPlaceholderText('Ex: Antananarivo'), { target: { value: 'Tana' } });

    fireEvent.change(screen.getByLabelText('Date début de location'), { target: { value: '2027-08-01' } });
    fireEvent.change(screen.getByLabelText('Date fin de location'), { target: { value: '2027-08-02' } });
    fireEvent.click(screen.getByText('Aller au catalogue'));

    await waitFor(() => {
      expect(screen.getByText('Aller à la Livraison')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Aller à la Livraison'));

    await waitFor(() => {
      expect(screen.getByText('Vérifier le résumé')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Vérifier le résumé'));

    await waitFor(() => {
      expect(screen.getByText('Ouvrir dans Google Maps (Adresse)')).toBeInTheDocument();
    });
    const addressLink = screen.getByText('Ouvrir dans Google Maps (Adresse)');
    expect(addressLink.closest('a')).toHaveAttribute('href', expect.stringContaining('Lot%20123%2C%20Tana'));
  });

  it('11. Clamp quantite: catalogue depassement est ramene au max et les inputs ont min max step', async () => {
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    await waitFor(() => {
      expect(screen.getByText('Commencer par le volet')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Commencer par le volet'));
    fireEvent.click(screen.getByText('Titan Rental'));
    fireEvent.click(screen.getByRole('button', {name: /Continuer/i}));

    await waitFor(() => {
      expect(screen.getByTestId('client-select-CUST-001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('client-select-CUST-001'));
    fireEvent.click(screen.getByRole('button', {name: /Continuer/i}));

    await waitFor(() => {
      expect(screen.getByRole('button', {name: /Aller au catalogue/i})).toBeInTheDocument();
    });
    // Set dates so the catalog availability API is triggered
    const dateInputs11 = screen.getAllByDisplayValue('').filter(el => el.getAttribute('type') === 'date');
    const timeInputs11 = screen.getAllByDisplayValue('').filter(el => el.getAttribute('type') === 'time');
    if (dateInputs11.length >= 2) {
      fireEvent.change(dateInputs11[0], { target: { value: '2026-08-01' } });
      fireEvent.change(dateInputs11[1], { target: { value: '2026-08-02' } });
    }
    if (timeInputs11.length >= 2) {
      fireEvent.change(timeInputs11[0], { target: { value: '08:00' } });
      fireEvent.change(timeInputs11[1], { target: { value: '20:00' } });
    }
    fireEvent.click(screen.getByRole('button', {name: /Aller au catalogue/i}));

    const inputs = await screen.findAllByPlaceholderText('0');
    expect(inputs[0]).toHaveAttribute('type', 'number');
    expect(inputs[0]).toHaveAttribute('min', '0');
    // The volet catalogue uses the inventory stock summary.
    expect(inputs[0]).toHaveAttribute('max', '100');

    // Type a quantity above the inventory maximum.
    fireEvent.change(inputs[0], { target: { value: '1500' } });
    expect(inputs[0]).toHaveValue(100);
    expect(screen.getByText('Maximum disponible : 100')).toBeInTheDocument();

    // Type < 0
    fireEvent.change(inputs[0], { target: { value: '-10' } });
    expect(inputs[0]).toHaveValue(0);
  });

  it('12. Package Hahitantsoa quantite ne depasse pas le disponible', async () => {
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    await waitFor(() => {
      expect(screen.getByText('Commencer par le volet')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Commencer par le volet'));
    fireEvent.click(screen.getByText('Hahitantsoa'));
    fireEvent.click(screen.getByRole('button', {name: /Continuer/i}));

    await waitFor(() => {
      expect(screen.getByTestId('client-select-CUST-001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('client-select-CUST-001'));
    fireEvent.click(screen.getByRole('button', {name: /Continuer/i}));

    // We are on details step. Choose article composition.
    await waitFor(() => {
      expect(screen.getByText('Location + logistique')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Location + logistique'));

    // The existing catalogue/package step is opened directly.
    // Set dates so the catalog availability API is triggered
    const dateInputs12 = screen.getAllByDisplayValue('').filter(el => el.getAttribute('type') === 'date');
    const timeInputs12 = screen.getAllByDisplayValue('').filter(el => el.getAttribute('type') === 'time');
    if (dateInputs12.length >= 2) {
      fireEvent.change(dateInputs12[0], { target: { value: '2026-08-01' } });
      fireEvent.change(dateInputs12[1], { target: { value: '2026-08-02' } });
    }
    if (timeInputs12.length >= 1) {
      expect(screen.getByDisplayValue('08:00')).toHaveValue('08:00');
      fireEvent.change(timeInputs12[0], { target: { value: '20:00' } });
    }
    fireEvent.click(screen.getByText(/Aller au catalogue/i));

    // Choose the real API package
    await waitFor(() => {
      expect(screen.getByText(/Package de test/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText(/Package de test/i));

    // Adjust package
    fireEvent.click(screen.getByText('Ajuster package'));

    const inputs = screen.getAllByPlaceholderText('0'); // articles inside package
    // The package editor uses the same inventory maximum.
    fireEvent.change(inputs[0], { target: { value: '1500' } });
    expect(inputs[0]).toHaveValue(100);
    expect(screen.getByText('Maximum disponible : 100')).toBeInTheDocument();
  });

  it('13. Affiche l\'écran de neutralisation pour quote/CUST-001', async () => {
    vi.useFakeTimers();
    render(<ReservationNewPage onNavigate={mockNavigate} param="quote/CUST-001" />);
    // The component uses setTimeout(() => onNavigate('customer', clientId), 0)
    // With fake timers, we need to advance timers for the setTimeout to fire
    await vi.advanceTimersByTimeAsync(0);
    expect(mockNavigate).toHaveBeenCalledWith('customer', 'CUST-001');
    vi.useRealTimers();
  });

  it('14. Affiche le breadcrumb contextuel et évite l\'écran initial pour CUST-001', async () => {
    localStorage.clear();
    render(<ReservationNewPage onNavigate={mockNavigate} param="CUST-001" />);

    await waitFor(() => {
      expect(screen.getByText(/Clients & Prospects/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Choix du volet métier/)).toBeInTheDocument();
    expect(screen.queryByText(/Comment voulez-vous commencer \?/)).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText(/Retour à la fiche Ando Rakoto/).length).toBeGreaterThan(0);
    });
    const btnRetour = screen.getAllByText(/Retour à la fiche Ando Rakoto/)[0];
    fireEvent.click(btnRetour);
    expect(mockNavigate).toHaveBeenCalledWith('customer', 'CUST-001');
  });

  it('15. ouvre directement le choix du volet avec un identifiant client API', async () => {
    const apiClientId = '7f4c2d9e-2f11-4b10-8a1c-2b4d5e6f7081';
    vi.mocked(getCustomers).mockResolvedValueOnce([
      { ...mockCustomersData[0], id: apiClientId },
      ...mockCustomersData.slice(1),
    ] as any);

    render(<ReservationNewPage onNavigate={mockNavigate} param={apiClientId} />);

    await waitFor(() => {
      expect(screen.getByText(/Choix du volet métier/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Comment voulez-vous commencer \?/)).not.toBeInTheDocument();
    expect(screen.getByText('Hahitantsoa')).toBeInTheDocument();
    expect(screen.getByText('Titan Rental')).toBeInTheDocument();
  });

  it('16. émet le proforma prospect Titan après création du brouillon et du PDF', async () => {
    render(<ReservationNewPage onNavigate={mockNavigate} param="prospect-proforma-t/CUST-001" />);

    await screen.findByText('Détails Location (Titan)');
    const dateInputs = screen.getAllByDisplayValue('').filter((element) => element.getAttribute('type') === 'date');
    const timeInputs = [screen.getByDisplayValue('08:00'), screen.getByDisplayValue('22:00')];
    fireEvent.change(dateInputs[0], { target: { value: '2026-08-01' } });
    fireEvent.change(dateInputs[1], { target: { value: '2026-08-02' } });
    fireEvent.change(timeInputs[0], { target: { value: '08:00' } });
    fireEvent.change(timeInputs[1], { target: { value: '20:00' } });
    fireEvent.click(screen.getByRole('button', { name: /Aller au catalogue/i }));
    await screen.findAllByPlaceholderText('0');
    fireEvent.click(screen.getByRole('button', { name: /Aller à la Livraison/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Vérifier le résumé/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Générer Devis\/Proforma/i }));
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: /Émettre le proforma/i }));

    await waitFor(() => {
      expect(createReservationDraftDocumentInstance).toHaveBeenCalledWith('DRAFT-001', {
        template_key: 'titan.proforma.v1',
        proforma_validity_days: 30,
      });
      expect(generateReservationDraftDocumentInstance).toHaveBeenCalledWith('DRAFT-001', 'DOC-T-001');
      expect(generateReservationDraftDocumentInstancePdf).toHaveBeenCalledWith('DRAFT-001', 'DOC-T-001');
    });
    expect(screen.getByText('Proforma émise avec succès')).toBeInTheDocument();
  });

  it('16. émet le proforma prospect Hahitantsoa sur un EventDraft', async () => {
    render(<ReservationNewPage onNavigate={mockNavigate} param="prospect-proforma-h/CUST-001" />);

    await screen.findByText('Détails Événement (Hahitantsoa)');
    const dateInputs = screen.getAllByDisplayValue('').filter((element) => element.getAttribute('type') === 'date');
    fireEvent.change(dateInputs[0], { target: { value: '2026-08-01' } });
    fireEvent.change(dateInputs[1], { target: { value: '2026-08-02' } });
    expect(screen.getByDisplayValue('08:00')).toHaveValue('08:00');
    fireEvent.click(screen.getByRole('button', { name: /Suivant \(Services\)/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Vérifier le résumé/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Générer Devis\/Proforma/i }));
    fireEvent.click(screen.getByRole('button', { name: /Émettre le proforma/i }));

    await waitFor(() => {
      expect(createHahitantsoaEventDraftDocumentInstance).toHaveBeenCalledWith('EVENT-001', {
        template_key: 'hahitantsoa.proforma.v1',
        proforma_validity_days: 15,
      });
      expect(generateHahitantsoaEventDraftDocumentInstance).toHaveBeenCalledWith('EVENT-001', 'DOC-H-001');
      expect(generateHahitantsoaEventDraftDocumentInstancePdf).toHaveBeenCalledWith('EVENT-001', 'DOC-H-001');
    });
  });

  it('17. reprend une émission prospect Titan après un échec PDF sans créer de doublon', async () => {
    vi.mocked(createReservationDraft).mockClear();
    vi.mocked(createReservationDraftDocumentInstance).mockClear();
    vi.mocked(generateReservationDraftDocumentInstance).mockClear();
    vi.mocked(generateReservationDraftDocumentInstancePdf).mockClear();
    vi.mocked(generateReservationDraftDocumentInstancePdf)
      .mockRejectedValueOnce(new Error('Le PDF ne peut pas être généré'))
      .mockResolvedValueOnce({ id: 'DOC-T-001' } as any);
    render(<ReservationNewPage onNavigate={mockNavigate} param="prospect-proforma-t/CUST-001" />);

    await screen.findByText('Détails Location (Titan)');
    const dateInputs = screen.getAllByDisplayValue('').filter((element) => element.getAttribute('type') === 'date');
    const timeInputs = [screen.getByDisplayValue('08:00'), screen.getByDisplayValue('22:00')];
    fireEvent.change(dateInputs[0], { target: { value: '2026-08-01' } });
    fireEvent.change(dateInputs[1], { target: { value: '2026-08-02' } });
    fireEvent.change(timeInputs[0], { target: { value: '08:00' } });
    fireEvent.change(timeInputs[1], { target: { value: '20:00' } });
    fireEvent.click(screen.getByRole('button', { name: /Aller au catalogue/i }));
    await screen.findAllByPlaceholderText('0');
    fireEvent.click(screen.getByRole('button', { name: /Aller à la Livraison/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Vérifier le résumé/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Générer Devis\/Proforma/i }));
    fireEvent.click(screen.getByRole('button', { name: /Émettre le proforma/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Le PDF ne peut pas être généré');
    fireEvent.click(screen.getByRole('button', { name: /Émettre le proforma/i }));

    await waitFor(() => {
      expect(createReservationDraft).toHaveBeenCalledTimes(1);
      expect(createReservationDraftDocumentInstance).toHaveBeenCalledTimes(1);
      expect(generateReservationDraftDocumentInstance).toHaveBeenCalledTimes(1);
      expect(generateReservationDraftDocumentInstancePdf).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByText('Proforma émise avec succès')).toBeInTheDocument();
  });

  it('18. Hahitantsoa envoie la formule nocturne canonique et permet la sélection par catégorie', async () => {
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    await waitFor(() => {
      expect(screen.getByText('Commencer par le volet')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Commencer par le volet'));
    fireEvent.click(screen.getByText('Hahitantsoa'));
    fireEvent.click(screen.getByText('Continuer'));

    await waitFor(() => {
      expect(screen.getByTestId('client-select-CUST-001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('client-select-CUST-001'));
    fireEvent.click(screen.getByText('Continuer'));

    // Details step: Select Option Nuit 1 (22h30)
    await screen.findByText('Formule horaire');
    const night1Radio = screen.getByLabelText(/Option 1/i);
    fireEvent.click(night1Radio);

    expect(screen.getByText('Sans sécurité nocturne.')).toBeInTheDocument();

    // Proceed to Services
    fireEvent.click(screen.getByText('Suivant (Services)'));
    await screen.findByText('Services Hahitantsoa');

    // Filter by Ciels Étoilés
    const starrySkyTab = screen.getByRole('button', { name: /Ciels Étoilés/i });
    fireEvent.click(starrySkyTab);
    expect(screen.getByText('Guinguette linéaire')).toBeInTheDocument();
    expect(screen.queryByText('Traiteur')).not.toBeInTheDocument();

    // Select Guinguette linéaire
    const selectBtn = screen.getByText('Guinguette linéaire').closest('.rounded-xl')!.querySelector('button')!;
    fireEvent.click(selectBtn);

    // Verify subtotal update
    expect(screen.getByText(/Total des Prestations Hahitantsoa/i)).toBeInTheDocument();
    expect(screen.getByText('100 000 Ar')).toBeInTheDocument();
  });

  it('19. formatHahitantsoaServiceNotes formate exhaustivement les prestations avec quantités et prix', () => {
    expect(formatHahitantsoaServiceNotes([])).toBeUndefined();

    const formatted = formatHahitantsoaServiceNotes([
      { id: '1', name: 'Guinguette linéaire', price: 200000, quantity: 2 },
      { id: '2', name: 'Ciel Étoilé LED', price: 500000, quantity: 1 },
      { id: '3', name: 'Sonorisation Standard', price: 300000 },
    ]);

    expect(formatted).toBe(
      'Guinguette linéaire (x2) - 200000 Ar\nCiel Étoilé LED - 500000 Ar\nSonorisation Standard - 300000 Ar'
    );
  });

  it('20. émet le proforma Hahitantsoa avec les prestations sélectionnées dans service_notes', async () => {
    vi.mocked(createHahitantsoaEventDraft).mockClear();
    vi.mocked(createHahitantsoaEventDraftDocumentInstance).mockClear();
    vi.mocked(createHahitantsoaEventDraft).mockResolvedValue({ id: 'EVENT-002', status: 'draft' } as any);
    vi.mocked(createHahitantsoaEventDraftDocumentInstance).mockResolvedValue({ id: 'DOC-H-002' } as any);

    render(<ReservationNewPage onNavigate={mockNavigate} param="prospect-proforma-h/CUST-001" />);

    await screen.findByText('Détails Événement (Hahitantsoa)');
    const dateInputs = screen.getAllByDisplayValue('').filter((element) => element.getAttribute('type') === 'date');
    fireEvent.change(dateInputs[0], { target: { value: '2026-08-01' } });
    fireEvent.change(dateInputs[1], { target: { value: '2026-08-02' } });

    // Go to Services
    fireEvent.click(screen.getByRole('button', { name: /Suivant \(Services\)/i }));
    await screen.findByText('Services Hahitantsoa');

    // Select Traiteur
    const traiteurSelectBtn = screen.getByText('Traiteur').closest('.rounded-xl')!.querySelector('button')!;
    fireEvent.click(traiteurSelectBtn);

    // Go to Summary
    fireEvent.click(screen.getByRole('button', { name: /Vérifier le résumé/i }));
    await screen.findByText('Résumé modifiable');

    // Go to Proforma
    fireEvent.click(screen.getByRole('button', { name: /Générer Devis\/Proforma/i }));
    await screen.findByText('Aperçu Proforma');

    // Click Emit
    fireEvent.click(screen.getByRole('button', { name: /Émettre le proforma/i }));

    await waitFor(() => {
      expect(createHahitantsoaEventDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_id: 'CUST-001',
          service_notes: 'Traiteur - 500000 Ar',
          duration_option: 'day',
        })
      );
      expect(createHahitantsoaEventDraftDocumentInstance).toHaveBeenCalledWith('EVENT-002', {
        template_key: 'hahitantsoa.proforma.v1',
        proforma_validity_days: 15,
      });
    });
  });

  it('20b. tague le type d’événement personnalisé dans les notes et le nom du draft quand événement Autre', async () => {
    vi.mocked(createHahitantsoaEventDraft).mockClear();
    vi.mocked(createHahitantsoaEventDraftDocumentInstance).mockClear();
    vi.mocked(createHahitantsoaEventDraft).mockResolvedValue({ id: 'EVENT-003', status: 'draft' } as any);
    vi.mocked(createHahitantsoaEventDraftDocumentInstance).mockResolvedValue({ id: 'DOC-H-003' } as any);

    render(<ReservationNewPage onNavigate={mockNavigate} param="prospect-proforma-h/CUST-001" />);

    await screen.findByText('Détails Événement (Hahitantsoa)');
    const dateInputs = screen.getAllByDisplayValue('').filter((element) => element.getAttribute('type') === 'date');
    if (dateInputs.length > 0) {
      fireEvent.change(dateInputs[0], { target: { value: '2026-10-15' } });
      fireEvent.change(dateInputs[1], { target: { value: '2026-10-16' } });
    }

    const selects = screen.getAllByRole('combobox');
    const eventTypeSelect = selects[0];
    fireEvent.change(eventTypeSelect, { target: { value: 'Autre' } });

    const customTypeInput = await screen.findByPlaceholderText("Préciser le type d'événement");
    fireEvent.change(customTypeInput, { target: { value: 'Gala Annuel de Charité' } });

    // Go to Services
    fireEvent.click(screen.getByRole('button', { name: /Suivant \(Services\)/i }));
    await screen.findByText('Services Hahitantsoa');

    // Go to Summary
    fireEvent.click(screen.getByRole('button', { name: /Vérifier le résumé/i }));
    await screen.findByText('Résumé modifiable');

    // Go to Proforma
    fireEvent.click(screen.getByRole('button', { name: /Générer Devis\/Proforma/i }));
    await screen.findByText('Aperçu Proforma');

    // Click Emit
    fireEvent.click(screen.getByRole('button', { name: /Émettre le proforma/i }));

    await waitFor(() => {
      expect(createHahitantsoaEventDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          customer_id: 'CUST-001',
          event_name: 'Gala Annuel de Charité',
          notes: expect.stringContaining("[Type d'événement: Gala Annuel de Charité]"),
        })
      );
    });
  });

  it('21. permet un versement supérieur à l’acompte minimum requis jusqu’au solde total', async () => {
    vi.mocked(recordConfirmedDeposit).mockClear();
    vi.mocked(recordConfirmedDeposit).mockResolvedValue({ payment: { id: 'PAY-OVER', receipt_document: { id: 'RECEIPT-OFFICIAL' } }, replayed: false } as any);

    render(<ReservationNewPage onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByText('Commencer par le volet')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Commencer par le volet'));
    fireEvent.click(screen.getByText('Titan Rental'));
    fireEvent.click(screen.getByText('Continuer'));

    await waitFor(() => {
      expect(screen.getByTestId('client-select-CUST-001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('client-select-CUST-001'));
    fireEvent.click(screen.getByText('Continuer'));

    await waitFor(() => {
      expect(screen.getByText('Détails Location (Titan)')).toBeInTheDocument();
    });
    const dateInputs21 = screen.getAllByDisplayValue('').filter((element) => element.getAttribute('type') === 'date');
    const timeInputs21 = screen.getAllByDisplayValue('').filter((element) => element.getAttribute('type') === 'time');
    if (dateInputs21.length >= 2) {
      fireEvent.change(dateInputs21[0], { target: { value: '2026-08-01' } });
      fireEvent.change(dateInputs21[1], { target: { value: '2026-08-02' } });
    }
    if (timeInputs21.length >= 2) {
      fireEvent.change(timeInputs21[0], { target: { value: '08:00' } });
      fireEvent.change(timeInputs21[1], { target: { value: '20:00' } });
    }
    fireEvent.click(screen.getByText('Aller au catalogue'));

    const inputs = await screen.findAllByPlaceholderText('0');
    fireEvent.change(inputs[0], { target: { value: '50' } });
    fireEvent.click(screen.getByText('Aller à la Livraison'));

    await waitFor(() => {
      expect(screen.getByText('Vérifier le résumé')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Vérifier le résumé'));

    await waitFor(() => {
      expect(screen.getByText('Générer Devis/Proforma')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Générer Devis/Proforma'));

    await waitFor(() => {
      expect(screen.getByText('Aperçu Proforma')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Passer au paiement'));

    // Payment step
    await waitFor(() => {
      expect(screen.getByText('Acompte / Paiement')).toBeInTheDocument();
    });
    expect(screen.getByText(/Acompte contractuel Titan/)).toBeInTheDocument();
    const paymentInput = screen.getByLabelText(/Montant de ce paiement \(Ar\)/i) as HTMLInputElement;

    // Enter an amount higher than the minimum required deposit (e.g., 400 000)
    fireEvent.change(paymentInput, { target: { value: '400000' } });

    const submitPaymentBtn = screen.getByRole('button', { name: /Enregistrer le versement & continuer/i });
    expect(submitPaymentBtn).not.toBeDisabled();
    fireEvent.click(submitPaymentBtn);

    await waitFor(() => {
      expect(recordConfirmedDeposit).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: '400000.00',
        })
      );
    });
    const receipt = await screen.findByTitle('Reçu officiel de paiement');
    expect(receipt.closest('details')).toHaveAttribute('open');
    expect(getDocumentArtifactHtml).toHaveBeenCalledWith('RECEIPT-OFFICIAL', expect.any(AbortSignal));
    expect(recordConfirmedDeposit).toHaveBeenCalledTimes(1);
  });

  it('22. étape Date & disponibilité Hahitantsoa affiche le récapitulatif des choix et ne propose plus d\'input de tarif de base', async () => {
    render(<ReservationNewPage onNavigate={mockNavigate} param="hahitantsoa" />);

    // Step 2 is client selection in domain_first mode
    await waitFor(() => {
      expect(screen.getByText('Sélection ou création du client')).toBeInTheDocument();
    });

    // Select existing client
    fireEvent.click(screen.getByTestId('client-select-CUST-001'));
    fireEvent.click(screen.getByText('Continuer'));

    // Step 3: Date & disponibilité
    await waitFor(() => {
      expect(screen.getByText('Détails Événement (Hahitantsoa)')).toBeInTheDocument();
    });

    // Verify there is NO editable input for "Tarif de base" / "Prix location local"
    expect(screen.queryByLabelText(/Prix location local/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Tarif logistique/i)).not.toBeInTheDocument();

    // Verify the recap card is present with step choices and only the total
    expect(screen.getByText(/Récapitulatif des choix de l'étape :/i)).toBeInTheDocument();
    expect(screen.getByText(/^Total$/i)).toBeInTheDocument();
    expect(screen.queryByText(/Tarif de base local :/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Option logistique :/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Invités supp\./i)).not.toBeInTheDocument();
  });

  it('23. propose le choix entre reprendre le parcours en cours et nouvelle réservation lorsqu\'un brouillon existe', async () => {
    const draftData = {
      path: 'domain_first',
      step: 3,
      maxReachedStep: 3,
      domain: 'hahitantsoa',
      selectedClientId: 'CUST-001',
      hDetails: {
        eventType: 'Mariage',
        venue: 'Salle des fêtes + jardin',
        startDate: '2026-11-20',
        rentalType: 'Location nue',
        durationOption: 'day',
      },
    };
    localStorage.setItem('prototypeReservationDraft', JSON.stringify(draftData));

    render(<ReservationNewPage onNavigate={mockNavigate} param="hahitantsoa" />);

    // Check prompt appears
    expect(await screen.findByText('Parcours de réservation en cours')).toBeInTheDocument();
    expect(screen.getByText(/Un parcours de réservation est déjà commencé pour un événement Hahitantsoa/i)).toBeInTheDocument();

    // Verify both action buttons are present
    const newReservationBtn = screen.getByRole('button', { name: /Nouvelle réservation/i });
    const resumeDraftBtn = screen.getByRole('button', { name: /Reprendre le secours local de cet appareil/i });
    expect(newReservationBtn).toBeInTheDocument();
    expect(resumeDraftBtn).toBeInTheDocument();

    // Clicking "Nouvelle réservation" clears the draft and starts fresh
    fireEvent.click(newReservationBtn);
    expect(localStorage.getItem('prototypeReservationDraft')).toBeNull();
    expect(screen.queryByText('Parcours de réservation en cours')).not.toBeInTheDocument();
    expect(await screen.findByText('Sélection ou création du client')).toBeInTheDocument();
  });

  it('24. resolveHahitantsoaEventName résout correctement les personnes concernées selon le type d’événement', () => {
    // Wedding with both names
    expect(
      resolveHahitantsoaEventName({
        eventType: 'Mariage',
        mariageGroomName: 'Jean',
        mariageBrideName: 'Jeanne',
        date: '',
        venue: '',
        guests: '',
        remarks: '',
        startDate: '',
        startTime: '',
        endDate: '',
        endTime: '',
        rentalType: '',
        durationOption: 'day',
        venuePrice: 0,
        logisticsPrice: 0,
      })
    ).toBe('Jean & Jeanne');

    // Wedding with only groom
    expect(
      resolveHahitantsoaEventName({
        eventType: 'Mariage',
        mariageGroomName: 'Jean',
        date: '',
        venue: '',
        guests: '',
        remarks: '',
        startDate: '',
        startTime: '',
        endDate: '',
        endTime: '',
        rentalType: '',
        durationOption: 'day',
        venuePrice: 0,
        logisticsPrice: 0,
      })
    ).toBe('Jean');

    // Engagement
    expect(
      resolveHahitantsoaEventName({
        eventType: 'Fiançailles',
        fiancaillesPerson1: 'Paul',
        fiancaillesPerson2: 'Marie',
        date: '',
        venue: '',
        guests: '',
        remarks: '',
        startDate: '',
        startTime: '',
        endDate: '',
        endTime: '',
        rentalType: '',
        durationOption: 'day',
        venuePrice: 0,
        logisticsPrice: 0,
      })
    ).toBe('Paul & Marie');

    // Baptism
    expect(
      resolveHahitantsoaEventName({
        eventType: 'Baptême',
        baptemeChildName: 'Lucas',
        date: '',
        venue: '',
        guests: '',
        remarks: '',
        startDate: '',
        startTime: '',
        endDate: '',
        endTime: '',
        rentalType: '',
        durationOption: 'day',
        venuePrice: 0,
        logisticsPrice: 0,
      })
    ).toBe('Lucas');

    // Other with referent
    expect(
      resolveHahitantsoaEventName({
        eventType: 'Anniversaire',
        otherReferentName: 'Fête de Sophie',
        date: '',
        venue: '',
        guests: '',
        remarks: '',
        startDate: '',
        startTime: '',
        endDate: '',
        endTime: '',
        rentalType: '',
        durationOption: 'day',
        venuePrice: 0,
        logisticsPrice: 0,
      })
    ).toBe('Fête de Sophie');

    // Fallback to customer name
    expect(
      resolveHahitantsoaEventName(
        {
          eventType: 'Anniversaire',
          date: '',
          venue: '',
          guests: '',
          remarks: '',
          startDate: '',
          startTime: '',
          endDate: '',
          endTime: '',
          rentalType: '',
          durationOption: 'day',
          venuePrice: 0,
          logisticsPrice: 0,
        },
        'Société ABC'
      )
    ).toBe('Société ABC');
  });

  it('25. charge un brouillon Titan existant via edit-titan/:id, pré-remplit les matériels et dates, et stoppe à l\'étape Proforma', async () => {
    vi.mocked(getReservationDraft).mockResolvedValue({
      id: 'DRAFT-TITAN-100',
      customer_id: 'CUST-001',
      public_reference: 'T-100/2026',
      status: 'draft',
      start_at: '2026-08-10T08:00:00Z',
      end_at: '2026-08-12T20:00:00Z',
      notes: 'Usage standard - Destination 1',
      delivery_fee: '50000.00',
      discount_amount: '20000.00',
      discount_reason: 'Geste commercial',
      lines: [
        {
          inventory_item_id: 'MAT-01',
          inventory_item_name: 'Chaise Napoléon transparente',
          quantity: 20,
          unit_rental_price: '10000.00',
        },
      ],
    } as any);

    vi.mocked(updateReservationDraft).mockResolvedValue({
      id: 'DRAFT-TITAN-100',
      status: 'draft',
    } as any);

    vi.mocked(createReservationDraftDocumentInstance).mockResolvedValue({
      id: 'DOC-TITAN-REV2',
      document_reference: 'T-100/2026-rev2',
    } as any);

    render(<ReservationNewPage onNavigate={mockNavigate} param="edit-titan/DRAFT-TITAN-100" />);

    // Breadcrumb and header in edit mode
    expect(await screen.findByText('Modification du devis / proforma')).toBeInTheDocument();
    expect(screen.getByText('Mode modification du devis proforma')).toBeInTheDocument();
    expect(screen.getByText('Vérification & Proforma')).toBeInTheDocument();

    // Verify dates pre-filled at Step 3
    expect(screen.getByDisplayValue('2026-08-10')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2026-08-12')).toBeInTheDocument();

    // Advance to step 4 (Catalog/Materials)
    fireEvent.click(screen.getByRole('button', { name: /Aller au catalogue/i }));
    await screen.findAllByPlaceholderText('0');
    // Pre-filled quantity 20 for Chaise Napoléon
    expect(screen.getByDisplayValue('20')).toBeInTheDocument();

    // Advance to step 5 (Logistics)
    fireEvent.click(screen.getByRole('button', { name: /Aller à la Livraison/i }));
    expect(await screen.findByDisplayValue('50000')).toBeInTheDocument();

    // Advance to step 6 (Summary)
    fireEvent.click(screen.getByRole('button', { name: /Vérifier le résumé/i }));
    // Step 6 has 'Continuer vers le Proforma' button
    const toProformaBtn = await screen.findByRole('button', { name: /Continuer vers le Proforma/i });
    expect(toProformaBtn).toBeInTheDocument();
    fireEvent.click(toProformaBtn);

    // Step 7: Proforma
    expect(await screen.findByText('Enregistrement & émission de la nouvelle révision')).toBeInTheDocument();
    const emitRevBtn = screen.getByRole('button', { name: /Émettre la nouvelle révision/i });
    expect(emitRevBtn).toBeInTheDocument();
    fireEvent.click(emitRevBtn);

    // After emission, revision card is shown with return button
    expect(await screen.findByText(/Nouvelle révision du proforma émise avec succès/i)).toBeInTheDocument();
    const returnDossierBtn = screen.getByRole('button', { name: /Valider et retourner au dossier/i });
    expect(returnDossierBtn).toBeInTheDocument();
    fireEvent.click(returnDossierBtn);

    expect(mockNavigate).toHaveBeenCalledWith('reservation-detail', 'DRAFT-TITAN-100');
  });

  it('26. charge un brouillon Hahitantsoa existant via edit-hahitantsoa/:id avec prestations, émet une révision et propose le retour au dossier', async () => {
    vi.mocked(getHahitantsoaEventDraft).mockResolvedValue({
      id: 'EVENT-HAH-200',
      customer_id: 'CUST-001',
      public_reference: 'HAH-200/2026',
      status: 'draft',
      start_at: '2026-09-01T13:00:00Z',
      end_at: '2026-09-01T23:00:00Z',
      event_type: 'wedding',
      venue_name: 'Salle des fêtes + jardin',
      guest_count: 150,
      rental_type: 'bare',
      duration_option: 'day',
      service_notes: 'PRESTATIONS PARTICULIÈRES :\n- Traiteur : 150 pax (total : 75 000 000 Ar)\n- Guinguette linéaire : 5 ligne(s) (total : 500 000 Ar)',
      lines: [
        {
          inventory_item_id: 'MAT-02',
          inventory_item_name: 'Table rectangulaire',
          quantity: 15,
          unit_rental_price: '20000.00',
        },
      ],
    } as any);

    vi.mocked(updateHahitantsoaEventDraft).mockResolvedValue({
      id: 'EVENT-HAH-200',
      status: 'draft',
    } as any);

    vi.mocked(createHahitantsoaEventDraftDocumentInstance).mockResolvedValue({
      id: 'DOC-HAH-REV2',
      document_reference: 'HAH-200/2026-rev2',
    } as any);

    render(<ReservationNewPage onNavigate={mockNavigate} param="edit-hahitantsoa/EVENT-HAH-200" />);

    expect(await screen.findByText('Modification du devis / proforma')).toBeInTheDocument();
    expect(screen.getByText('Dossier HAH-200/2026')).toBeInTheDocument();

    // Step 3 (Hahitantsoa dates)
    expect(screen.getAllByDisplayValue('2026-09-01').length).toBeGreaterThanOrEqual(1);

    // Advance to step 5 (Services - Location nue skips catalog)
    fireEvent.click(screen.getByRole('button', { name: /Suivant \(Services\)/i }));
    expect(await screen.findByText('Services Hahitantsoa')).toBeInTheDocument();

    // Advance to step 6 (Summary)
    fireEvent.click(screen.getByRole('button', { name: /Vérifier le résumé/i }));
    const toProformaBtn = await screen.findByRole('button', { name: /Continuer vers le Proforma/i });
    fireEvent.click(toProformaBtn);

    // Step 7: Emit revision
    const emitRevBtn = await screen.findByRole('button', { name: /Émettre la nouvelle révision/i });
    fireEvent.click(emitRevBtn);

    expect(await screen.findByText(/Nouvelle révision du proforma émise avec succès/i)).toBeInTheDocument();
    const returnDossierBtn = screen.getByRole('button', { name: /Valider et retourner au dossier/i });
    fireEvent.click(returnDossierBtn);

    expect(mockNavigate).toHaveBeenCalledWith('reservation-detail', 'hahitantsoa:EVENT-HAH-200');
  });

  it('27. refuse la modification d\'un brouillon Titan déjà confirmé', async () => {
    vi.mocked(getReservationDraft).mockResolvedValue({
      id: 'DRAFT-TITAN-CONFIRMED',
      customer_id: 'CUST-001',
      public_reference: 'T-CONFIRMED/2026',
      status: 'confirmed',
      contract_signed_at: '2026-08-01T10:00:00Z',
      lines: [],
    } as any);

    render(<ReservationNewPage onNavigate={mockNavigate} param="edit-titan/DRAFT-TITAN-CONFIRMED" />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /Ce dossier Titan est déjà confirmé/i
    );
  });

  it('28. affiche strictement 500 000 Ar pour la caution obligatoire Hahitantsoa et distingue l\'acompte (Article 5 vs Article 7)', async () => {
    render(<ReservationNewPage onNavigate={mockNavigate} param="prospect-proforma-h/CUST-001" />);

    await screen.findByText('Détails Événement (Hahitantsoa)');
    // Check initial rental type is "Location nue"
    const bareRadio = screen.getByLabelText('Location nue') as HTMLInputElement;
    expect(bareRadio.checked).toBe(true);

    const dateInputs = screen.getAllByDisplayValue('').filter((element) => element.getAttribute('type') === 'date');
    fireEvent.change(dateInputs[0], { target: { value: '2026-08-01' } });
    fireEvent.change(dateInputs[1], { target: { value: '2026-08-02' } });

    // Step 2 -> Step 3 (Services)
    fireEvent.click(screen.getByRole('button', { name: /Suivant \(Services\)/i }));

    // Step 3 -> Step 4 (Résumé)
    fireEvent.click(await screen.findByRole('button', { name: /Vérifier le résumé/i }));

    // In summary, verify Acompte vs Caution (Dépôt de garantie)
    await waitFor(() => {
      expect(screen.getByText('Acompte à la réservation (Validation)')).toBeInTheDocument();
    });
    expect(screen.getByText('1 000 000 Ar')).toBeInTheDocument();
    expect(screen.getByText('Caution obligatoire (Dépôt de garantie)')).toBeInTheDocument();
    expect(screen.getByText('500 000 Ar')).toBeInTheDocument();

    // Go to Proforma step
    fireEvent.click(await screen.findByRole('button', { name: /Générer Devis\/Proforma/i }));

    // Proforma preview -> Payment step
    await waitFor(() => {
      expect(screen.getByText('Aperçu Proforma')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Passer au paiement'));

    // In Payment step:
    await waitFor(() => {
      expect(screen.getByText('Acompte / Paiement')).toBeInTheDocument();
    });

    // The heading "Caution obligatoire" must strictly display 500 000 Ar, NEVER 1 000 000 or 1 500 000 Ar!
    const cautionHeading = screen.getByRole('heading', { level: 4, name: 'Caution obligatoire' });
    const cautionContainer = cautionHeading.closest('div.bg-orange-50');
    expect(cautionContainer).toHaveTextContent('500 000 Ar');
    expect(cautionContainer).not.toHaveTextContent('1 000 000 Ar');
    expect(cautionContainer).not.toHaveTextContent('1 500 000 Ar');

    // And "Acompte contractuel" must display 1 000 000 Ar (Article 5 for Location nue)
    expect(screen.getByText(/1 000 000 Ar — payable à la réservation/)).toBeInTheDocument();
  });

  it('29. affiche un aperçu complet des documents contractuels (Contrat + Décharge) avec cartes de synthèse et guidance', async () => {
    render(<ReservationNewPage onNavigate={mockNavigate} param="prospect-proforma-h/CUST-001" />);

    await screen.findByText('Détails Événement (Hahitantsoa)');

    const dateInputs = screen.getAllByDisplayValue('').filter((element) => element.getAttribute('type') === 'date');
    fireEvent.change(dateInputs[0], { target: { value: '2026-08-01' } });
    fireEvent.change(dateInputs[1], { target: { value: '2026-08-02' } });

    // Step 2 -> Step 3 (Services)
    fireEvent.click(screen.getByRole('button', { name: /Suivant \(Services\)/i }));

    // Step 3 -> Step 4 (Résumé)
    fireEvent.click(await screen.findByRole('button', { name: /Vérifier le résumé/i }));

    // Go to Proforma step
    fireEvent.click(await screen.findByRole('button', { name: /Générer Devis\/Proforma/i }));

    // Proforma preview -> Payment step
    await waitFor(() => {
      expect(screen.getByText('Aperçu Proforma')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Passer au paiement'));

    // Payment step: Record payment and proceed to contract preview
    await waitFor(() => {
      expect(screen.getByText('Acompte / Paiement')).toBeInTheDocument();
    });
    const paymentInput = screen.getByLabelText(/Montant de ce paiement \(Ar\)/i) as HTMLInputElement;
    fireEvent.change(paymentInput, { target: { value: '1000000' } });

    const submitPaymentBtn = screen.getByRole('button', { name: /Enregistrer le versement & continuer/i });
    fireEvent.click(submitPaymentBtn);

    // Step 9: Contract preview
    await waitFor(() => {
      expect(screen.getByText('Aperçu Contrat')).toBeInTheDocument();
    });

    // Check header badges & reference
    expect(screen.getByText('Prêt pour contractualisation')).toBeInTheDocument();
    expect(screen.getByText(/Réf\. prévue :/)).toBeInTheDocument();

    // Check financial executive summary cards
    expect(screen.getByText('Total TTC')).toBeInTheDocument();
    expect(screen.getByText('Acompte enregistré')).toBeInTheDocument();
    expect(screen.getByText('Solde restant')).toBeInTheDocument();
    expect(screen.getByText('Caution obligatoire')).toBeInTheDocument();

    // Check document tabs for Hahitantsoa (Contrat + Décharge)
    const contractTab = screen.getByRole('button', { name: /Contrat de location/i });
    const dischargeTab = screen.getByRole('button', { name: /Décharge de responsabilité/i });
    expect(contractTab).toBeInTheDocument();
    expect(dischargeTab).toBeInTheDocument();

    // Switch to discharge tab
    fireEvent.click(dischargeTab);

    // Guidance text
    expect(screen.getByText('Génération officielle & confirmation du dossier')).toBeInTheDocument();

    // Submit / generate contract and open file
    const generateBtn = screen.getByRole('button', { name: /Générer le contrat et ouvrir le dossier/i });
    expect(generateBtn).toBeInTheDocument();
    fireEvent.click(generateBtn);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('reservation-detail', 'hahitantsoa:EVENT-001');
    });
  });

  it('30. sélectionne dynamiquement le local marqué par défaut (is_default) par le serveur', async () => {
    vi.mocked(getHahitantsoaVenues).mockResolvedValueOnce([
      {
        id: 'VEN-099',
        name: 'Grand Chapiteau Panoramique',
        type: 'location_event',
        capacity: 500,
        active: true,
        price: 2500000,
        is_default: true,
      },
    ] as any);

    render(<ReservationNewPage onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByText('Commencer par le volet')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Commencer par le volet'));
    fireEvent.click(screen.getByText('Hahitantsoa'));
    fireEvent.click(screen.getByText('Continuer'));

    await waitFor(() => {
      expect(screen.getByTestId('client-select-CUST-001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('client-select-CUST-001'));
    fireEvent.click(screen.getByText('Continuer'));

    // Verify dynamic default venue is selected and labeled as default
    await waitFor(() => {
      expect(screen.getByText(/Local par défaut : Grand Chapiteau Panoramique/i)).toBeInTheDocument();
    });
  });

  it('31. conserve le client malgré une panne tarifaire et bloque seulement les étapes tarifées', async () => {
    vi.mocked(getHahitantsoaCommercialTerms).mockRejectedValueOnce(new Error('Erreur réseau tarifs'));
    render(<ReservationNewPage onNavigate={mockNavigate} param="hahitantsoa" />);
    fireEvent.click(await screen.findByTestId('client-select-CUST-001'));
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(await screen.findByText('Détails Événement (Hahitantsoa)')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Date début événement'), { target: { value: '2027-11-20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Suivant (Services)' }));
    expect(await screen.findByText(/les conditions tarifaires officielles n'ont pas pu être chargées/i)).toBeInTheDocument();
    expect(screen.getByText('Détails Événement (Hahitantsoa)')).toBeInTheDocument();
  });

  it('32. affiche une alerte avec bouton de réessai dans le formulaire si getHahitantsoaVenues échoue', async () => {
    vi.mocked(getHahitantsoaVenues).mockRejectedValueOnce(new Error('Erreur de connexion aux locaux'));

    render(<ReservationNewPage onNavigate={mockNavigate} />);

    await waitFor(() => {
      expect(screen.getByText('Commencer par le volet')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Commencer par le volet'));
    fireEvent.click(screen.getByText('Hahitantsoa'));
    fireEvent.click(screen.getByText('Continuer'));

    await waitFor(() => {
      expect(screen.getByTestId('client-select-CUST-001')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('client-select-CUST-001'));
    fireEvent.click(screen.getByText('Continuer'));

    // Venue section should display the error with retry button instead of silent 'aucun local'
    await waitFor(() => {
      expect(screen.getByText(/Erreur de chargement des locaux : Erreur de connexion aux locaux/i)).toBeInTheDocument();
    });
    expect(screen.getAllByRole('button', { name: 'Réessayer' }).length).toBeGreaterThan(0);
  });

  it("bloque une composition invalide dès les détails et conserve la composition du brouillon repris", async () => {
    localStorage.setItem('prototypeReservationDraft', JSON.stringify({ step: 3, maxReachedStep: 3, domain: 'hahitantsoa', path: 'client_first', selectedClientId: 'CUST-001', hDetails: { rentalType: 'Location nue', startDate: '2027-11-20', endDate: '2027-11-20', startTime: '08:00', endTime: '20:00', bareRentalComposition: [{ label: 'Salle personnalisée', quantity: 0 }] } }));
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    fireEvent.click(await screen.findByRole('button', { name: /Reprendre le secours local de cet appareil/i }));
    expect(await screen.findByDisplayValue('Salle personnalisée')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Suivant \(Services\)/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Composition de la location nue');
    expect(createHahitantsoaEventDraft).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Quantité 1'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: /Suivant \(Services\)/i }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  });

  it("affiche la composition de la location nue en mode Location + logistique et dans le récapitulatif", async () => {
    localStorage.setItem('prototypeReservationDraft', JSON.stringify({
      step: 3,
      maxReachedStep: 6,
      domain: 'hahitantsoa',
      path: 'client_first',
      selectedClientId: 'CUST-001',
      hDetails: {
        rentalType: 'Location + logistique',
        startDate: '2027-11-20',
        endDate: '2027-11-20',
        startTime: '08:00',
        endTime: '20:00',
        venue: 'Salle des fêtes + jardin',
        bareRentalComposition: [
          { label: 'Salle prestige', quantity: 1 },
          { label: 'Chaises dorées', quantity: 50 },
        ],
      },
    }));
    const { unmount } = render(<ReservationNewPage onNavigate={mockNavigate} />);
    fireEvent.click(await screen.findByRole('button', { name: /Reprendre le secours local de cet appareil/i }));
    // Step 3 shows BareRentalCompositionEditor even in Location + logistique mode
    expect(await screen.findByDisplayValue('Salle prestige')).toBeInTheDocument();
    expect(screen.getByDisplayValue('50')).toBeInTheDocument();
    unmount();

    // Verify Step 6 (Summary)
    localStorage.setItem('prototypeReservationDraft', JSON.stringify({
      step: 6,
      maxReachedStep: 6,
      domain: 'hahitantsoa',
      path: 'client_first',
      selectedClientId: 'CUST-001',
      hDetails: {
        rentalType: 'Location + logistique',
        startDate: '2027-11-20',
        endDate: '2027-11-20',
        startTime: '08:00',
        endTime: '20:00',
        venue: 'Salle des fêtes + jardin',
        bareRentalComposition: [
          { label: 'Salle prestige', quantity: 1 },
          { label: 'Chaises dorées', quantity: 50 },
        ],
      },
    }));
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    fireEvent.click(await screen.findByRole('button', { name: /Reprendre le secours local de cet appareil/i }));

    // Step 6 shows composition under Location nue
    expect(await screen.findByText('Composition de la location nue :')).toBeInTheDocument();
    expect(screen.getByText('Salle prestige')).toBeInTheDocument();
    expect(screen.getByText('050 Chaises dorées')).toBeInTheDocument();
  });

  it("33. Lot 6: permet un saut direct vers l'étape Proforma depuis le mode modification de devis sans valider chaque étape intermédiaire", async () => {
    vi.mocked(getReservationDraft).mockResolvedValue({
      id: 'DRAFT-TITAN-100',
      customer_id: 'CUST-001',
      public_reference: 'T-100/2026',
      status: 'draft',
      start_at: '2026-08-10T08:00:00Z',
      end_at: '2026-08-12T20:00:00Z',
      delivery_fee: '50000.00',
      discount_amount: '0.00',
      lines: [
        {
          inventory_item_id: 'MAT-01',
          inventory_item_name: 'Chaise Napoléon',
          quantity: 20,
          unit_rental_price: '5000.00',
        },
      ],
    } as any);

    vi.mocked(updateReservationDraft).mockResolvedValue({
      id: 'DRAFT-TITAN-100',
      status: 'draft',
    } as any);

    vi.mocked(createReservationDraftDocumentInstance).mockResolvedValue({
      id: 'DOC-TITAN-REV3',
      document_reference: 'T-100/2026-rev3',
    } as any);

    render(<ReservationNewPage onNavigate={mockNavigate} param="edit-titan/DRAFT-TITAN-100" />);

    // Breadcrumb and header in edit mode
    expect(await screen.findByText('Modification du devis / proforma')).toBeInTheDocument();
    expect(screen.getByText('Mode modification du devis proforma')).toBeInTheDocument();

    // From Step 3, jump directly to Step 7 (Proforma) without passing through steps 4, 5, 6
    const jumpBtn = screen.getByTestId('jump-to-proforma-step-btn');
    expect(jumpBtn).toBeInTheDocument();
    fireEvent.click(jumpBtn);

    // Step 7 Proforma should immediately be displayed
    expect(await screen.findByText('Enregistrement & émission de la nouvelle révision')).toBeInTheDocument();
    const emitRevBtn = screen.getByRole('button', { name: /Émettre la nouvelle révision/i });
    expect(emitRevBtn).toBeInTheDocument();
    fireEvent.click(emitRevBtn);

    expect(await screen.findByText(/Nouvelle révision du proforma émise avec succès/i)).toBeInTheDocument();
    const returnDossierBtn = screen.getByRole('button', { name: /Valider et retourner au dossier/i });
    expect(returnDossierBtn).toBeInTheDocument();
    fireEvent.click(returnDossierBtn);

    expect(mockNavigate).toHaveBeenCalledWith('reservation-detail', 'DRAFT-TITAN-100');
  });
  it.each(['Nouveau client', '+ Créer un nouveau client'])('crée B avec son propre identifiant après A et le retour par %s', async (newClientEntry) => {
    vi.mocked(createCustomer)
      .mockResolvedValueOnce({ ...mockCustomersData[0], id: 'SERVER-CLIENT-A', display_name: 'Client A' } as never)
      .mockResolvedValueOnce({ ...mockCustomersData[0], id: 'SERVER-CLIENT-B', display_name: 'Client B' } as never);
    render(<ReservationNewPage onNavigate={mockNavigate} param="titan" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Nouveau client' }));
    fireEvent.change(screen.getByPlaceholderText('Ex: Jean Dupont'), { target: { value: 'Client A' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(await screen.findByText('Détails Location (Titan)')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('prototypeReservationDraft')!).selectedClientId).toBe('SERVER-CLIENT-A');
    fireEvent.click(screen.getByRole('button', { name: 'Retour' }));
    fireEvent.click(await screen.findByRole('button', { name: newClientEntry }));
    expect(screen.getByPlaceholderText('Ex: Jean Dupont')).toHaveValue('');
    fireEvent.change(screen.getByPlaceholderText('Ex: Jean Dupont'), { target: { value: 'Client B' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(await screen.findByText('Détails Location (Titan)')).toBeInTheDocument();
    expect(createCustomer).toHaveBeenCalledTimes(2);
    expect(createCustomer).toHaveBeenNthCalledWith(2, expect.objectContaining({ display_name: 'Client B' }));
    const creationKeys = vi.mocked(createCustomer).mock.calls.map(([payload]) => payload.idempotency_key);
    expect(creationKeys.every(key => typeof key === 'string' && key.length > 0)).toBe(true);
    expect(new Set(creationKeys).size).toBe(2);
    expect(JSON.parse(localStorage.getItem('prototypeReservationDraft')!).selectedClientId).toBe('SERVER-CLIENT-B');
  });

  it('sauvegarde un nouveau client Hahitantsoa même si les tarifs sont indisponibles', async () => {
    vi.mocked(getHahitantsoaCommercialTerms).mockRejectedValueOnce(new Error('Tarifs indisponibles'));
    vi.mocked(createCustomer).mockResolvedValueOnce({ ...mockCustomersData[0], id: 'SERVER-CLIENT-INDEPENDENT', display_name: 'Client indépendant' } as never);
    render(<ReservationNewPage onNavigate={mockNavigate} param="hahitantsoa" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Nouveau client' }));
    fireEvent.change(screen.getByPlaceholderText('Ex: Jean Dupont'), { target: { value: 'Client indépendant' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(await screen.findByText('Détails Événement (Hahitantsoa)')).toBeInTheDocument();
    expect(createCustomer).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem('prototypeReservationDraft')!).selectedClientId).toBe('SERVER-CLIENT-INDEPENDENT');
    expect(createHahitantsoaEventDraft).not.toHaveBeenCalled();
  });

  it('valide et sauvegarde la correction client avant un saut vers une étape déjà atteinte', async () => {
    localStorage.setItem('prototypeReservationDraft', JSON.stringify({ path: 'domain_first', domain: 'titan', step: 2, maxReachedStep: 6, clientMode: 'existing', selectedClientId: 'CUST-001', isEditingClient: true, newClient: { name: '', phone: '', email: '', notes: '', type: 'Particulier' } }));
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    fireEvent.click(await screen.findByRole('button', { name: /Reprendre le secours local de cet appareil/i }));
    const jump = await screen.findByRole('button', { name: /Vérification & documents/i });
    fireEvent.click(jump);
    expect(await screen.findByText(/Sélectionnez un client ou renseignez son nom\./)).toBeInTheDocument();
    expect(updateCustomer).not.toHaveBeenCalled();
    fireEvent.change(screen.getByPlaceholderText('Ex: Jean Dupont'), { target: { value: 'Client corrigé' } });
    vi.mocked(updateCustomer).mockRejectedValueOnce(new Error('Enregistrement impossible'));
    fireEvent.click(jump);
    expect(await screen.findByText(/Enregistrement impossible/)).toBeInTheDocument();
    expect(screen.getByText('Sélection ou création du client')).toBeInTheDocument();
    vi.mocked(updateCustomer).mockResolvedValueOnce({ ...mockCustomersData[0], display_name: 'Client corrigé' } as never);
    fireEvent.click(jump);
    expect(await screen.findByText('Résumé modifiable')).toBeInTheDocument();
    expect(updateCustomer).toHaveBeenLastCalledWith('CUST-001', expect.objectContaining({ display_name: 'Client corrigé' }));
    expect(createCustomer).not.toHaveBeenCalled();
  });

  it.each(['titan', 'hahitantsoa'])('reprend un brouillon %s aux dates incomplètes sans requête de disponibilité invalide', async (domain) => {
    const field = domain === 'titan' ? 'tDetails' : 'hDetails';
    localStorage.setItem('prototypeReservationDraft', JSON.stringify({ path: 'domain_first', domain, step: 3, maxReachedStep: 3, clientMode: 'existing', selectedClientId: 'CUST-001', [field]: { eventType: 'Mariage', rentalType: 'Location nue', venue: 'Salle des fêtes + jardin', startDate: '2027-11-', endDate: '2027-02-30', startTime: '08:00', endTime: '20:00' } }));
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    fireEvent.click(await screen.findByRole('button', { name: /Reprendre le secours local de cet appareil/i }));
    expect(await screen.findByText(/Corrigez les dates incomplètes du brouillon/)).toBeInTheDocument();
    expect(screen.getByLabelText(domain === 'titan' ? 'Date début de location' : 'Date début événement')).toHaveValue('');
    expect(getReservationAvailabilitySummary).not.toHaveBeenCalled();
    expect(getReservationAvailableItemPreviews).not.toHaveBeenCalled();
    expect(screen.queryByText(/Invalid time value/)).not.toBeInTheDocument();
  });

  it('masque les mariés pour une entreprise et utilise sa raison sociale malgré les anciens noms', async () => {
    vi.mocked(getCustomers).mockResolvedValue([{ ...mockCustomersData[0], id: 'COMPANY-1', party_type: 'company', display_name: 'Entreprise Test' }] as never);
    const hDetails = { eventType: 'Mariage', mariageGroomName: 'Ancien marié', mariageBrideName: 'Ancienne mariée', rentalType: 'Location nue', venue: 'Salle des fêtes + jardin', startDate: '2027-11-20', endDate: '2027-11-20', startTime: '08:00', endTime: '20:00' };
    localStorage.setItem('prototypeReservationDraft', JSON.stringify({ path: 'domain_first', domain: 'hahitantsoa', step: 3, maxReachedStep: 3, selectedClientId: 'COMPANY-1', clientMode: 'existing', hDetails }));
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    fireEvent.click(await screen.findByRole('button', { name: /Reprendre le secours local de cet appareil/i }));
    expect(await screen.findByText('Détails Événement (Hahitantsoa)')).toBeInTheDocument();
    expect(screen.queryByText('Marié(e) 1')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('Ancien marié')).not.toBeInTheDocument();
    expect(resolveHahitantsoaEventName(hDetails as never, 'Entreprise Test', true)).toBe('Entreprise Test');
  });

  it('recherche les services sans accents et conserve les sélections masquées', async () => {
    localStorage.setItem('prototypeReservationDraft', JSON.stringify({ path: 'domain_first', domain: 'hahitantsoa', step: 5, maxReachedStep: 5, selectedClientId: 'CUST-001', clientMode: 'existing', selectedServices: [{ id: 'SRV-002', name: 'Décoration', quantity: 1, price: 300000 }], hDetails: { eventType: 'Mariage', rentalType: 'Location nue', venue: 'Salle des fêtes + jardin', startDate: '2027-11-20', endDate: '2027-11-20', startTime: '08:00', endTime: '20:00' } }));
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    fireEvent.click(await screen.findByRole('button', { name: /Reprendre le secours local de cet appareil/i }));
    const search = await screen.findByRole('searchbox', { name: 'Rechercher un service' });
    fireEvent.change(search, { target: { value: 'DECORATION' } });
    expect(screen.getByRole('heading', { name: 'Décoration' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Guinguette linéaire' })).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'guirlande' } });
    expect(screen.getByRole('heading', { name: 'Guinguette linéaire' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Décoration' })).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('prototypeReservationDraft')!).selectedServices).toEqual([expect.objectContaining({ id: 'SRV-002', quantity: 1, price: 300000 })]);
    fireEvent.change(search, { target: { value: 'introuvable' } });
    expect(screen.getByText('Aucun service ne correspond à cette recherche.')).toBeInTheDocument();
    fireEvent.change(search, { target: { value: '' } });
    expect(screen.getByRole('heading', { name: 'Décoration' })).toBeInTheDocument();
  });

  it.each(['active', 'aller-retour'])('conserve la saisie et les fichiers du nouveau client lors du changement d’onglet %s', async (navigation) => {
    render(<ReservationNewPage onNavigate={mockNavigate} param="titan" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Nouveau client' }));
    fireEvent.change(screen.getByPlaceholderText('Ex: Jean Dupont'), { target: { value: 'Client en cours' } });
    fireEvent.change(screen.getByPlaceholderText('Ex. justificatif domicile'), { target: { value: 'Justificatif B' } });
    fireEvent.change(document.getElementById('clientFile')!, { target: { files: [new File(['document'], 'justificatif-b.pdf', { type: 'application/pdf' })] } });
    fireEvent.click(screen.getByRole('button', { name: /^Ajouter$/ }));
    expect(await screen.findByText('justificatif-b.pdf')).toBeInTheDocument();
    if (navigation === 'aller-retour') fireEvent.click(screen.getByRole('button', { name: 'Client existant' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nouveau client' }));
    expect(screen.getByPlaceholderText('Ex: Jean Dupont')).toHaveValue('Client en cours');
    expect(screen.getByText('justificatif-b.pdf')).toBeInTheDocument();
    const draft = JSON.parse(localStorage.getItem('prototypeReservationDraft')!);
    expect(draft.clientAttachments).toEqual([expect.objectContaining({ name: 'justificatif-b.pdf', label: 'Justificatif B' })]);
    expect(createCustomer).not.toHaveBeenCalled();
    expect(uploadAttachment).not.toHaveBeenCalled();
  });

  it('fige les champs et la navigation client pendant un enregistrement en cours', async () => {
    const user = userEvent.setup();
    let resolveCustomer!: (customer: Awaited<ReturnType<typeof createCustomer>>) => void;
    vi.mocked(createCustomer).mockImplementationOnce(() => new Promise(resolve => { resolveCustomer = resolve; }));
    render(<ReservationNewPage onNavigate={mockNavigate} param="titan" />);
    await user.click(await screen.findByRole('button', { name: 'Nouveau client' }));
    const name = screen.getByPlaceholderText('Ex: Jean Dupont');
    await user.type(name, 'Client soumis');
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await waitFor(() => expect(createCustomer).toHaveBeenCalledTimes(1));
    expect(name).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Client existant' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Nouveau client' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Client existant' }));
    await user.click(screen.getByRole('button', { name: 'Nouveau client' }));
    await user.type(name, ' autre identité');
    await user.click(screen.getByRole('button', { name: 'Retour' }));
    await user.click(screen.getByRole('button', { name: /Client & volet/ }));
    expect(screen.getByText('Sélection ou création du client')).toBeInTheDocument();
    expect(name).toHaveValue('Client soumis');
    expect(screen.queryByTestId('client-select-CUST-001')).not.toBeInTheDocument();
    expect(createCustomer).toHaveBeenCalledTimes(1);
    resolveCustomer({ ...mockCustomersData[0], id: 'SERVER-SUBMITTED-CLIENT', display_name: 'Client soumis' } as never);
    expect(await screen.findByText('Détails Location (Titan)')).toBeInTheDocument();
    expect(createCustomer).toHaveBeenCalledWith(expect.objectContaining({ display_name: 'Client soumis' }));
    expect(JSON.parse(localStorage.getItem('prototypeReservationDraft')!).selectedClientId).toBe('SERVER-SUBMITTED-CLIENT');
    expect(updateCustomer).not.toHaveBeenCalled();
  });

  it('affiche le bloc dépliable de composition sous la synthèse financière au résumé (R10)', async () => {
    localStorage.setItem('prototypeReservationDraft', JSON.stringify({
      step: 6,
      maxReachedStep: 6,
      domain: 'hahitantsoa',
      path: 'client_first',
      selectedClientId: 'CUST-001',
      selectedMaterials: [{ id: 'MAT-001', name: 'Tente 10x10', price: 150000, quantity: 2 }],
      hDetails: {
        rentalType: 'Location nue',
        startDate: '2027-11-20',
        endDate: '2027-11-20',
        startTime: '08:00',
        endTime: '20:00',
        venue: 'Grande Salle',
        venuePrice: 2000000,
        bareRentalComposition: [{ label: 'Tables rondes', quantity: 10 }],
      },
    }));
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    fireEvent.click(await screen.findByRole('button', { name: /Reprendre le secours local de cet appareil/i }));

    const breakdown = await screen.findByTestId('summary-financial-breakdown');
    expect(breakdown).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Détail des compositions & lignes de l'offre/i }));
    expect(within(breakdown).getByText(/10 Tables rondes/i)).toBeInTheDocument();
    expect(within(breakdown).getByText(/Caution restituable/i)).toBeInTheDocument();
  });

  it('persiste la clé de création avant la requête et la rejoue après réponse perdue et rechargement', async () => {
    let attempts = 0;
    const keys: string[] = [];
    vi.mocked(createCustomer).mockImplementation(async payload => {
      keys.push(payload.idempotency_key || '');
      const recovery = JSON.parse(localStorage.getItem('prototypeReservationDraft')!);
      expect(Boolean(payload.idempotency_key) && recovery.customerCreationKey === payload.idempotency_key).toBe(true);
      if (++attempts === 1) throw new Error('Réponse réseau perdue');
      return { ...mockCustomersData[0], id: 'REPLAYED-CUSTOMER', display_name: 'Client durable' } as never;
    });
    const first = render(<ReservationNewPage onNavigate={mockNavigate} param="titan" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Nouveau client' }));
    fireEvent.change(screen.getByPlaceholderText('Ex: Jean Dupont'), { target: { value: 'Client durable' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(await screen.findByText(/Réponse réseau perdue/)).toBeInTheDocument();
    first.unmount();
    render(<ReservationNewPage onNavigate={mockNavigate} param="titan" />);
    fireEvent.click(await screen.findByRole('button', { name: /Reprendre le secours local de cet appareil/i }));
    expect(await screen.findByDisplayValue('Client durable')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(await screen.findByText('Détails Location (Titan)')).toBeInTheDocument();
    expect(attempts).toBe(2);
    expect(keys.length === 2 && keys[0] === keys[1]).toBe(true);
    expect(JSON.parse(localStorage.getItem('prototypeReservationDraft')!).selectedClientId).toBe('REPLAYED-CUSTOMER');
  });

  it('ne crée pas de client si sa clé de reprise ne peut pas être sauvegardée', async () => {
    render(<ReservationNewPage onNavigate={mockNavigate} param="titan" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Nouveau client' }));
    fireEvent.change(screen.getByPlaceholderText('Ex: Jean Dupont'), { target: { value: 'Client non envoyé' } });
    const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Stockage indisponible'); });
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
      expect(await screen.findByText(/Impossible de sécuriser la reprise du client/)).toBeInTheDocument();
      expect(createCustomer).not.toHaveBeenCalled();
      expect(screen.getByPlaceholderText('Ex: Jean Dupont')).toHaveValue('Client non envoyé');
    } finally { storage.mockRestore(); }
  });

  it('affiche un service de trois unités à son montant enregistré de 300000 et conserve le total et la caution', async () => {
    localStorage.setItem('prototypeReservationDraft', JSON.stringify({ step: 6, maxReachedStep: 6, path: 'client_first', domain: 'hahitantsoa', selectedClientId: 'CUST-001', selectedServices: [{ id: 'SRV-003', name: 'Guinguette archivée', quantity: 3, price: 300000 }], hDetails: { rentalType: 'Location nue', venuePrice: 2000000, startDate: '2027-11-20', endDate: '2027-11-20', startTime: '08:00', endTime: '20:00', venue: 'Salle historique', bareRentalComposition: [{ label: 'Tables archivées', quantity: 9 }] } }));
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    fireEvent.click(await screen.findByRole('button', { name: /Reprendre le secours local de cet appareil/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Détail des compositions & lignes de l'offre/i }));
    const breakdown = screen.getByTestId('summary-financial-breakdown');
    expect(within(breakdown).getByText(/Guinguette archivée/)).toHaveTextContent('(x3)');
    expect(within(breakdown).getByText(/^300\s*000\s*Ar$/)).toBeInTheDocument();
    expect(within(breakdown).queryByText(/^900\s*000\s*Ar$/)).not.toBeInTheDocument();
    expect(screen.getAllByText(/^2\s*300\s*000 Ar$/).length).toBeGreaterThan(0);
    expect(within(breakdown).getByText(/^500\s*000\s*Ar$/)).toBeInTheDocument();
  });

  it('ne reconstitue pas le détail du pack ancien avec le catalogue modifié et conserve les quantités sélectionnées', async () => {
    vi.mocked(getMaterialPackages).mockResolvedValue([{ id: 'PKG-001', name: 'Pack modifié aujourd’hui', price: 9999999, is_active: true, lines: [{ inventory_item: 'NEW-ITEM', inventory_item_name: 'Ajout tardif', quantity: 99 }] }] as never);
    localStorage.setItem('prototypeReservationDraft', JSON.stringify({ step: 6, maxReachedStep: 6, path: 'client_first', domain: 'hahitantsoa', selectedClientId: 'CUST-001', selectedMaterials: [{ id: 'MAT-OLD', name: 'Chaise archivée', price: 5000, quantity: 5 }], hDetails: { packageMode: 'package', packageId: 'PKG-001', rentalType: 'Location + logistique', venuePrice: 2000000, startDate: '2027-11-20', endDate: '2027-11-20', startTime: '08:00', endTime: '20:00', bareRentalComposition: [{ label: 'Tables archivées', quantity: 9 }] } }));
    render(<ReservationNewPage onNavigate={mockNavigate} />);
    fireEvent.click(await screen.findByRole('button', { name: /Reprendre le secours local de cet appareil/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Détail des compositions & lignes de l'offre/i }));
    const breakdown = screen.getByTestId('summary-financial-breakdown');
    expect(within(breakdown).getByText(/^Ventilation du pack non archivée/)).toBeInTheDocument();
    expect(within(breakdown).getByText('Chaise archivée')).toHaveTextContent('x5');
    expect(within(breakdown).queryByText('Ajout tardif')).not.toBeInTheDocument();
    expect(within(breakdown).queryByText(/Pack modifié aujourd’hui/)).not.toBeInTheDocument();
    expect(within(breakdown).getByText(/9 Tables archivées/)).toBeInTheDocument();
  });

  it('sécurise la création sur réseau local lorsque randomUUID est absent avec 16 octets natifs', async () => {
    const nativeCrypto = globalThis.crypto;
    vi.stubGlobal('crypto', { getRandomValues: nativeCrypto.getRandomValues.bind(nativeCrypto) });
    try {
      render(<ReservationNewPage onNavigate={mockNavigate} param="titan" />);
      fireEvent.click(await screen.findByRole('button', { name: 'Nouveau client' }));
      fireEvent.change(screen.getByPlaceholderText('Ex: Jean Dupont'), { target: { value: 'Client réseau local' } });
      fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
      expect(await screen.findByText('Détails Location (Titan)')).toBeInTheDocument();
      const operation = vi.mocked(createCustomer).mock.calls[0][0].idempotency_key || '';
      expect(/^[0-9a-f]{32}$/.test(operation)).toBe(true);
      expect(JSON.parse(localStorage.getItem('prototypeReservationDraft')!).customerCreationKey === operation).toBe(true);
    } finally { vi.unstubAllGlobals(); }
  });

  it('conserve la saisie sans envoyer de création non sécurisée si la cryptographie native est absente', async () => {
    vi.stubGlobal('crypto', undefined);
    try {
      render(<ReservationNewPage onNavigate={mockNavigate} param="titan" />);
      fireEvent.click(await screen.findByRole('button', { name: 'Nouveau client' }));
      fireEvent.change(screen.getByPlaceholderText('Ex: Jean Dupont'), { target: { value: 'Client conservé' } });
      fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
      expect(await screen.findByText(/Votre navigateur ne peut pas sécuriser la création du client/)).toBeInTheDocument();
      expect(createCustomer).not.toHaveBeenCalled();
      expect(screen.getByPlaceholderText('Ex: Jean Dupont')).toHaveValue('Client conservé');
    } finally { vi.unstubAllGlobals(); }
  });

  it('conserve la même opération et les champs après un conflit sans relancer une création sous une nouvelle clé', async () => {
    vi.mocked(createCustomer)
      .mockRejectedValueOnce(new Error('Réponse perdue'))
      .mockRejectedValueOnce(Object.assign(new Error('Cette clé correspond déjà à une autre demande.'), { status: 409 }));
    render(<ReservationNewPage onNavigate={mockNavigate} param="titan" />);
    fireEvent.click(await screen.findByRole('button', { name: 'Nouveau client' }));
    fireEvent.change(screen.getByPlaceholderText('Ex: Jean Dupont'), { target: { value: 'Client initial' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(await screen.findByText(/Réponse perdue/)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Ex: Jean Dupont'), { target: { value: 'Client corrigé après incident' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(await screen.findByText(/Cette clé correspond déjà à une autre demande/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Ex: Jean Dupont')).toHaveValue('Client corrigé après incident');
    const operations = vi.mocked(createCustomer).mock.calls.map(([payload]) => payload.idempotency_key);
    expect(operations.length === 2 && operations[0] === operations[1]).toBe(true);
    expect(JSON.parse(localStorage.getItem('prototypeReservationDraft')!).customerCreationKey === operations[0]).toBe(true);
    expect(screen.getByText('Sélection ou création du client')).toBeInTheDocument();
  });

});
