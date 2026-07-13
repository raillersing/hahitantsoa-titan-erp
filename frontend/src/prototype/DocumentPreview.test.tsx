import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DocumentPreview } from './DocumentPreview';

describe('DocumentPreview', () => {
  const clientMock = { name: 'Test Client', phone: '0340000000' };

  it('renders Titan proforma correctly', () => {
    render(<DocumentPreview type="proforma" domain="titan" client={clientMock} date="01/01/2026" refNumber="TEST-123" totalAmount={50000} />);
    expect(screen.getByText('P R O F O R M A')).toBeInTheDocument();
    expect(screen.getByAltText('titan logo')).toBeInTheDocument();
    expect(screen.getByAltText('Ergon logo')).toBeInTheDocument();
    expect(screen.getByText('Q T E')).toBeInTheDocument();
    expect(screen.getByText('D E S I G N A T I O N')).toBeInTheDocument();
    expect(screen.getByText('P. U.')).toBeInTheDocument();
    expect(screen.getByText('M O N T A N T')).toBeInTheDocument();
    expect(screen.getByText('P. C A S S E')).toBeInTheDocument();
    expect(screen.getByText('T O T A L A P A Y E R')).toBeInTheDocument();
  });

  it('renders Hahitantsoa facture correctly', () => {
    render(<DocumentPreview type="facture" domain="hahitantsoa" client={clientMock} date="01/01/2026" refNumber="TEST-456" totalAmount={50000} />);
    expect(screen.getByText('F A C T U R E')).toBeInTheDocument();
    expect(screen.getByAltText('hahitantsoa logo')).toBeInTheDocument();
    expect(screen.getByAltText('Ergon logo')).toBeInTheDocument();
  });

  it('keeps common templates neutral instead of attributing them to Titan', () => {
    const { container } = render(
      <DocumentPreview
        template={{ volet: 'Commun', content: '' }}
        blocks={[]}
        isGuided
      />
    );

    expect(screen.getByText('Document commun')).toBeInTheDocument();
    expect(container).toHaveTextContent('ergon@ergon.mg');
    expect(screen.queryByAltText('Titan logo')).not.toBeInTheDocument();
    expect(screen.queryByAltText('Hahitantsoa logo')).not.toBeInTheDocument();
  });

  it('renders Contrats with unchanged labels and multipage content', () => {
    const { rerender, container } = render(<DocumentPreview type="contrat" domain="titan" client={clientMock} date="01/01/2026" refNumber="TEST-CTR" totalAmount={50000} />);
    
    // Check Titan labels and pages
    expect(screen.getByText('CONTRAT DE LOCATION DE MATERIELS EVENEMENTIELS « TITAN RENTAL »')).toBeInTheDocument();
    expect(screen.getAllByAltText('titan logo').length).toBeGreaterThan(0);
    const titanPages = container.querySelectorAll('.contract-a4-page');
    expect(titanPages.length).toBeGreaterThanOrEqual(3);
    
    // Check Titan articles
    expect(screen.getByText(/Article 1 : Objet du contrat/)).toBeInTheDocument();
    expect(screen.getByText(/Article 12 : Transport/)).toBeInTheDocument();
    expect(screen.getByText('Le Prestataire,')).toBeInTheDocument();
    expect(screen.getByText('Le Client,')).toBeInTheDocument();

    // Re-render for Hahitantsoa
    rerender(<DocumentPreview type="contrat" domain="hahitantsoa" client={clientMock} date="01/01/2026" refNumber="TEST-CTR" totalAmount={50000} />);
    
    // Check Hahitantsoa labels and pages
    expect(screen.getByText('CONTRAT DE LOCATION « HAHITANTSOA »')).toBeInTheDocument();
    expect(screen.getAllByAltText('hahitantsoa logo').length).toBeGreaterThan(0);
    const hahiPages = container.querySelectorAll('.contract-a4-page');
    expect(hahiPages.length).toBeGreaterThanOrEqual(5);

    // Check Hahitantsoa articles and annexes
    expect(screen.getByText(/Article 1 : Objet du contrat/)).toBeInTheDocument();
    expect(screen.getByText(/Article 15 : Annexes/)).toBeInTheDocument();
    expect(screen.getByText(/Annexe 1 : REGLEMENT INTERIEUR/)).toBeInTheDocument();
    expect(screen.getByText(/Annexe 2 : Plan de masse et évacuation incendie/)).toBeInTheDocument();
    expect(screen.getByText(/Annexe 3 : Prix de casse/)).toBeInTheDocument();
    expect(screen.getByText(/Annexe 4 : Liste des intervenants non autorisés/)).toBeInTheDocument();
  });

  it('renders Titan Article 2 with correct geography, usage type and venue name', () => {
    const tDetails = {
      usageType: 'Anniversaire',
      destinationName: 'Villa Privée',
      destinationAddress: 'Lot 45',
      destinationCity: 'Antananarivo',
      destinationLat: '-18',
      destinationLng: '47',
      movementMode: 'Livraison par Titan',
      startDate: '01/01/2026',
      startTime: '08:00',
      endDate: '02/01/2026',
      endTime: '18:00',
      pickupDate: '01/01/2026',
      deliveryTime: '07:00'
    };
    render(<DocumentPreview type="contrat" domain="titan" client={clientMock} date="01/01/2026" refNumber="TEST-1" totalAmount={100} tDetails={tDetails as any} />);
    expect(screen.getByText(/Anniversaire/)).toBeInTheDocument();
    expect(screen.getByText(/Villa Privée/)).toBeInTheDocument();
    expect(screen.getByText(/Lot 45/)).toBeInTheDocument();
    expect(screen.getAllByText(/Antananarivo/).length).toBeGreaterThan(0);
    expect(screen.getByText(/-18, 47/)).toBeInTheDocument();
    expect(screen.queryByText(/Salle des fêtes/)).not.toBeInTheDocument();
    
    // Check fallback for returnDate using endDate
    expect(screen.getByText(/La récupération des matériels est prévue le 02\/01\/2026 à 18:00/)).toBeInTheDocument();
  });

  it('renders prospect warning on proforma if client is prospect', () => {
    const prospectMock = { name: 'Test Prospect', phone: '0340000000', status: 'Prospect' };
    render(<DocumentPreview type="proforma" domain="titan" client={prospectMock} date="01/01/2026" refNumber="TEST-PROSPECT" totalAmount={50000} />);
    expect(screen.getByText(/Ce document est une proforma émise à titre informatif/)).toBeInTheDocument();
  });
});
