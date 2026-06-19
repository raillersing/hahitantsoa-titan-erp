import React from 'react';

type ErrorBoundaryProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  errorMessage: string;
};

/**
 * ErrorBoundary catches uncaught render errors in the component tree and
 * displays a graceful fallback rather than a blank screen.
 *
 * Usage: wrap any subtree with <ErrorBoundary> or provide a custom
 * fallback via the `fallback` prop.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred.';
    return { hasError: true, errorMessage: message };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    // In production, wire this to your error reporting service.
    console.error('[ErrorBoundary] Caught render error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="error-boundary-fallback" role="alert" aria-live="assertive">
          <div className="error-boundary-fallback__inner">
            <h2 className="error-boundary-fallback__title">Something went wrong</h2>
            <p className="error-boundary-fallback__message">{this.state.errorMessage}</p>
            <button
              type="button"
              className="error-boundary-fallback__retry"
              onClick={this.handleReset}
              aria-label="Retry after render error"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
