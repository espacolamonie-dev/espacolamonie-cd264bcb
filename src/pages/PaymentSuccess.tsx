import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle, Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const WHATSAPP_NUMBER = "5531997111502";

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const [contractToken, setContractToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const externalRef = params.get("external_reference") || params.get("collection_id");

  useEffect(() => {
    if (!externalRef) {
      setLoading(false);
      setError("Referência do pagamento não encontrada.");
      return;
    }

    const fetchToken = async () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contract-public-access?action=get-token&external_reference=${externalRef}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        });
        const data = await res.json();
        if (data.token) {
          setContractToken(data.token);
          // Auto redirect after 2s
          setTimeout(() => {
            window.location.href = `/contrato/acesso?token=${data.token}`;
          }, 2000);
        } else {
          setError("Não foi possível localizar o contrato.");
        }
      } catch {
        setError("Erro ao buscar dados do contrato.");
      } finally {
        setLoading(false);
      }
    };
    fetchToken();
  }, [externalRef]);

  const contractUrl = contractToken ? `/contrato/acesso?token=${contractToken}` : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white dark:from-emerald-950/20 dark:to-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-3xl border border-border shadow-xl p-8 text-center space-y-6">
          {/* Animated check */}
          <div className="relative mx-auto w-20 h-20">
            <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
            <div className="relative bg-emerald-500/15 rounded-full h-20 w-20 flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-emerald-600" />
            </div>
          </div>

          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Pagamento confirmado! 🎉
            </h1>
            <p className="text-muted-foreground mt-2">
              Seu sinal foi recebido e sua data está reservada.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Redirecionando para seu contrato…</span>
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Agora você já pode acessar seu contrato e acompanhar tudo online.
            </p>
          )}

          <div className="space-y-3">
            {contractUrl && (
              <Button asChild className="w-full h-12 rounded-xl text-base font-semibold">
                <a href={contractUrl}>Acessar meu contrato</a>
              </Button>
            )}
            <Button
              variant="outline"
              className="w-full h-11 rounded-xl gap-2"
              onClick={() => window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Olá! Acabei de realizar o pagamento do sinal.")}`, "_blank")}
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
