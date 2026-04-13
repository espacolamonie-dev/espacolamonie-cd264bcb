import { useEffect, useState, useRef } from "react";
import { useSearchParams, useParams } from "react-router-dom";
import {
  CheckCircle, Clock, AlertCircle, Download, MessageCircle,
  CreditCard, Calendar, Users, FileText, Loader2, ShieldCheck,
  QrCode, Copy, Upload, ChevronDown, ChevronUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const WHATSAPP_NUMBER = "5531997111502";
const PIX_CNPJ = "61.075.137/0001-08";
const PIX_CNPJ_CLEAN = "61075137000108";

const fmt = (v: number) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (d: string) => {
  if (!d) return "—";
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
};

function generatePixPayload(amount: number): string {
  const formatField = (id: string, value: string) => `${id}${value.length.toString().padStart(2, "0")}${value}`;
  const merchantAccount = formatField("00", "br.gov.bcb.pix") + formatField("01", PIX_CNPJ_CLEAN);
  const merchantAccountField = formatField("26", merchantAccount);
  const amountStr = amount.toFixed(2);
  let payload = "";
  payload += formatField("00", "01");
  payload += merchantAccountField;
  payload += formatField("52", "0000");
  payload += formatField("53", "986");
  payload += formatField("54", amountStr);
  payload += formatField("58", "BR");
  payload += formatField("59", "ESPACO LAMONIE");
  payload += formatField("60", "RIBEIRAO NEVES");
  payload += formatField("62", formatField("05", "***"));
  payload += "6304";
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
      else crc <<= 1;
      crc &= 0xFFFF;
    }
  }
  payload += crc.toString(16).toUpperCase().padStart(4, "0");
  return payload;
}

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
  token: string;
  userId: string;
  pdfUrl: string | null;
}

