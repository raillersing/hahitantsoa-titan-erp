import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import DocumentsPage from './DocumentsPage';

// Mock localStorage
let mockStorage: Record<string, string> = {};
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;
vi.stubGlobal('localStorage', {
  getItem: (key: string) => key in mockStorage ? mockStorage[key] : null,
  setItem: (key: string, val: string) => { mockStorage[key] = val; },
  removeItem: (key: string) => { delete mockStorage[key]; },
});

describe('DocumentsPage', () => {
  beforeEach(() => {
    mockStorage = {};
  });

  afterEach(() => {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: originalCreateObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: originalRevokeObjectURL });
  });

  it('renders list view and handles navigation by clicking on a row', () => {
    const onNavigate = vi.fn();
    render(<DocumentsPage onNavigate={onNavigate} />);

    expect(screen.getAllByText('Documents & Modèles')[0]).toBeInTheDocument();
    expect(screen.getAllByText('11/07/2026').length).toBeGreaterThan(0);

    // Click on a row (Titan Contrat Standard is TPL-T3 now)
    fireEvent.click(screen.getAllByRole('button', { name: 'Ouvrir le modèle Contrat Location Titan Standard' })[0]);

    // Should display breadcrumb
    expect(screen.getByText('Documents & Modèles', { selector: 'button' })).toBeInTheDocument();
    expect(screen.getByText(/Contrat Location Titan Standard \/ v2/i)).toBeInTheDocument();
  });

  it('filters correctly and handles spaces in search', () => {
    render(<DocumentsPage onNavigate={vi.fn()} />);

    const searchInput = screen.getByPlaceholderText(/Rechercher par nom/i);
    fireEvent.change(searchInput, { target: { value: '  titan  ' } });

    expect(screen.getAllByText('Contrat Location Titan Standard')[0]).toBeInTheDocument();
    expect(screen.queryByText('Avenant Hahitantsoa Standard')).not.toBeInTheDocument();
  });

  it('allows Avenant for both Hahitantsoa and Titan while filtering Titan venue variables', () => {
    render(<DocumentsPage onNavigate={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /Nouveau modèle/i }));

    const voletSelect = screen.getByLabelText('Volet métier');
    const typeSelect = screen.getByLabelText('Type de document') as HTMLSelectElement;

    fireEvent.change(voletSelect, { target: { value: 'Hahitantsoa' } });
    expect(Array.from(typeSelect.options).map(o => o.value)).toContain('Avenant');
    fireEvent.change(typeSelect, { target: { value: 'Avenant' } });

    fireEvent.change(voletSelect, { target: { value: 'Titan' } });
    expect(Array.from(typeSelect.options).map(o => o.value)).toContain('Avenant');
    expect(typeSelect).toHaveValue('Avenant');

    fireEvent.click(screen.getByRole('tab', { name: '3. Variables' }));
    expect(screen.queryByText('{{event.venue}}')).not.toBeInTheDocument();
    expect(screen.getByText('{{event.usage}}')).toBeInTheDocument();
  });

  it('preserves a valid Titan material amendment when saving', () => {
    mockStorage.mock_templates = JSON.stringify([{
      id: 'TITAN-MATERIAL-AMENDMENT',
      name: 'Avenant matériel Titan',
      code: 'TITAN-MATERIAL-AMENDMENT',
      family: 'Documents commerciaux',
      volet: 'Titan',
      type: 'Avenant',
      status: 'Brouillon',
      version: 1,
      content: '[]',
      lastModified: '2026-07-11',
    }]);

    render(<DocumentsPage onNavigate={vi.fn()} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Ouvrir le modèle Avenant matériel Titan' })[0]);
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer/i }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Modèle enregistré avec succès.')).toBeInTheDocument();
    expect(screen.getByLabelText('Type de document')).toHaveValue('Avenant');
  });

  it('refuses the Hahitantsoa venue variable in a Titan template', () => {
    render(<DocumentsPage onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Nouveau modèle/i }));
    fireEvent.click(screen.getByRole('tab', { name: '2. Contenu' }));
    fireEvent.click(screen.getByRole('button', { name: '+ Paragraphe' }));
    fireEvent.change(screen.getByPlaceholderText(/Saisissez votre contenu/i), {
      target: { value: 'Lieu : {{ event.venue }}' },
    });
    fireEvent.click(screen.getByRole('tab', { name: '1. Informations générales' }));
    fireEvent.change(screen.getByLabelText('Volet métier'), { target: { value: 'Titan' } });
    fireEvent.click(screen.getByRole('button', { name: /Enregistrer/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('event.venue est réservée à Hahitantsoa');
    expect(screen.getByLabelText('Section du modèle')).toHaveValue('2. Contenu');
    expect(screen.getByPlaceholderText(/Saisissez votre contenu/i)).toHaveValue('Lieu : {{ event.venue }}');
  });

  it('handles guided editor and variables insertion', async () => {
    render(<DocumentsPage onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Nouveau modèle/i }));

    fireEvent.click(screen.getByRole('tab', { name: '2. Contenu' }));

    // Add a block
    fireEvent.click(screen.getByText('+ Paragraphe'));

    fireEvent.click(screen.getByRole('tab', { name: '3. Variables' }));

    // Click "Insérer" for client.name
    const insertBtns = screen.getAllByRole('button', { name: /Insérer/i });
    fireEvent.click(insertBtns[0]); // should insert client name

    // Note: setTimeout is used in component, so we must wait
    await waitFor(() => {
      const contentInputs = screen.getAllByPlaceholderText(/Saisissez votre contenu/i);
      expect((contentInputs[0] as HTMLTextAreaElement).value).toContain('{{client.name}}');
    });
  });

  it('handles replacement and cleanup of local mock PDF object URLs', async () => {
    const createObjectURL = vi.fn()
      .mockReturnValueOnce('blob:first-preview')
      .mockReturnValueOnce('blob:replacement-preview');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: revokeObjectURL });

    const { unmount } = render(<DocumentsPage onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Importer/i }));
    expect(screen.getByText('Cliquez pour sélectionner un fichier PDF')).toBeInTheDocument();

    const file = new File(['dummy content'], 'test.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('Sélectionner un PDF'), { target: { files: [file] } });
    expect(createObjectURL).toHaveBeenCalledWith(file);
    expect(screen.getByText('test.pdf')).toBeInTheDocument();
    expect(screen.getByText(/aperçu local\/mock/i)).toBeInTheDocument();
    expect(screen.getByTitle('Aperçu local du PDF importé')).not.toHaveAttribute('sandbox');
    expect(screen.getByRole('button', { name: /Extraire le contenu/i })).toBeEnabled();

    const replacement = new File(['replacement'], 'replacement.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('Sélectionner un PDF'), { target: { files: [replacement] } });
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('blob:first-preview'));
    expect(screen.getByText('replacement.pdf')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Supprimer la sélection/i }));
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('blob:replacement-preview'));
    expect(screen.queryByText('replacement.pdf')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Extraire le contenu/i })).toBeDisabled();
    unmount();
  });

  it('rejects non-PDF and oversized local imports', () => {
    render(<DocumentsPage onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Importer/i }));
    const input = screen.getByLabelText('Sélectionner un PDF');

    const textFile = new File(['not a pdf'], 'notes.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [textFile] } });
    expect(screen.getByRole('alert')).toHaveTextContent('extension .pdf et un type PDF valide');
    expect(screen.getByRole('button', { name: /Extraire le contenu/i })).toBeDisabled();

    const disguisedHtml = new File(['<script>alert(1)</script>'], 'evil.pdf', { type: 'text/html' });
    fireEvent.change(input, { target: { files: [disguisedHtml] } });
    expect(screen.getByRole('alert')).toHaveTextContent('extension .pdf et un type PDF valide');
    expect(screen.queryByTitle('Aperçu local du PDF importé')).not.toBeInTheDocument();

    const oversizedPdf = new File(['pdf'], 'large.pdf', { type: 'application/pdf' });
    Object.defineProperty(oversizedPdf, 'size', { value: 5 * 1024 * 1024 + 1 });
    fireEvent.change(input, { target: { files: [oversizedPdf] } });
    expect(screen.getByRole('alert')).toHaveTextContent('ne doit pas dépasser 5 Mo');
    expect(screen.getByRole('button', { name: /Extraire le contenu/i })).toBeDisabled();
  });

  it('clears and revokes the local PDF when leaving the document', async () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:sensitive-preview');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: revokeObjectURL });

    render(<DocumentsPage onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Importer/i }));
    const file = new File(['pdf'], 'sensitive.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('Sélectionner un PDF'), { target: { files: [file] } });
    expect(screen.getByText('sensitive.pdf')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Documents & Modèles' }));

    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('blob:sensitive-preview'));
    expect(screen.queryByText('sensitive.pdf')).not.toBeInTheDocument();
  });

  it('prevents duplicated codes', () => {
    render(<DocumentsPage onNavigate={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Nouveau modèle/i }));

    const nameInput = screen.getByPlaceholderText(/Ex: Contrat de location Standard/i);
    const codeInput = screen.getByPlaceholderText(/Ex: CONTRAT-STD/i);
    fireEvent.change(nameInput, { target: { value: 'Test Duplicate' } });
    fireEvent.change(codeInput, { target: { value: 'TITAN-CONTRAT' } }); // Already exists

    fireEvent.click(screen.getByRole('tab', { name: '2. Contenu' }));
    fireEvent.click(screen.getByText('+ Paragraphe'));
    const contentInputs = screen.getAllByPlaceholderText(/Saisissez votre contenu/i);
    fireEvent.change(contentInputs[0], { target: { value: 'Some content' } });

    fireEvent.click(screen.getByRole('button', { name: /Enregistrer/i }));

    fireEvent.click(screen.getByRole('tab', { name: '1. Informations générales' }));
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

    fireEvent.click(screen.getByRole('tab', { name: '2. Contenu' }));
    fireEvent.click(screen.getByText('+ Paragraphe'));
    const contentInputs = screen.getAllByPlaceholderText(/Saisissez votre contenu/i);
    fireEvent.change(contentInputs[0], { target: { value: 'Some content' } });

    fireEvent.click(screen.getByRole('button', { name: /Enregistrer/i }));

    fireEvent.click(screen.getByRole('tab', { name: '1. Informations générales' }));
    expect(screen.getByText(/Une version active existe déjà/i)).toBeInTheDocument();
  });

  it('handles search correctly with one clear button', async () => {
    render(<DocumentsPage onNavigate={() => {}} />);
    const searchInput = await screen.findByRole('searchbox', { name: /Rechercher un modèle/i });
    expect(searchInput).toBeInTheDocument();

    // No clear button initially
    expect(screen.queryByRole('button', { name: /Effacer la recherche/i })).not.toBeInTheDocument();

    // Type something
    fireEvent.change(searchInput, { target: { value: 'Contrat' } });

    // Clear button appears
    const clearButton = screen.getByRole('button', { name: /Effacer la recherche/i });
    expect(clearButton).toBeInTheDocument();

    // Click clear
    fireEvent.click(clearButton);
    expect(searchInput).toHaveValue('');
    expect(document.activeElement).toBe(searchInput);
    expect(screen.queryByRole('button', { name: /Effacer la recherche/i })).not.toBeInTheDocument();
  });
});
