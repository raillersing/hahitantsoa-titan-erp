import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import PackageBuilderPage from './PackageBuilderPage';

describe('PackageBuilderPage', () => {
  beforeEach(() => {
    // Mock URL.createObjectURL
    window.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/mock-url');
  });

  it('1. Affiche le nom du pack complet en vue Grille et Détails', () => {
    render(<PackageBuilderPage />);
    
    // Grille
    expect(screen.getByText('Package Standard 100 pax')).toBeInTheDocument();
    
    // Switch to details
    const detailsBtn = screen.getByRole('button', { name: /Détails/i });
    fireEvent.click(detailsBtn);
    
    // Détails: should still show the full name
    const listItems = screen.getAllByText('Package Standard 100 pax');
    expect(listItems.length).toBeGreaterThan(0);
    
    // Ensure line-clamp-2 is NOT on the h3 in details (it is whitespace-normal break-words)
    const titleElement = listItems[0];
    expect(titleElement.className).not.toContain('line-clamp-2');
    expect(titleElement.className).toContain('whitespace-normal');
  });

  it('2. Le formulaire contient un champ de fichier local pour l\'image', () => {
    render(<PackageBuilderPage />);
    
    // Ensure we are in details mode (clicking a pack or the details button)
    const detailsBtn = screen.getByRole('button', { name: /Détails/i });
    fireEvent.click(detailsBtn);
    
    const packInList = screen.getAllByText('Package Standard 100 pax')[0];
    fireEvent.click(packInList);
    
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();
  });

  it('3. La sélection d\'un fichier local met à jour l\'image du pack', () => {
    render(<PackageBuilderPage />);
    
    // Goto details
    fireEvent.click(screen.getByRole('button', { name: /Détails/i }));
    fireEvent.click(screen.getAllByText('Package Standard 100 pax')[0]);
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    const file = new File(['hello'], 'hello.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    
    expect(window.URL.createObjectURL).toHaveBeenCalledWith(file);
    
    // L'image doit apparaitre
    const images = screen.getAllByAltText('Package Standard 100 pax');
    expect(images[0]).toHaveAttribute('src', 'blob:http://localhost/mock-url');
  });

  it('4. Retirer l\'image fonctionne', () => {
    render(<PackageBuilderPage />);
    fireEvent.click(screen.getByRole('button', { name: /Détails/i }));
    fireEvent.click(screen.getAllByText('Package Standard 100 pax')[0]);
    
    // Set image first
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['hello'], 'hello.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    
    // Click Retirer
    const removeBtn = screen.getByText('Retirer');
    fireEvent.click(removeBtn);
    
    // Image should be removed
    const images = screen.queryAllByAltText('Package Standard 100 pax');
    // None should have the blob URL anymore
    images.forEach(img => {
      expect(img.getAttribute('src')).not.toBe('blob:http://localhost/mock-url');
    });
  });

  it('5. Ajouter du matériel ouvre la modale', () => {
    render(<PackageBuilderPage />);
    fireEvent.click(screen.getByRole('button', { name: /Détails/i }));
    fireEvent.click(screen.getAllByText('Package Standard 100 pax')[0]);
    
    const addMatBtn = screen.getAllByText(/Ajouter du matériel/i)[0];
    fireEvent.click(addMatBtn);
    
    expect(screen.getByText('Ajouter du matériel au pack')).toBeInTheDocument();
  });
});
