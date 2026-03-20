import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { ErrorBoundary } from "./components/ErrorBoundary";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Elemento #root não encontrado");
}

const root = createRoot(rootElement);

const config = {
  url: import.meta.env.VITE_SUPABASE_URL,
  key: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
};

const missingConfig = Object.entries(config)
  .filter(([, value]) => !value)
  .map(([name]) => name);

function BootstrapError({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
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

async function bootstrap() {
  if (missingConfig.length > 0) {
    console.error("[Bootstrap] Variáveis obrigatórias ausentes:", missingConfig);
    root.render(
      <React.StrictMode>
        <BootstrapError
          title="Configuração incompleta"
          description="Não foi possível iniciar o sistema porque faltam variáveis de ambiente obrigatórias."
        />
      </React.StrictMode>
    );
    return;
  }

  try {
    const { default: App } = await import("./App.tsx");
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    );
  } catch (error) {
    console.error("[Bootstrap] Falha ao carregar a aplicação:", error);
    root.render(
      <React.StrictMode>
        <BootstrapError
          title="Ocorreu um erro ao carregar a aplicação"
          description="Tente recarregar a página. Se o problema persistir, verifique as configurações de deploy."
        />
      </React.StrictMode>
    );
  }
}

void bootstrap();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("[SW] Falha ao registrar service worker:", error);
    });
  });
}
