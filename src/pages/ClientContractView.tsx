import { useEffect, useState } from "react";
import { useSearchParams, useParams } from "react-router-dom";
import {
  CheckCircle, Clock, AlertCircle, Download, MessageCircle,
  CreditCard, Calendar, Users, FileText, Loader2, ShieldCheck
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const WHATSAPP_NUMBER = "5531997111502";

const fmt = (v: number) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (d: string) => {
  if (!d) return "—";
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
};

interface ContractData {
  signature: {
    client_name: string;
    client_phone: string;
    client_cpf: string;
    event_date: string;
    event_date_end: string | null;
    event_type: string;
    total_value: number;
    deposit_percent: number;
    signed_at: string | null;
    status: string;
    rental_type: string | null;
  };
  contract: {
    id: string;
    event_type: string;
    event_date: string;
    event_date_end: string | null;
    event_time: string;
    guest_count: number;
    total_value: number;
    deposit_value: number;
    deposit_percent: number;
    remaining_value: number;
    payment_status: string;
    status: string;
    rental_type: string;
    total_paid: number;
    mp_preference_id: string;
  };
  payments: { amount: number; date: string; description: string }[];
  company: { phone: string; name: string };
  slug: string | null;
  pdfUrl: string | null;
}

export default function ClientContractView() {
  const [params] = useSearchParams();
  const { slug: urlSlug } = useParams<{ slug: string }>();
  const token = params.get("token");
  const [data, setData] = useState<ContractData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token && !urlSlug) {
      setLoading(false);
      setError("Token de acesso não informado.");
      return;
    }
    const load = async () => {
      try {
        const qp = urlSlug ? `action=get-contract&slug=${urlSlug}` : `action=get-contract&token=${token}`;
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contract-public-access?${qp}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Erro ao carregar contrato");
        setData(json);

        // If accessed via token and slug is available, replace URL for cleaner look
        if (token && json.slug) {
          window.history.replaceState(null, "", `/contrato/${json.slug}`);
        }
      } catch (e: any) {
        setError(e.message || "Erro ao carregar contrato");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token, urlSlug]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full rounded-3xl">
          <CardContent className="p-8 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <h1 className="text-xl font-bold">Acesso inválido</h1>
            <p className="text-muted-foreground">{error || "Token inválido ou expirado."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { signature: sig, contract, payments, company } = data;
  const whatsappNumber = company.phone?.replace(/\D/g, "") || WHATSAPP_NUMBER;
  const depositValue = Number(contract.deposit_value) || (Number(contract.total_value) * Number(contract.deposit_percent)) / 100;
  const isPaid = contract.payment_status === "paid" || contract.total_paid >= depositValue;
  const isSigned = !!sig.signed_at;

  const statusConfig = isPaid
    ? { icon: CheckCircle, label: "Sinal pago", color: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" }
    : { icon: Clock, label: "Sinal pendente", color: "bg-amber-500/15 text-amber-700 border-amber-500/30" };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950/30 dark:to-background">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground">{company.name}</h1>
            <p className="text-xs text-muted-foreground">Área do Cliente</p>
          </div>
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Welcome */}
        <div className="text-center space-y-1">
          <h2 className="text-xl font-bold text-foreground">Olá, {sig.client_name?.split(" ")[0]}!</h2>
          <p className="text-sm text-muted-foreground">Aqui estão os detalhes do seu contrato.</p>
        </div>

        {/* Status badges */}
        <div className="flex flex-wrap gap-2 justify-center">
          {isSigned && (
            <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 gap-1">
              <CheckCircle size={12} /> Contrato assinado
            </Badge>
          )}
          <Badge variant="outline" className={`${statusConfig.color} gap-1`}>
            <statusConfig.icon size={12} /> {statusConfig.label}
          </Badge>
        </div>

        {/* Event details */}
        <Card className="rounded-2xl">
          <CardContent className="p-5 space-y-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Calendar size={16} className="text-primary" />
              Dados do Evento
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Tipo</p>
                <p className="font-medium">{contract.event_type || sig.event_type}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Data</p>
                <p className="font-medium">
                  {fmtDate(contract.event_date || sig.event_date)}
                  {contract.event_date_end ? ` a ${fmtDate(contract.event_date_end)}` : ""}
                </p>
              </div>
              {contract.event_time && (
                <div>
                  <p className="text-muted-foreground text-xs">Horário</p>
                  <p className="font-medium">{contract.event_time}</p>
                </div>
              )}
              {contract.guest_count > 0 && (
                <div>
                  <p className="text-muted-foreground text-xs">Convidados</p>
                  <p className="font-medium flex items-center gap-1">
                    <Users size={13} /> {contract.guest_count}
                  </p>
                </div>
              )}
              {contract.rental_type && (
                <div>
                  <p className="text-muted-foreground text-xs">Tipo de locação</p>
                  <p className="font-medium">{contract.rental_type}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Financial */}
        <Card className="rounded-2xl">
          <CardContent className="p-5 space-y-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <CreditCard size={16} className="text-primary" />
              Financeiro
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor total</span>
                <span className="font-semibold">{fmt(contract.total_value)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sinal ({contract.deposit_percent}%)</span>
                <span className="font-semibold">{fmt(depositValue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total pago</span>
                <span className="font-semibold text-emerald-600">{fmt(contract.total_paid)}</span>
              </div>
              <div className="h-px bg-border my-1" />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor restante</span>
                <span className="font-bold text-lg">{fmt(Number(contract.remaining_value))}</span>
              </div>
            </div>

            {/* Payment history */}
            {payments.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Histórico de pagamentos</p>
                <div className="space-y-2">
                  {payments.map((p, i) => (
                    <div key={i} className="flex justify-between items-center text-sm bg-secondary rounded-lg px-3 py-2">
                      <div>
                        <p className="font-medium">{p.description || "Pagamento"}</p>
                        <p className="text-xs text-muted-foreground">{fmtDate(p.date)}</p>
                      </div>
                      <span className="font-semibold text-emerald-600">{fmt(p.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Client info */}
        <Card className="rounded-2xl">
          <CardContent className="p-5 space-y-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <FileText size={16} className="text-primary" />
              Seus Dados
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Nome</p>
                <p className="font-medium">{sig.client_name}</p>
              </div>
              {sig.client_phone && (
                <div>
                  <p className="text-muted-foreground text-xs">Telefone</p>
                  <p className="font-medium">{sig.client_phone}</p>
                </div>
              )}
              {sig.client_cpf && (
                <div>
                  <p className="text-muted-foreground text-xs">CPF</p>
                  <p className="font-medium">{sig.client_cpf}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="space-y-3 pt-2">
          {/* Download signed contract */}
          {isSigned && data.pdfUrl && (
            <Button
              variant="outline"
              className="w-full h-12 rounded-xl text-base font-semibold gap-2 border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10"
              onClick={() => window.open(data.pdfUrl!, "_blank")}
            >
              <Download size={18} />
              Baixar contrato assinado
            </Button>
          )}

          {!isPaid && Number(contract.remaining_value) > 0 && (
            <Button
              className="w-full h-12 rounded-xl text-base font-semibold gap-2"
              onClick={() => {
                if (contract.mp_preference_id) {
                  window.location.href = `https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=${contract.mp_preference_id}`;
                } else {
                  window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Olá! Gostaria de pagar o valor restante do meu contrato.\n\nNome: ${sig.client_name}\nValor: ${fmt(Number(contract.remaining_value))}`)}`, "_blank");
                }
              }}
            >
              <CreditCard size={18} />
              Pagar restante
            </Button>
          )}

          <Button
            variant="outline"
            className="w-full h-11 rounded-xl gap-2"
            onClick={() => window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Olá! Sou ${sig.client_name}, gostaria de informações sobre meu contrato.`)}`, "_blank")}
          >
            <MessageCircle size={16} />
            Falar no WhatsApp
          </Button>
        </div>

        {/* Footer */}
        <div className="text-center py-6 text-xs text-muted-foreground">
          <p>{company.name} • Área do Cliente</p>
          <p className="mt-1">Acesso seguro via link exclusivo</p>
        </div>
      </main>
    </div>
  );
}
