import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DocumentsPage from './DocumentsPage';

// Mock localStorage
let mockStorage: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: (key: string) => key in mockStorage ? mockStorage[key] : null,
  setItem: (key: string, val: string) => { mockStorage[key] = val; },
  removeItem: (key: string) => { delete mockStorage[key]; },
});

describe('DocumentsPage', () => {
  beforeEach(() => {
    mockStorage = {};
  });

  it('renders list view and handles navigation by clicking on a row', () => {
    const onNavigate = vi.fn();
    render(<DocumentsPage onNavigate={onNavigate} />);

    expect(screen.getAllByText('Documents & Modèles')[0]).toBeInTheDocument();

    // Click on a row (Titan Contrat Standard is TPL-T3 now)
    const row = screen.getByText('Contrat Location Titan Standard').closest('tr');
    fireEvent.click(row!);

    // Should display breadcrumb
    expect(screen.getByText('Documents & Modèles', { selector: 'button' })).toBeInTheDocument();
    expect(screen.getByText(/Contrat Location Titan Standard \/ v2/i)).toBeInTheDocument();
  });

  it('filters correctly and handles spaces in search', () => {
    render(<DocumentsPage onNavigate={vi.fn()} />);

    const searchInput = screen.getByPlaceholderText(/Rechercher par nom/i);
    fireEvent.change(searchInput, { target: { value: '  titan  ' } });

    expect(screen.getByText('Contrat Location Titan Standard')).toBeInTheDocument();
    expect(screen.queryByText('Avenant Hahitantsoa Standard')).not.toBeInTheDocument();
  });

  it('verifies Avenant is only for Hahitantsoa', () => {
    render(<DocumentsPage onNavigate={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Nouveau modèle/i }));

    const selects = screen.getAllByRole('combobox');
    // selects[0] = famille (disabled), selects[1] = volet, selects[2] = type

    fireEvent.change(selects[1], { target: { value: 'Hahitantsoa' } });
    expect(Array.from((selects[2] as HTMLSelectElement).options).map(o => o.value)).toContain('Avenant');

    fireEvent.change(selects[1], { target: { value: 'Titan' } });
    expect(Array.from((selects[2] as HTMLSelectElement).options).map(o => o.value)).not.toContain('Avenant');
  });

  it('handles guided editor and variables insertion', async () => {
    render(<DocumentsPage onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Nouveau modèle/i }));

    fireEvent.click(screen.getByText('2. Contenu'));

    // Add a block
    fireEvent.click(screen.getByText('+ Paragraphe'));

    fireEvent.click(screen.getByText('3. Variables'));

    // Click "Insérer" for client.name
    const insertBtns = screen.getAllByRole('button', { name: /Insérer/i });
    fireEvent.click(insertBtns[0]); // should insert client name

    // Note: setTimeout is used in component, so we must wait
    await waitFor(() => {
      const contentInputs = screen.getAllByPlaceholderText(/Saisissez votre contenu/i);
      expect((contentInputs[0] as HTMLTextAreaElement).value).toContain('{{client.name}}');
    });
  });

  it('creates mock document from local PDF', () => {
    render(<DocumentsPage onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Importer/i }));
    expect(screen.getByText('Cliquez pour sélectionner un fichier PDF')).toBeInTheDocument();

    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) {
      const file = new File(['dummy content'], 'test.pdf', { type: 'application/pdf' });
      fireEvent.change(fileInput, { target: { files: [file] } });
      fireEvent.click(screen.getByRole('button', { name: /Extraire le contenu/i }));
      expect(screen.getByText(/Modèle importé/i)).toBeInTheDocument();
    }
  });

  it('prevents duplicated codes', () => {
    render(<DocumentsPage onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Nouveau modèle/i }));

    const nameInput = screen.getByPlaceholderText(/Ex: Contrat de location Standard/i);
    const codeInput = screen.getByPlaceholderText(/Ex: CONTRAT-STD/i);
    fireEvent.change(nameInput, { target: { value: 'Test Duplicate' } });
    fireEvent.change(codeInput, { target: { value: 'TITAN-CONTRAT' } }); // Already exists

    fireEvent.click(screen.getByText('2. Contenu'));
    fireEvent.click(screen.getByText('+ Paragraphe'));
    const contentInputs = screen.getAllByPlaceholderText(/Saisissez votre contenu/i);
    fireEvent.change(contentInputs[0], { target: { value: 'Some content' } });

    fireEvent.click(screen.getByRole('button', { name: /Enregistrer/i }));

    fireEvent.click(screen.getByText('1. Informations générales'));
    expect(screen.getByText(/Ce code existe déjà pour un autre modèle/i)).toBeInTheDocument();
  });

  it('prevents multiple active versions', () => {
    render(<DocumentsPage onNavigate={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Nouveau modèle/i }));

    const nameInput = screen.getByPlaceholderText(/Ex: Contrat de location Standard/i);
    const codeInput = screen.getByPlaceholderText(/Ex: CONTRAT-STD/i);
    fireEvent.change(nameInput, { target: { value: 'Test Active' } });
    fireEvent.change(codeInput, { target: { value: 'TITAN-CONTRAT' } });

    // Toggle status to Actif using the switch
    const statusSwitch = screen.getByRole('switch');
    fireEvent.click(statusSwitch); // changes from Brouillon to Actif

    fireEvent.click(screen.getByText('2. Contenu'));
    fireEvent.click(screen.getByText('+ Paragraphe'));
    const contentInputs = screen.getAllByPlaceholderText(/Saisissez votre contenu/i);
    fireEvent.change(contentInputs[0], { target: { value: 'Some content' } });

    fireEvent.click(screen.getByRole('button', { name: /Enregistrer/i }));

    fireEvent.click(screen.getByText('1. Informations générales'));
    expect(screen.getByText(/Une version active existe déjà/i)).toBeInTheDocument();
  });
});
