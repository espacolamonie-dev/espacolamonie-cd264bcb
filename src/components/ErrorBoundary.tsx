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
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Poppins', sans-serif",
          background: "#f4f5f7",
          padding: "2rem",
        }}>
          <div style={{
            background: "#fff",
            borderRadius: "16px",
            padding: "2.5rem",
            maxWidth: "420px",
            width: "100%",
            textAlign: "center",
            boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
          }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>⚠️</div>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "0.5rem", color: "#1a1a1a" }}>
              Ocorreu um erro
            </h1>
            <p style={{ fontSize: "0.875rem", color: "#666", marginBottom: "1.5rem", lineHeight: 1.5 }}>
              Algo inesperado aconteceu ao carregar a aplicação. Tente recarregar a página.
            </p>
            {this.state.error && (
              <details style={{ textAlign: "left", marginBottom: "1.5rem" }}>
                <summary style={{ fontSize: "0.75rem", color: "#999", cursor: "pointer" }}>Detalhes técnicos</summary>
                <pre style={{
                  fontSize: "0.7rem",
                  color: "#c00",
                  background: "#fff5f5",
                  padding: "0.75rem",
                  borderRadius: "8px",
                  marginTop: "0.5rem",
                  overflow: "auto",
                  maxHeight: "120px",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}>
                  {this.state.error.message}
                  {"\n"}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              style={{
                background: "#2d5a3f",
                color: "#fff",
                border: "none",
                borderRadius: "12px",
                padding: "0.75rem 2rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
                width: "100%",
              }}
            >
              Recarregar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
