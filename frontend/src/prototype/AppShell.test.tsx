import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AppScope } from '../App';
import AppShell, { resolveBrandScope } from './AppShell';
import type { FrontendCapabilities } from '../capabilities';

const hahitantsoaScopes: AppScope[] = [
  'hahitantsoa',
  'packages',
  'services',
  'venues',
  'agenda-visitors',
  'blacklist-intervenants',
];
const titanScopes: AppScope[] = [
  'titan',
  'inventory',
  'inventory-management',
  'inventory-item',
  'stock-movements',
  'stock-preparation',
  'logistics-dispatch',
  'logistics-returns',
  'breakage-loss',
  'caution',
  'import-excel',
];
const mixedErgonScopes: AppScope[] = [
  'dashboard',
  'planning',
  'reservations',
  'customers',
  'commercial-ops',
  'documents',
  'cashbox',
  'audit',
  'reports',
  'admin',
  'help',
  'customer',
  'login',
  'hr-payroll',
  'purchasing',
  'notifications',
  'mobile-tablet',
  'profile',
];

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
    expect(newResButton).toHaveClass('hidden', 'lg:inline-flex');
    expect(newResButton).not.toHaveClass('md:inline-flex');
    fireEvent.click(newResButton);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('2b. masque les surfaces sensibles quand le backend session ne les autorise pas', () => {
    const capabilities: FrontendCapabilities = {
      canManageIdentity: false,
      canViewAudit: false,
      canSensitiveWrite: false,
    };
    render(
      <AppShell
        activeScope="dashboard"
        onNavigate={mockNavigate}
        user={{ id: "1", username: "operator", display_name: "Operator", is_staff: false, roles: ["commercial"] }}
        capabilities={capabilities}
      >
        <div>Content</div>
      </AppShell>,
    );

    expect(screen.queryByRole('link', { name: /Administration/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Audit & Sécurité/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Nouvelle réservation/i })).not.toBeInTheDocument();
  });

  it('2c. ne fail-open pas lorsqu’un utilisateur authentifié n’a pas encore de capacités', () => {
    render(
      <AppShell
        activeScope="dashboard"
        onNavigate={mockNavigate}
        user={{ id: "1", username: "operator", display_name: "Operator", is_staff: false, roles: [] }}
      >
        <div>Content</div>
      </AppShell>,
    );

    expect(screen.queryByRole('link', { name: /Administration/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Audit & Sécurité/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Nouvelle réservation/i })).not.toBeInTheDocument();
  });

  it('3. "Planning" reste actif', () => {
    render(<AppShell activeScope="hahitantsoa" onNavigate={mockNavigate}><div>Content</div></AppShell>);
    const planningButton = screen.getByRole('button', { name: /Planning/i });
    expect(planningButton).toHaveClass('hidden', 'lg:inline-flex');
    expect(planningButton).not.toHaveClass('md:inline-flex');
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

  it('6. Affiche "Fiche client" pour un client', () => {
    render(<AppShell activeScope="customer" activeParam="PROS-001" onNavigate={mockNavigate}><div>Content</div></AppShell>);
    
    // Le titre de la page doit être "Fiche client"
    expect(screen.getByText('Fiche client')).toBeInTheDocument();
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
    const onLogout = vi.fn().mockResolvedValue(undefined);
    render(<AppShell activeScope="dashboard" onNavigate={mockNavigate} onLogout={onLogout}><div>Content</div></AppShell>);
    // Le lien direct n'existe plus car il est caché dans le menu (qui est fermé)
    expect(screen.queryByRole('link', { name: /Déconnexion/i })).toBeNull();
    
    // Ouvre le menu
    const userMenuButton = screen.getByRole('button', { name: 'Menu utilisateur' });
    expect(userMenuButton).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(userMenuButton);
    expect(userMenuButton).toHaveAttribute('aria-expanded', 'true');

    // Vérifie les éléments du menu
    expect(screen.getByRole('link', { name: /Profil utilisateur/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Préférences/i })).toBeDisabled();
    expect(screen.getByRole('link', { name: /Aide \/ support/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Déconnexion/i })).toBeInTheDocument();
    
    // Teste le clic sur déconnexion
    fireEvent.click(screen.getByRole('button', { name: /Déconnexion/i }));
    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalledWith('login');
  });

  it("8a. ouvre le profil réel et branche l'aide existante", () => {
    render(<AppShell activeScope="dashboard" onNavigate={mockNavigate}><div>Content</div></AppShell>);
    const userMenuButton = screen.getByRole("button", { name: "Menu utilisateur" });

    fireEvent.click(userMenuButton);
    fireEvent.click(screen.getByRole("link", { name: "Profil utilisateur" }));
    expect(mockNavigate).toHaveBeenCalledWith("profile");

    fireEvent.click(userMenuButton);
    fireEvent.click(screen.getByRole("link", { name: "Aide / support" }));
    expect(mockNavigate).toHaveBeenCalledWith("help");
  });

  it("8b. affiche une erreur de déconnexion persistante et l'identité backend", () => {
    render(
      <AppShell
        activeScope="dashboard"
        onNavigate={mockNavigate}
        sessionError="Déconnexion refusée"
        user={{ id: "1", username: "ada", display_name: "Ada Operator", is_staff: false, roles: ["commercial"] }}
      >
        <div>Content</div>
      </AppShell>,
    );

    expect(screen.getByText("Ada Operator")).toBeInTheDocument();
    expect(screen.getByText(/commercial · En ligne/)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Déconnexion refusée");
  });

  it("8c. restaure le focus après un rejet de déconnexion", async () => {
    const onLogout = vi.fn().mockRejectedValue(new Error("Network error"));
    render(<AppShell activeScope="dashboard" onNavigate={mockNavigate} onLogout={onLogout}><div>Content</div></AppShell>);

    const userMenuButton = screen.getByRole("button", { name: "Menu utilisateur" });
    fireEvent.click(userMenuButton);
    fireEvent.click(screen.getByRole("button", { name: "Déconnexion" }));

    await waitFor(() => expect(userMenuButton).toHaveFocus());
  });

  it('9. utilise Ergon pour le shell et les pages mixtes', () => {
    render(<AppShell activeScope="dashboard" onNavigate={mockNavigate}><div>Content</div></AppShell>);

    expect(screen.getAllByRole('img', { name: 'Ergon ERP' })).toHaveLength(2);
    expect(screen.queryByText('H/T')).not.toBeInTheDocument();
  });

  it('10. expose le nom accessible du scope même si son libellé est masqué sur mobile', () => {
    render(<AppShell activeScope="titan" onNavigate={mockNavigate}><div>Content</div></AppShell>);

    const scopeIdentity = screen.getByRole('img', { name: 'Titan Rental' });
    expect(scopeIdentity).toHaveClass('topbar-brand-scope');
    expect(scopeIdentity.querySelector('.brand-identity__label')).toHaveAttribute('aria-hidden', 'true');
  });

  it.each(hahitantsoaScopes)('résout le scope mono Hahitantsoa : %s', (scope) => {
    expect(resolveBrandScope(scope)).toBe('hahitantsoa');
  });

  it.each(titanScopes)('résout le scope mono Titan : %s', (scope) => {
    expect(resolveBrandScope(scope)).toBe('titan');
  });

  it.each(mixedErgonScopes)('conserve Ergon pour le scope mixte : %s', (scope) => {
    expect(resolveBrandScope(scope)).toBe('ergon');
  });

  it.each([
    ['RES-2026-0142', 'hahitantsoa'],
    ['LOC-2026-0089', 'titan'],
    ['UNKNOWN-001', 'ergon'],
    [undefined, 'ergon'],
  ] as const)('résout reservation-detail/%s en %s', (param, expected) => {
    expect(resolveBrandScope('reservation-detail', param)).toBe(expected);
  });

  it.each([
    ['hahitantsoa', 'hahitantsoa'],
    ['prospect-proforma-h', 'hahitantsoa'],
    ['prospect-proforma-h/PROS-001', 'hahitantsoa'],
    ['titan', 'titan'],
    ['prospect-proforma-t', 'titan'],
    ['prospect-proforma-t/PROS-001', 'titan'],
    ['catalog-prep|[]', 'titan'],
    ['CUST-001', 'ergon'],
    [undefined, 'ergon'],
  ] as const)('résout reservation-new/%s en %s', (param, expected) => {
    expect(resolveBrandScope('reservation-new', param)).toBe(expected);
  });
});
