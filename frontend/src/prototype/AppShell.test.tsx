import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AppShell from './AppShell';

describe('AppShell', () => {
  let mockNavigate: any;

  beforeEach(() => {
    mockNavigate = vi.fn();
    window.localStorage.clear();
    document.documentElement.className = '';
  });

  it('1. "Nouvelle réservation" topbar est actif sur dashboard', () => {
    render(<AppShell activeScope="dashboard" onNavigate={mockNavigate}><div>Content</div></AppShell>);
    const newResButton = screen.getByRole('button', { name: /Nouvelle réservation/i });
    expect(newResButton).not.toBeDisabled();
    expect(newResButton).not.toHaveClass('cursor-not-allowed');
    fireEvent.click(newResButton);
    expect(mockNavigate).toHaveBeenCalledWith('reservation-new');
  });

  it('2. "Nouvelle réservation" topbar est désactivé hors dashboard', () => {
    render(<AppShell activeScope="hahitantsoa" onNavigate={mockNavigate}><div>Content</div></AppShell>);
    const newResButton = screen.getByRole('button', { name: /Nouvelle réservation/i });
    expect(newResButton).toHaveClass('cursor-not-allowed');
    fireEvent.click(newResButton);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('3. "Planning" reste actif', () => {
    render(<AppShell activeScope="hahitantsoa" onNavigate={mockNavigate}><div>Content</div></AppShell>);
    const planningButton = screen.getByRole('button', { name: /Planning/i });
    fireEvent.click(planningButton);
    expect(mockNavigate).toHaveBeenCalledWith('planning');
  });

  it('4. La sidebar ne contient plus "Nouvelle réservation"', () => {
    render(<AppShell activeScope="dashboard" onNavigate={mockNavigate}><div>Content</div></AppShell>);
    const sidebarLinks = screen.getAllByRole('link');
    const newResLink = sidebarLinks.find(link => link.textContent?.includes('Nouvelle réservation'));
    expect(newResLink).toBeUndefined();
  });

  it('5. Le bouton dark/light mode change le thème', () => {
    render(<AppShell activeScope="dashboard" onNavigate={mockNavigate}><div>Content</div></AppShell>);
    const themeBtn = screen.getByTitle('Changer le thème');
    
    // Initially light based on localStorage mock
    expect(document.documentElement).not.toHaveClass('dark');
    
    fireEvent.click(themeBtn);
    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement).toHaveClass('theme-dark');
    expect(localStorage.getItem('theme')).toBe('dark');
    
    fireEvent.click(themeBtn);
    expect(document.documentElement).not.toHaveClass('dark');
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('6. Affiche "Fiche prospect" au lieu de "Fiche client" pour un prospect', () => {
    render(<AppShell activeScope="customer" activeParam="PROS-001" onNavigate={mockNavigate}><div>Content</div></AppShell>);
    
    // Le titre de la page doit être "Fiche prospect"
    expect(screen.getByText('Fiche prospect')).toBeInTheDocument();
    
    // Il ne doit pas y avoir de "Fiche client" comme titre principal
    // screen.getByText('Fiche client') throw s'il ne le trouve pas.
    const titleElements = screen.queryAllByText('Fiche client');
    expect(titleElements.length).toBe(0);
  });

  it('7. La sidebar contient un groupe "OFFRES" avec Catalogue, Packs, Services, Locaux & Dépôts', () => {
    render(<AppShell activeScope="dashboard" onNavigate={mockNavigate}><div>Content</div></AppShell>);
    expect(screen.getByText('Offres')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Catalogue/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Packs/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Services/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Locaux & Dépôts/i })).toBeInTheDocument();
    // 'Packages' n'apparait plus comme libellé
    expect(screen.queryByRole('link', { name: /^Packages$/i })).toBeNull();
  });

  it('7b. La sidebar contient les autres groupes mis à jour', () => {
    render(<AppShell activeScope="dashboard" onNavigate={mockNavigate}><div>Content</div></AppShell>);
    expect(screen.getByText('Inventaire & Logistique')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Facturation & Paiements/i })).toBeInTheDocument();

    // Verifier que "Inventaire & Stocks", "Opérations" et "Stock" n'apparaissent plus
    expect(screen.queryByText('Inventaire & Stocks')).toBeNull();
    expect(screen.queryByRole('link', { name: /^Opérations$/i })).toBeNull();
    expect(screen.queryByRole('link', { name: /^Stock$/i })).toBeNull();
  });

  it('8. Déconnexion n\'est plus dans Accueil, mais dans le menu utilisateur', () => {
    render(<AppShell activeScope="dashboard" onNavigate={mockNavigate}><div>Content</div></AppShell>);
    // Le lien direct n'existe plus car il est caché dans le menu (qui est fermé)
    expect(screen.queryByRole('link', { name: /Déconnexion/i })).toBeNull();
    
    // Ouvre le menu
    const userMenuButton = screen.getByRole('button', { name: 'Menu utilisateur' });
    expect(userMenuButton).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(userMenuButton);
    expect(userMenuButton).toHaveAttribute('aria-expanded', 'true');

    // Vérifie les éléments du menu
    expect(screen.getByRole('link', { name: /Profil utilisateur/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Préférences/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Aide \/ support/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Déconnexion/i })).toBeInTheDocument();
    
    // Teste le clic sur déconnexion
    fireEvent.click(screen.getByRole('link', { name: /Déconnexion/i }));
    expect(mockNavigate).toHaveBeenCalledWith('login');
  });
});
