import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, beforeEach, it, expect, vi } from 'vitest';
import ReservationDetailPage from './ReservationDetailPage';
import { mockReservations } from './mockData';

describe('ReservationDetailPage', () => {
  it('1. Préparation Titan: clamp prep quantities to ordered quantity', () => {
    render(<ReservationDetailPage onNavigate={vi.fn()} param="LOC-2026-0089" />);
    fireEvent.click(screen.getByRole('button', { name: /^Préparation$/i }));
    
    const section = screen.getByRole('button', { name: /^Préparation$/i }).closest('div')?.parentElement;
    const inputs = section ? section.querySelectorAll('input[type="number"]') : screen.getAllByRole('spinbutton');
    const prepQty1 = inputs[0] as HTMLInputElement;
    const prepQty2 = inputs[1] as HTMLInputElement;

    expect(prepQty1).toHaveAttribute('max', '100');
    expect(prepQty2).toHaveAttribute('max', '10');

    // Clamp > max
    fireEvent.change(prepQty1, { target: { value: '150' } });
    expect(prepQty1).toHaveValue(100);

    // Clamp < min
    fireEvent.change(prepQty1, { target: { value: '-10' } });
    expect(prepQty1).toHaveValue(0);
  });

  it('2. Retour Titan: clamp return quantities to ordered quantity', () => {
    render(<ReservationDetailPage onNavigate={vi.fn()} param="LOC-2026-0089" />);
    fireEvent.click(screen.getByRole('button', { name: /Retour \/ Restitution/i }));

    const section = screen.getByRole('button', { name: /Retour \/ Restitution/i }).closest('div')?.parentElement;
    const inputs = section ? section.querySelectorAll('input[type="number"]') : screen.getAllByRole('spinbutton');
    const returnQty1 = inputs[0] as HTMLInputElement;
    const returnQty2 = inputs[1] as HTMLInputElement;

    expect(returnQty1).toHaveAttribute('max', '100');
    expect(returnQty2).toHaveAttribute('max', '10');

    // Clamp > max
    fireEvent.change(returnQty1, { target: { value: '120' } });
    expect(returnQty1).toHaveValue(100);

    // Clamp < min
    fireEvent.change(returnQty1, { target: { value: '-5' } });
    expect(returnQty1).toHaveValue(0);
  });

  it('3. Paiements en tranches : affiche l\'historique et permet d\'ajouter une tranche', () => {
    render(<ReservationDetailPage onNavigate={vi.fn()} param="RES-2026-0142" />
    );

    // Le résumé financier indique le reste à payer
    expect(screen.getByText(/Reste à payer/i)).toBeInTheDocument();

    // Le bloc "Paiements en tranches" est présent
    expect(screen.getByText(/Paiements en tranches/i)).toBeInTheDocument();

    // Montant perçu initial = paidAmount de la réservation (1 200 000 Ar = moitié)
    const amountInput = screen.getByLabelText(/Montant \(Ar\)/i);
    const methodSelect = screen.getByLabelText(/Mode/i);
    const noteInput = screen.getByLabelText(/Note/i);
    const submitButton = screen.getByRole('button', { name: /Enregistrer un paiement/i });

    fireEvent.change(amountInput, { target: { value: '600000' } });
    fireEvent.change(methodSelect, { target: { value: 'Virement' } });
    fireEvent.change(noteInput, { target: { value: 'Deuxième tranche' } });
    fireEvent.click(submitButton);

    expect(screen.getByText(/Deuxième tranche/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Virement/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/1 800 000 Ar/i).length).toBeGreaterThan(0);

    // Quand on paie le reste (600 000), le dossier est soldé
    const remainingText = screen.getByText(/Reste dû/i).closest('tr');
    const remainingValue = remainingText?.textContent || '';
    const remainingAr = remainingValue.replace(/\s/g, '').match(/\d[\d\s]*Ar/);
    const remaining = remainingAr
      ? parseInt(remainingAr[0].replace(/\s/g, '').replace('Ar', ''), 10)
      : 0;
    expect(remaining).toBeGreaterThan(0);

    fireEvent.change(amountInput, { target: { value: remaining.toString() } });
    fireEvent.change(noteInput, { target: { value: 'Solde final' } });
    fireEvent.click(submitButton);

    expect(screen.getByText(/Solde final/i)).toBeInTheDocument();
    expect(screen.getByText(/Le dossier est intégralement payé/i)).toBeInTheDocument();
    expect(submitButton).not.toBeInTheDocument();
  });

  it('4. Vue spécifique pour les proformas prospect (PROF-PROS-)', () => {
    // Add mock reservation for test
    mockReservations.push({
      id: "PROF-PROS-2026-9999",
      clientId: "PROS-001",
      title: "Mariage test",
      date: "2026-08-15",
      amount: 1500000,
      status: "Proforma",
      type: "Hahitantsoa"
    });

    render(<ReservationDetailPage onNavigate={vi.fn()} param="PROF-PROS-2026-9999" />);

    // Check title and badge
    expect(screen.getByText(/Proforma prospect — PROF-PROS-2026-9999/i)).toBeInTheDocument();
    expect(screen.getByText(/Prospect non confirmé/i)).toBeInTheDocument();

    // Check absence of standard workflow steps
    expect(screen.queryByText(/Paiements en tranches/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Aperçu Contrat/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Aperçu Facture/i)).not.toBeInTheDocument();

    // Check next step banner
    expect(screen.getByText(/Prochaine étape commerciale/i)).toBeInTheDocument();
    const btn = screen.getByRole('button', { name: /Confirmer avec acompte/i });
    expect(btn).not.toBeDisabled();

    // Cleanup mock data
    const idx = mockReservations.findIndex(r => r.id === "PROF-PROS-2026-9999");
    if (idx >= 0) mockReservations.splice(idx, 1);
  });
});
