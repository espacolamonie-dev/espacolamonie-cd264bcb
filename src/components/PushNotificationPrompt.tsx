import { useEffect } from "react";
import { Button } from "./ui/button";
import { Bell, BellOff } from "lucide-react";
import { useNotificationPermission } from "@/hooks/useContractNotifications";
import { useToast } from "@/hooks/use-toast";

export function PushNotificationPrompt() {
  const { permission, isSubscribed, subscribeToPush } = useNotificationPermission();
  const { toast } = useToast();

  const handleSubscribe = async () => {
    toast({
      title: "Configurando notificações...",
      description: "Por favor, permita o acesso quando solicitado.",
    });

    const success = await subscribeToPush();

    if (success) {
      toast({
        title: "Notificações ativadas! 🎉",
        description: "Você receberá alertas mesmo com o app fechado.",
      });
    } else {
      toast({
        variant: "destructive",
        title: "Erro ao ativar notificações",
        description: "Verifique as permissões do seu navegador.",
      });
    }
  };

  // Se já está inscrito ou negou, não mostra
  if (isSubscribed || permission === "denied") {
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
        <Button variant="outline" size="sm" onClick={() => document.getElementById('push-prompt')?.remove()}>
          Agora não
        </Button>
        <Button size="sm" onClick={handleSubscribe}>
          Ativar
        </Button>
      </div>
    </div>
  );
}
