import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CustomerDetailPage from './CustomerDetailPage';
import { mockReservations } from './mockData';

describe('CustomerDetailPage', () => {
  it('1. Affiche un particulier (CUST-001) avec ses sections', () => {
    const mockNavigate = vi.fn();
    render(<CustomerDetailPage param="CUST-001" onNavigate={mockNavigate} />);
    
    expect(screen.getByText('Fiche client — Ando Rakoto')).toBeInTheDocument();
    expect(screen.getByText('Particulier')).toBeInTheDocument();
    
    // Check buttons
    expect(screen.getByText('Nouvelle réservation')).toBeInTheDocument();
    
    // Check fields
    expect(screen.getAllByText(/CIN \/ Passeport/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Raison sociale/i)).not.toBeInTheDocument();
  });

  it('2. Affiche une entreprise (CUST-002)', () => {
    const mockNavigate = vi.fn();
    render(<CustomerDetailPage param="CUST-002" onNavigate={mockNavigate} />);
    
    expect(screen.getByText('Entreprise')).toBeInTheDocument();
    
    // Check fields
    expect(screen.getAllByText(/Raison sociale/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/NIF \/ STAT/i).length).toBeGreaterThan(0);
  });

  it('3. Affiche un prospect et permet la conversion (PROS-001)', () => {
    // Add mock proforma so the conversion block appears
    mockReservations.push({
      id: "PROF-TEST",
      clientId: "PROS-001",
      title: "Test",
      date: "2026-08-15",
      amount: 1500000,
      status: "Proforma",
      type: "Hahitantsoa"
    });

    const mockNavigate = vi.fn();
    render(<CustomerDetailPage param="PROS-001" onNavigate={mockNavigate} />);
    
    expect(screen.getByText('Fiche prospect — Jean Dupont')).toBeInTheDocument();
    expect(screen.getByText('Prospect')).toBeInTheDocument();
    
    // Check that the new "Conversion en client" block is there
    expect(screen.getByText('Conversion en client')).toBeInTheDocument();
    
    // Click Confirmer avec acompte
    const convertBtn = screen.getByText(/Confirmer avec acompte/i);
    fireEvent.click(convertBtn);
    
    // Check that assistant opens
    expect(screen.getByText('1. Infos légales')).toBeInTheDocument();
  });

  it('4. Modification du nom (mode local/mock)', () => {
    const mockNavigate = vi.fn();
    render(<CustomerDetailPage param="CUST-001" onNavigate={mockNavigate} />);
    
    const modifierBtns = screen.getAllByText('Modifier');
    fireEvent.click(modifierBtns[0]); // first section
    
    const inputs = screen.getAllByDisplayValue('Ando Rakoto');
    fireEvent.change(inputs[0], { target: { value: 'Ando Modifié' } });
    
    fireEvent.click(screen.getByText('Enregistrer (local)'));
    
    expect(screen.getByText('Modifications enregistrées en local (mock)')).toBeInTheDocument();
    // the name at the top is also changed
    expect(screen.getByText('Fiche client — Ando Modifié')).toBeInTheDocument();
  });

  it('5. Clic sur retour et nouvelle réservation', () => {
    const mockNavigate = vi.fn();
    const mockBack = vi.fn();
    render(<CustomerDetailPage param="CUST-001" onNavigate={mockNavigate} onBack={mockBack} />);
    
    const retourBtn = screen.getByLabelText('Retour');
    fireEvent.click(retourBtn);
    expect(mockBack).toHaveBeenCalled();
    
    const resBtn = screen.getByText('Nouvelle réservation');
    fireEvent.click(resBtn);
    expect(mockNavigate).toHaveBeenCalledWith('reservation-new', 'CUST-001');
  });
});
