import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StockMovementLedgerPanel from './StockMovementLedgerPanel';

describe('StockMovementLedgerPanel', () => {
  it('renders the panel with pending backend notice', () => {
    render(<StockMovementLedgerPanel />);
    expect(screen.getByTestId('stock-movement-ledger-panel')).toBeInTheDocument();
    expect(screen.getByText('Movement Ledger')).toBeInTheDocument();
    expect(screen.getByText(/Pending Backend Contract/)).toBeInTheDocument();
    expect(screen.getByText(/Stock Movement Ledger backend routes are not yet merged/)).toBeInTheDocument();
  });

  it('renders the pending notice with status role', () => {
    render(<StockMovementLedgerPanel />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('does not render the stock movement list when no records exist', () => {
    render(<StockMovementLedgerPanel />);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
