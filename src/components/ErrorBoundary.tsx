import React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-3 text-3xl">⚠️</div>
            <h1 className="text-xl font-semibold">Ocorreu um erro ao carregar esta página</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Algo inesperado aconteceu. Tente recarregar para continuar.
            </p>

            {this.state.error && (
              <details className="mt-4 rounded-lg border border-border bg-muted/40 p-3">
                <summary className="cursor-pointer text-xs text-muted-foreground">Detalhes técnicos</summary>
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words text-xs text-destructive">
                  {this.state.error.message}
                  {"\n"}
                  {this.state.error.stack}
                </pre>
              </details>
            )}

            <button
              onClick={() => window.location.reload()}
              className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
