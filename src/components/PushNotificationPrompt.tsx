import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Bell } from "lucide-react";
import { useNotificationPermission } from "@/hooks/useContractNotifications";
import { toast } from "sonner";

const STORAGE_KEY = "notificationsPromptDismissed";

export function PushNotificationPrompt() {
  const { permission, isSubscribed, subscribeToPush } = useNotificationPermission();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "true"; } catch { return false; }
  });

  // If user becomes subscribed, persist dismissal so prompt never reappears
  useEffect(() => {
    if (isSubscribed) {
      try { localStorage.setItem(STORAGE_KEY, "true"); } catch {}
    }
  }, [isSubscribed]);

  const handleSubscribe = async () => {
    toast("Configurando notificações...", {
      description: "Por favor, permita o acesso quando solicitado.",
    });

    const success = await subscribeToPush();

    if (success) {
      toast.success("Notificações ativadas!", {
        description: "Você receberá alertas mesmo com o app fechado.",
      });
      try { localStorage.setItem(STORAGE_KEY, "true"); } catch {}
      setDismissed(true);
    } else {
      toast.error("Erro ao ativar notificações", {
        description: "Verifique as permissões do seu navegador.",
      });
    }
  };

  const handleDismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, "true"); } catch {}
    setDismissed(true);
  };

  // Hide if already subscribed, denied, dismissed by user, or not supported
  if (isSubscribed || permission === "denied" || dismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-80 md:bottom-4 bg-background border border-border shadow-lg rounded-xl p-4 z-50 flex flex-col gap-3 animate-in slide-in-from-bottom-2">
      <div className="flex items-start gap-3">
        <div className="bg-primary/10 p-2 rounded-full text-primary">
          <Bell className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-sm">Ativar notificações?</h4>
          <p className="text-xs text-muted-foreground mt-1">
            Receba alertas de contratos assinados e novas visitas mesmo com o app fechado.
          </p>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={handleDismiss}>
          Agora não
        </Button>
        <Button size="sm" onClick={handleSubscribe}>
          Ativar
        </Button>
      </div>
    </div>
  );
}