export default function ClientContractView() {
  const [params] = useSearchParams();
  const { slug: urlSlug } = useParams<{ slug: string }>();
  const tokenParam = params.get("token");
  const [data, setData] = useState<ContractData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Payment state
  const [showPayment, setShowPayment] = useState(false);
  const [payMethod, setPayMethod] = useState<"pix" | "card" | null>(null);
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [receiptSent, setReceiptSent] = useState(false);
  const [cardLoading, setCardLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!tokenParam && !urlSlug) {
      setLoading(false);
      setError("Token de acesso não informado.");
      return;
    }
    const load = async () => {
      try {
        const qp = urlSlug ? `action=get-contract&slug=${urlSlug}` : `action=get-contract&token=${tokenParam}`;
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/contract-public-access?${qp}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Erro ao carregar contrato");
        setData(json);

        if (tokenParam && json.slug) {
          window.history.replaceState(null, "", `/contrato/${json.slug}`);
        }
      } catch (e: any) {
        setError(e.message || "Erro ao carregar contrato");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tokenParam, urlSlug]);

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
  const remainingValue = Number(contract.remaining_value);
  const hasRemaining = remainingValue > 0;

  const statusConfig = isPaid
    ? { icon: CheckCircle, label: "Sinal pago", color: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" }
    : { icon: Clock, label: "Sinal pendente", color: "bg-amber-500/15 text-amber-700 border-amber-500/30" };

  // PIX functions
  const pixPayload = hasRemaining ? generatePixPayload(remainingValue) : "";
  const qrUrl = hasRemaining ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pixPayload)}` : "";

  const copyPix = async () => {
    try {
      await navigator.clipboard.writeText(pixPayload);
    } catch {
      const el = document.createElement("textarea");
      el.value = pixPayload;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleUploadReceipt = async (file: File) => {
    setUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
        reader.readAsDataURL(file);
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const FUNC_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sign-contract`;
      const res = await fetch(FUNC_URL, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          token: data.token,
          action: "upload-receipt",
          file_base64: base64,
          file_name: file.name,
          file_type: file.type || "image/jpeg",
          payment_method: "pix",
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        const errText = await res.text();
        let errMsg = "Erro ao enviar comprovante";
        try { errMsg = JSON.parse(errText).error || errMsg; } catch {}
        throw new Error(errMsg);
      }

      const result = await res.json();
      if (result.success) {
        setReceiptSent(true);
        // Reload data after 2 seconds
        setTimeout(() => window.location.reload(), 2500);
      } else {
        throw new Error(result.error || "Erro ao processar comprovante");
      }
    } catch (err: any) {
      const msg = err?.name === "AbortError"
        ? "A conexão demorou demais. Tente novamente."
        : err?.message || "Erro ao enviar comprovante. Tente novamente.";
      alert(msg);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCardPayment = async () => {
    setCardLoading(true);
    try {
      const CHECKOUT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-mp-checkout`;
      const res = await fetch(CHECKOUT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          contract_id: contract.id,
          token: data.token,
          custom_amount: remainingValue,
          custom_description: `Pagamento restante - ${contract.event_type} - Espaço Lamoniê`,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        if (result.error?.includes("não configurado")) {
          window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Olá! Gostaria de pagar o valor restante do meu contrato no cartão.\n\nNome: ${sig.client_name}\nValor: ${fmt(remainingValue)}`)}`, "_blank");
          return;
        }
        throw new Error(result.error || "Erro ao criar checkout");
      }

      const redirectUrl = result.init_point || result.sandbox_init_point;
      if (redirectUrl) {
        window.location.href = redirectUrl;
      } else {
        throw new Error("URL de checkout não retornada");
      }
    } catch (err: any) {
      alert(err?.message || "Erro ao criar pagamento. Tente novamente.");
    } finally {
      setCardLoading(false);
    }
  };

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
                <span className="font-bold text-lg">{fmt(remainingValue)}</span>
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

        {/* ═══ REMAINING PAYMENT SECTION ═══ */}
        {hasRemaining && (
          <Card className="rounded-2xl border-primary/20">
            <CardContent className="p-5 space-y-4">
              <button
                onClick={() => { setShowPayment(!showPayment); setPayMethod(null); setReceiptSent(false); }}
                className="w-full flex items-center justify-between"
              >
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <CreditCard size={16} className="text-primary" />
                  Pagar valor restante — {fmt(remainingValue)}
                </h3>
                {showPayment ? <ChevronUp size={18} className="text-muted-foreground" /> : <ChevronDown size={18} className="text-muted-foreground" />}
              </button>

              {showPayment && !receiptSent && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  {/* Method selection */}
                  {!payMethod && (
                    <div className="grid gap-3">
                      <button
                        onClick={() => setPayMethod("pix")}
                        className="bg-secondary rounded-xl border border-border p-4 text-left hover:border-primary/40 hover:shadow-md transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                            <QrCode size={22} className="text-emerald-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">PIX</p>
                            <p className="text-xs text-muted-foreground">Pagamento instantâneo via QR Code</p>
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={() => setPayMethod("card")}
                        className="bg-secondary rounded-xl border border-border p-4 text-left hover:border-primary/40 hover:shadow-md transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-11 w-11 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                            <CreditCard size={22} className="text-blue-600" />
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">Cartão de crédito</p>
                            <p className="text-xs text-muted-foreground">Pagamento em até 12x</p>
                          </div>
                        </div>
                      </button>
                    </div>
                  )}

                  {/* PIX Payment */}
                  {payMethod === "pix" && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                      <button onClick={() => setPayMethod(null)} className="text-xs text-primary hover:underline">← Voltar</button>

                      <div className="text-center">
                        <p className="text-xs text-muted-foreground mb-1">Valor a pagar</p>
                        <p className="text-2xl font-bold text-primary">{fmt(remainingValue)}</p>
                      </div>

                      {/* QR Code */}
                      <div className="flex justify-center">
                        <div className="bg-white rounded-xl p-3 shadow-sm border">
                          <img src={qrUrl} alt="QR Code PIX" className="w-[200px] h-[200px]" />
                        </div>
                      </div>

                      {/* Copy PIX */}
                      <div className="bg-secondary rounded-xl p-4">
                        <p className="text-xs text-muted-foreground mb-1">Chave PIX (CNPJ)</p>
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono text-foreground flex-1 break-all">{PIX_CNPJ}</code>
                          <Button variant="outline" size="sm" onClick={copyPix} className="shrink-0 gap-1.5">
                            <Copy size={14} />
                            {copied ? "Copiado!" : "Copiar"}
                          </Button>
                        </div>
                      </div>

                      {/* Upload receipt */}
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">Enviar comprovante</p>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleUploadReceipt(f);
                          }}
                        />
                        <Button
                          variant="outline"
                          className="w-full h-12 rounded-xl gap-2"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploading}
                        >
                          {uploading ? (
                            <>
                              <Loader2 size={16} className="animate-spin" />
                              Enviando comprovante…
                            </>
                          ) : (
                            <>
                              <Upload size={16} />
                              Enviar comprovante PIX
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Card Payment */}
                  {payMethod === "card" && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                      <button onClick={() => setPayMethod(null)} className="text-xs text-primary hover:underline">← Voltar</button>

                      <div className="text-center space-y-2">
                        <p className="text-xs text-muted-foreground">Valor a pagar</p>
                        <p className="text-2xl font-bold text-primary">{fmt(remainingValue)}</p>
                        <p className="text-xs text-muted-foreground">Pagamento seguro via Mercado Pago</p>
                      </div>

                      <Button
                        className="w-full h-12 rounded-xl text-base font-semibold gap-2"
                        onClick={handleCardPayment}
                        disabled={cardLoading}
                      >
                        {cardLoading ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            Preparando checkout…
                          </>
                        ) : (
                          <>
                            <CreditCard size={18} />
                            Pagar com cartão de crédito
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Receipt sent success */}
              {showPayment && receiptSent && (
                <div className="text-center space-y-3 animate-in fade-in duration-300">
                  <div className="bg-emerald-500/15 rounded-full h-14 w-14 flex items-center justify-center mx-auto">
                    <CheckCircle className="h-7 w-7 text-emerald-600" />
                  </div>
                  <h4 className="text-lg font-semibold">Comprovante enviado!</h4>
                  <p className="text-sm text-muted-foreground">Recebemos seu comprovante. A página será atualizada.</p>
                  <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
                </div>
              )}
            </CardContent>
          </Card>
        )}

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
