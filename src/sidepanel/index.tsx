import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[RezBuilder Sidepanel Runtime Error]:', error, errorInfo);
  }

  public handleReload = () => {
    if (typeof window !== 'undefined' && window.location) {
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div
          data-testid="error-boundary-fallback"
          className="flex flex-col items-center justify-center min-h-screen p-6 bg-surface-950 text-surface-100 text-center space-y-3 font-sans"
        >
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 text-xl font-bold shadow-lg shadow-rose-950/30">
            !
          </div>
          <h2 className="text-sm font-semibold text-white tracking-tight">Something went wrong</h2>
          <p className="text-xs text-surface-400 max-w-xs leading-relaxed">
            {this.state.error?.message || 'An unexpected error occurred while rendering the sidepanel.'}
          </p>
          <button
            onClick={this.handleReload}
            data-testid="error-boundary-reload-button"
            className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-white text-xs font-semibold shadow-md shadow-brand-950/20 transition-all active:scale-95"
          >
            Reload Sidepanel
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}
