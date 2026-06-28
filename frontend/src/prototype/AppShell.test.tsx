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
});
