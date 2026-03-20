import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Clients from "@/pages/Clients";
import Contracts from "@/pages/Contracts";
import Financial from "@/pages/Financial";
import Agenda from "@/pages/Agenda";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import Visits from "@/pages/Visits";

import SignContract from "@/pages/SignContract";
import BookVisit from "@/pages/BookVisit";
import EventDates from "@/pages/EventDates";
import Budgets from "@/pages/Budgets";
import BudgetPublicView from "@/pages/BudgetPublicView";
import Auth from "@/pages/Auth";
import NotFound from "./pages/NotFound";
import { useAuth } from "@/hooks/useAuth";
import { useContractNotifications } from "@/hooks/useContractNotifications";
import { PushNotificationPrompt } from "@/components/PushNotificationPrompt";

const queryClient = new QueryClient();

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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<AuthRoute />} />
          <Route path="/sign" element={<SignContract />} />
          <Route path="/assinar/:slug" element={<SignContract />} />
          <Route path="/agendar-visita" element={<BookVisit />} />
          <Route path="/datas-eventos" element={<EventDates />} />
          <Route path="/orcamento/:token" element={<BudgetPublicView />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/clients" element={<Clients />} />
                    <Route path="/contracts" element={<Contracts />} />
                    <Route path="/financial" element={<Financial />} />
                    <Route path="/agenda" element={<Agenda />} />
                    <Route path="/reports" element={<Reports />} />
                    <Route path="/budgets" element={<Budgets />} />
                    <Route path="/visits" element={<Visits />} />
                    <Route path="/leads" element={<LeadsWhatsApp />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Layout>
                <PushNotificationPrompt />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
