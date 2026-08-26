import { Component, type ErrorInfo, type ReactNode } from 'react';
import { t } from '../i18n';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
  componentStack: string | null;
}

function formatLog(error: Error, componentStack: string | null): string {
  const lines = [
    t('errorBoundary.log.header', { timestamp: new Date().toISOString() }),
    '',
    t('errorBoundary.log.message', { message: error.message }),
    '',
    t('errorBoundary.log.stack'),
    error.stack ?? t('errorBoundary.log.noStack')
  ];
  if (componentStack) {
    lines.push('', t('errorBoundary.log.componentStack'), componentStack);
  }
  return lines.join('\n');
}

/**
 * Catches synchronous errors thrown while rendering the children. Errors inside
 * async event handlers do not reach this boundary: those are handled by the
 * try/catch around each `await api.*` call and surface as toasts.
 *
 * When an error is caught a `crash_renderer` event is sent to the main-process
 * logger, best-effort: if the IPC bridge is broken we must not make the crash
 * worse.
 *
 * This is a class component, so it reads the locale through the module-level
 * `t` helper rather than the `useT` hook.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ componentStack: info.componentStack ?? null });
    try {
      // window.api may be missing if the preload script failed to load.
      const api = (window as unknown as { api?: { logEvent?: (...a: unknown[]) => unknown } })
        .api;
      api?.logEvent?.('error', 'crash_renderer', {
        message: error.message,
        stack: error.stack,
        component_stack: info.componentStack
      });
    } catch {
      // Logging here is best-effort.
    }
  }

  handleReload = (): void => {
    if (typeof window !== 'undefined') window.location.reload();
  };

  handleCopyLog = async (): Promise<void> => {
    if (!this.state.error) return;
    const text = formatLog(this.state.error, this.state.componentStack);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // No reliable way to notify the user from inside the error boundary.
    }
  };

  handleContinue = (): void => {
    this.setState({ error: null, componentStack: null });
  };

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="max-w-lg w-full mx-6 rounded-lg bg-app-surface shadow-xl border border-app-border">
          <div className="px-6 py-5 border-b border-app-border">
            <h2 className="text-lg font-semibold text-app-text">{t('errorBoundary.title')}</h2>
          </div>
          <div className="px-6 py-5 text-sm text-app-text whitespace-pre-wrap">
            {t('errorBoundary.body')}
            <span className="font-mono text-xs text-app-text-muted">
              {this.state.error.message}
            </span>
          </div>
          <div className="px-6 py-4 border-t border-app-border flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={this.handleContinue}
              className="px-4 py-2 text-sm rounded-md border border-app-border bg-app-surface hover:bg-app-bg"
            >
              {t('errorBoundary.continue')}
            </button>
            <button
              type="button"
              onClick={() => {
                void this.handleCopyLog();
              }}
              className="px-4 py-2 text-sm rounded-md border border-app-border bg-app-surface hover:bg-app-bg"
            >
              {t('errorBoundary.copyLog')}
            </button>
            <button
              type="button"
              onClick={this.handleReload}
              className="px-4 py-2 text-sm rounded-md bg-app-accent text-white hover:brightness-110"
            >
              {t('errorBoundary.reload')}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
