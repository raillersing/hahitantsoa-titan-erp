import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DocumentPreview } from './DocumentPreview';

describe('DocumentPreview crash safety 6F-R10', () => {
  const clientMock = { name: 'Test Client', phone: '0340000000' };

  it('renders Titan proforma for LOC-2026-0089 without crash', () => {
    render(
      <DocumentPreview
        type="proforma"
        domain="titan"
        client={clientMock}
        date="01/01/2026"
        refNumber="LOC-2026-0089"
        totalAmount={850000}
        materials={[]}
        services={[]}
      />
    );
    expect(screen.getByText('P R O F O R M A')).toBeInTheDocument();
    expect(screen.getByText("T O T A L A P A Y E R").nextElementSibling?.textContent).toMatch(/850[\s\u00a0\u202f]?000,00/);
  });

  it('renders Titan facture for LOC-2026-0088 without crash', () => {
    render(
      <DocumentPreview
        type="facture"
        domain="titan"
        client={clientMock}
        date="01/01/2026"
        refNumber="LOC-2026-0088"
        totalAmount={1150000}
        materials={[]}
        services={[]}
      />
    );
    expect(screen.getByText('F A C T U R E')).toBeInTheDocument();
    expect(screen.getByText("T O T A L A P A Y E R").nextElementSibling?.textContent).toMatch(/1[\s\u00a0\u202f]?150[\s\u00a0\u202f]?000,00/);
  });

  it('renders Titan contrat without crash', () => {
    const { container } = render(
      <DocumentPreview
        type="contrat"
        domain="titan"
        client={clientMock}
        date="01/01/2026"
        refNumber="LOC-2026-0089"
        totalAmount={850000}
        materials={[]}
        services={[]}
      />
    );
    expect(screen.getByText('CONTRAT DE LOCATION DE MATERIELS EVENEMENTIELS « TITAN RENTAL »')).toBeInTheDocument();
    expect(container.textContent).toMatch(/850\u202f000,00/);
  });

  it('renders Hahitantsoa proforma for RES-2026-0142 without crash', () => {
    render(
      <DocumentPreview
        type="proforma"
        domain="hahitantsoa"
        client={clientMock}
        date="01/01/2026"
        refNumber="RES-2026-0142"
        totalAmount={2400000}
        materials={[]}
        services={[]}
      />
    );
    expect(screen.getByText('P R O F O R M A')).toBeInTheDocument();
    expect(screen.getByText("T O T A L A P A Y E R").nextElementSibling?.textContent).toMatch(/2[\s\u00a0\u202f]?400[\s\u00a0\u202f]?000,00/);
  });

  it('renders Hahitantsoa facture for RES-2026-0142 without crash', () => {
    render(
      <DocumentPreview
        type="facture"
        domain="hahitantsoa"
        client={clientMock}
        date="01/01/2026"
        refNumber="RES-2026-0142"
        totalAmount={2400000}
        materials={[]}
        services={[]}
      />
    );
    expect(screen.getByText('F A C T U R E')).toBeInTheDocument();
  });

  it('renders Hahitantsoa contrat without crash', () => {
    const { container } = render(
      <DocumentPreview
        type="contrat"
        domain="hahitantsoa"
        client={clientMock}
        date="01/01/2026"
        refNumber="RES-2026-0142"
        totalAmount={2400000}
        materials={[]}
        services={[]}
      />
    );
    expect(screen.getByText('CONTRAT DE LOCATION « HAHITANTSOA »')).toBeInTheDocument();
    expect(container.textContent).toMatch(/2\u202f400\u202f000,00/);
  });

  it('displays REMISE label, never REMISe', () => {
    const { container } = render(
      <DocumentPreview
        type="proforma"
        domain="hahitantsoa"
        client={clientMock}
        date="01/01/2026"
        refNumber="RES-2026-0142"
        totalAmount={2400000}
        materials={[]}
        services={[]}
      />
    );
    expect(container.textContent).toMatch(/R E M I S E/);
    expect(container.textContent).not.toMatch(/R E M I S e/);
  });
});
