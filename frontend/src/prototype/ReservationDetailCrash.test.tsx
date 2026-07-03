import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import ReservationDetailPage from './ReservationDetailPage';

describe('ReservationDetailPage crash safety', () => {
  it('renders LOC-2026-0088 without crash', () => {
    render(<ReservationDetailPage onNavigate={() => {}} param="LOC-2026-0088" />);
    expect(screen.getByText(/Réservation LOC-2026-0088/i)).toBeInTheDocument();
  });

  it('renders LOC-2026-0089 without crash', () => {
    render(<ReservationDetailPage onNavigate={() => {}} param="LOC-2026-0089" />);
    expect(screen.getByText(/Réservation LOC-2026-0089/i)).toBeInTheDocument();
  });

  it('renders RES-2026-0142 without crash', () => {
    render(<ReservationDetailPage onNavigate={() => {}} param="RES-2026-0142" />);
    expect(screen.getByText(/Réservation RES-2026-0142/i)).toBeInTheDocument();
  });
});
