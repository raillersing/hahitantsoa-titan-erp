import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ErrorBoundary from './ErrorBoundary';

// Suppress React error boundary console.error noise in test output
const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

afterEach(() => {
  cleanup();
});

// Component that throws a render error
function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test render failure');
  }
  return <div>Content rendered successfully</div>;
}

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Content rendered successfully')).toBeInTheDocument();
  });

  it('shows the fallback UI when a child throws a render error', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Test render failure')).toBeInTheDocument();
    expect(screen.getByLabelText('Retry after render error')).toBeInTheDocument();
  });

  it('renders a custom fallback when provided', () => {
    const customFallback = <div>Custom error UI</div>;
    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Custom error UI')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('resets and re-renders children after clicking Retry', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Replace the throwing child with a non-throwing one before resetting
    rerender(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </ErrorBoundary>,
    );

    // Click retry — resets error boundary state, children render without error
    fireEvent.click(screen.getByLabelText('Retry after render error'));

    expect(screen.getByText('Content rendered successfully')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('calls console.error when catching a render error', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>,
    );
    expect(consoleError).toHaveBeenCalled();
  });
});
