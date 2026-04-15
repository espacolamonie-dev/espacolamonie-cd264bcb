import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Layout from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { useContractNotifications } from "@/hooks/useContractNotifications";
import { PushNotificationPrompt } from "@/components/PushNotificationPrompt";
import { captureUtmParams } from "@/lib/utmTracker";

// Lazy-loaded pages
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Clients = lazy(() => import("@/pages/Clients"));
const Contracts = lazy(() => import("@/pages/Contracts"));
const Financial = lazy(() => import("@/pages/Financial"));
const Agenda = lazy(() => import("@/pages/Agenda"));
const Reports = lazy(() => import("@/pages/Reports"));
const Settings = lazy(() => import("@/pages/Settings"));
const Visits = lazy(() => import("@/pages/Visits"));
const Budgets = lazy(() => import("@/pages/Budgets"));
const Marketing = lazy(() => import("@/pages/Marketing"));
const SignContract = lazy(() => import("@/pages/SignContract"));
const BookVisit = lazy(() => import("@/pages/BookVisit"));
const EventDates = lazy(() => import("@/pages/EventDates"));
const BudgetPublicView = lazy(() => import("@/pages/BudgetPublicView"));
const PaymentSuccess = lazy(() => import("@/pages/PaymentSuccess"));
const PaymentPending = lazy(() => import("@/pages/PaymentPending"));
const PaymentFailure = lazy(() => import("@/pages/PaymentFailure"));
const ClientContractView = lazy(() => import("@/pages/ClientContractView"));
const KeyDeliverySign = lazy(() => import("@/pages/KeyDeliverySign"));
const VisitConfirmation = lazy(() => import("@/pages/VisitConfirmation"));
const Auth = lazy(() => import("@/pages/Auth"));
const NotFound = lazy(() => import("@/pages/NotFound"));

function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

/** Fire PageView on every SPA route change */
function MetaPixelPageView() {
  const location = useLocation();
  useEffect(() => {
    if (typeof (window as any).fbq === "function") {
      (window as any).fbq("track", "PageView");
    }
  }, [location.pathname]);
  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  // Hook for push notifications when user is authenticated
  useContractNotifications();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <>{children}</>;
}

function AuthRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <Auth />;
}

const App = () => {
  useEffect(() => { captureUtmParams(); }, []);
  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <MetaPixelPageView />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/auth" element={<AuthRoute />} />
            <Route path="/sign" element={<SignContract />} />
            <Route path="/assinar/:slug" element={<SignContract />} />
            <Route path="/agendar-visita" element={<BookVisit />} />
            <Route path="/datas-eventos" element={<EventDates />} />
            <Route path="/orcamento/:token" element={<BudgetPublicView />} />
            <Route path="/pagamento/sucesso" element={<PaymentSuccess />} />
            <Route path="/pagamento/pendente" element={<PaymentPending />} />
            <Route path="/pagamento/falha" element={<PaymentFailure />} />
            <Route path="/contrato/acesso" element={<ClientContractView />} />
            <Route path="/contrato/:slug" element={<ClientContractView />} />
            <Route path="/termo-chaves" element={<KeyDeliverySign />} />
            <Route path="/visita/:slug" element={<VisitConfirmation />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Suspense fallback={<PageLoader />}>
                      <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/clients" element={<Clients />} />
                        <Route path="/contracts" element={<Contracts />} />
                        <Route path="/financial" element={<Financial />} />
                        <Route path="/agenda" element={<Agenda />} />
                        <Route path="/reports" element={<Reports />} />
                        <Route path="/budgets" element={<Budgets />} />
                        <Route path="/visits" element={<Visits />} />
                        <Route path="/marketing" element={<Marketing />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </Suspense>
                  </Layout>
                  <PushNotificationPrompt />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
