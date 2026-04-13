import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle, Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const WHATSAPP_NUMBER = "5531997111502";

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contractUrl, setContractUrl] = useState<string | null>(null);

  // Read all possible MP callback params
  const externalRef = params.get("external_reference");
  const collectionId = params.get("collection_id");
  const collectionStatus = params.get("collection_status");
  const paymentId = params.get("payment_id");
  const status = params.get("status");

  // Log all received params for debugging
  useEffect(() => {
    console.log("[PaymentSuccess] URL params:", {
      external_reference: externalRef,
      collection_id: collectionId,
      collection_status: collectionStatus,
      payment_id: paymentId,
      status,
    });
  }, []);

  // The external_reference is the contract_id; fallback to collection_id
  const contractRef = externalRef || collectionId;

  useEffect(() => {
    if (!contractRef) {
      setLoading(false);
      // Don't show error — show fallback message
      return;
    }

    let cancelled = false;
    const fetchAndRedirect = async () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contract-public-access?action=get-token&external_reference=${contractRef}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        });
        const data = await res.json();

        if (cancelled) return;

        if (data.slug) {
          setContractUrl(`/contrato/${data.slug}`);
        } else if (data.token) {
          setContractUrl(`/contrato/acesso?token=${data.token}`);
        }
      } catch (err) {
        console.error("[PaymentSuccess] Error fetching contract:", err);
        if (!cancelled) {
          setError("Não foi possível localizar o contrato automaticamente.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAndRedirect();
    return () => { cancelled = true; };
  }, [contractRef]);

  // Auto-redirect after contract URL is resolved
  useEffect(() => {
    if (!contractUrl) return;
    const timer = setTimeout(() => {
      window.location.href = contractUrl;
    }, 3000);
    return () => clearTimeout(timer);
  }, [contractUrl]);

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
              <span className="text-sm">Localizando seu contrato…</span>
            </div>
          ) : contractUrl ? (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Redirecionando para seu contrato…</span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {error || "Pagamento concluído. Estamos verificando seu status."}
            </p>
          )}

          <div className="space-y-3">
            {contractUrl && (
              <Button asChild className="w-full h-12 rounded-xl text-base font-semibold">
                <a href={contractUrl}>Acessar meu contrato</a>
              </Button>
            )}
            {!contractUrl && !loading && (
              <Button
                className="w-full h-12 rounded-xl text-base font-semibold"
                onClick={() => window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent("Olá! Acabei de realizar o pagamento do sinal. Podem me ajudar a acessar meu contrato?")}`, "_blank")}
              >
                Falar conosco para acessar o contrato
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
