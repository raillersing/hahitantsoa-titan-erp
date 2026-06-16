import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import LogisticsDeliveryPanel from './LogisticsDeliveryPanel';

describe('LogisticsDeliveryPanel', () => {
  it('renders the panel with pending backend notice', () => {
    render(<LogisticsDeliveryPanel />);
    expect(screen.getByTestId('logistics-delivery-panel')).toBeInTheDocument();
    expect(screen.getByText('Delivery Records')).toBeInTheDocument();
    expect(screen.getByText(/Pending Backend Contract/)).toBeInTheDocument();
    expect(screen.getByText(/Logistics & Delivery backend routes are not yet merged/)).toBeInTheDocument();
  });

  it('renders the pending notice with status role', () => {
    render(<LogisticsDeliveryPanel />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('does not render the delivery list when no records exist', () => {
    render(<LogisticsDeliveryPanel />);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
