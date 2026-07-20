import React from 'react';

type ErrorBoundaryProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  errorMessage: string;
  errorDetails: string;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const isDev: boolean = !!(window as any).__DEV__ ||
  (typeof location !== 'undefined' && location.hostname === 'localhost');

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
    this.state = { hasError: false, errorMessage: '', errorDetails: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    const message =
      error instanceof Error ? error.message : 'An unexpected error occurred.';
    const details =
      error instanceof Error && error.stack ? error.stack : '';
    return { hasError: true, errorMessage: message, errorDetails: details };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught render error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: '', errorDetails: '' });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6" role="alert" aria-live="assertive">
          <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-xl border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-slate-900">Something went wrong</h2>
            </div>
            <p className="text-slate-600">{this.state.errorMessage}</p>

            {isDev && this.state.errorDetails && (
              <details className="mt-4 rounded-lg bg-slate-50 border border-slate-200 p-4">
                <summary className="cursor-pointer text-sm font-medium text-slate-700 hover:text-slate-900">
                  Error details (dev mode)
                </summary>
                <pre className="mt-2 text-xs text-slate-600 whitespace-pre-wrap overflow-auto max-h-64">
                  {this.state.errorDetails}
                </pre>
              </details>
            )}

            <button
              type="button"
              className="mt-6 rounded-lg bg-slate-900 px-5 py-2.5 font-semibold text-white hover:bg-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
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
