import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { XCircle, MessageCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

const WHATSAPP_NUMBER = "5531997111502";

export default function PaymentFailure() {
  const [params] = useSearchParams();
  const [contractToken, setContractToken] = useState<string | null>(null);
  const externalRef = params.get("external_reference") || params.get("collection_id");

  useEffect(() => {
    if (!externalRef) return;
    const fetchToken = async () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contract-public-access?action=get-token&external_reference=${externalRef}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        });
        const data = await res.json();
        if (data.token) setContractToken(data.token);
      } catch {}
    };
    fetchToken();
  }, [externalRef]);

  const contractUrl = contractToken ? `/contrato/acesso?token=${contractToken}` : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 to-white dark:from-red-950/20 dark:to-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-3xl border border-border shadow-xl p-8 text-center space-y-6">
          <div className="bg-red-500/15 rounded-full h-20 w-20 flex items-center justify-center mx-auto">
            <XCircle className="h-10 w-10 text-red-600" />
          </div>

          <div>
            <h1 className="text-2xl font-bold text-foreground">Pagamento não aprovado</h1>
            <p className="text-muted-foreground mt-2">
              Houve um problema com seu pagamento. Você pode tentar novamente ou entrar em contato conosco.
            </p>
          </div>

          <div className="space-y-3">
            <Button
              className="w-full h-12 rounded-xl text-base font-semibold gap-2"
              onClick={() => window.history.back()}
            >
              <RotateCcw size={16} />
              Tentar novamente
            </Button>
            {contractUrl && (
              <Button asChild variant="outline" className="w-full h-11 rounded-xl">
                <a href={contractUrl}>Acessar contrato</a>
              </Button>
            )}
            <Button
              variant="ghost"
              className="w-full h-11 rounded-xl gap-2"
              onClick={() => window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Olá! Meu pagamento não foi aprovado, podem me ajudar?")}`, "_blank")}
            >
              <MessageCircle size={16} />
              Falar no WhatsApp
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
