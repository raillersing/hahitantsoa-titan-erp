import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ReturnsHandlingPanel from './ReturnsHandlingPanel';

describe('ReturnsHandlingPanel', () => {
  it('renders the panel with pending backend notice', () => {
    render(<ReturnsHandlingPanel />);
    expect(screen.getByTestId('returns-handling-panel')).toBeInTheDocument();
    expect(screen.getByText('Returns Log')).toBeInTheDocument();
    expect(screen.getByText(/Pending Backend Contract/)).toBeInTheDocument();
    expect(screen.getByText(/Returns Handling backend routes are not yet merged/)).toBeInTheDocument();
  });

  it('renders the pending notice with status role', () => {
    render(<ReturnsHandlingPanel />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('does not render the returns list when no records exist', () => {
    render(<ReturnsHandlingPanel />);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
