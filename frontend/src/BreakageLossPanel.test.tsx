import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import BreakageLossPanel from './BreakageLossPanel';

describe('BreakageLossPanel', () => {
  it('renders the panel with pending backend notice', () => {
    render(<BreakageLossPanel />);
    expect(screen.getByTestId('breakage-loss-panel')).toBeInTheDocument();
    expect(screen.getByText('Damage Assessment')).toBeInTheDocument();
    expect(screen.getByText(/Pending Backend Contract/)).toBeInTheDocument();
    expect(screen.getByText(/Breakage & Loss backend routes are not yet merged/)).toBeInTheDocument();
  });

  it('renders the pending notice with status role', () => {
    render(<BreakageLossPanel />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('does not render the breakage list when no records exist', () => {
    render(<BreakageLossPanel />);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
