import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  CheckCircle, CreditCard, Clock, QrCode, Copy, Upload,
  Loader2, CalendarIcon, ExternalLink, Smartphone
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const fmt = (v: number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const PIX_CNPJ = "61.075.137/0001-08";
const PIX_CNPJ_CLEAN = "61075137000108";
const WHATSAPP_NUMBER = "5531997111502";

interface Props {
  clientName: string;
  totalValue: number;
  depositPercent: number;
  contractId: string;
  token: string;
  userId: string;
  onComplete: (paymentData?: { payment_choice: string; payment_method_selected: string; payment_due_date?: string }) => void;
}

type PaymentMethod = null | "pix" | "card" | "later";

function generatePixPayload(amount: number): string {
  const formatField = (id: string, value: string) => {
    return `${id}${value.length.toString().padStart(2, "0")}${value}`;
  };
  const merchantAccount = formatField("00", "br.gov.bcb.pix") + formatField("01", PIX_CNPJ_CLEAN);
  const merchantAccountField = formatField("26", merchantAccount);
  const amountStr = amount.toFixed(2);

  let payload = "";
  payload += formatField("00", "01"); // Payload Format
  payload += merchantAccountField;
  payload += formatField("52", "0000"); // MCC
  payload += formatField("53", "986"); // Currency BRL
  payload += formatField("54", amountStr); // Amount
  payload += formatField("58", "BR"); // Country
  payload += formatField("59", "ESPACO LAMONIE"); // Merchant Name
  payload += formatField("60", "RIBEIRAO NEVES"); // City
  payload += formatField("62", formatField("05", "***")); // Additional Data

  // CRC16 placeholder
  payload += "6304";
  // Calculate CRC16-CCITT
  const crc = crc16ccitt(payload);
  payload += crc;
  return payload;
}

function crc16ccitt(str: string): string {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) crc = (crc << 1) ^ 0x1021;
      else crc <<= 1;
      crc &= 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function SignContractPayment({
  clientName, totalValue, depositPercent, contractId, token, userId, onComplete
}: Props) {
  const clientSlug = generateSlug(clientName);
  const clientAreaUrl = `/contrato/${clientSlug}`;
  const [method, setMethod] = useState<PaymentMethod>(null);
  const [copied, setCopied] = useState(false);
  const [installments, setInstallments] = useState<number | null>(null);
  const [laterDate, setLaterDate] = useState<Date | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const [receiptSent, setReceiptSent] = useState(false);
  const [paidAmount, setPaidAmount] = useState<number | null>(null);
  const [remainingAmount, setRemainingAmount] = useState<number | null>(null);
  const [cardLoading, setCardLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const depositValue = (totalValue * depositPercent) / 100;

  const savePaymentChoice = async (choice: string, methodSel: string, dueDate?: string) => {
    try {
      const FUNC_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sign-contract`;
      await fetch(FUNC_URL, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ token, payment_choice: choice, payment_method_selected: methodSel, payment_due_date: dueDate }),
      });
    } catch {}
  };
  const pixPayload = generatePixPayload(depositValue);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pixPayload)}`;

  const FUNC_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sign-contract`;

  const copyPix = async () => {
    try {
      await navigator.clipboard.writeText(pixPayload);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // fallback
      const el = document.createElement("textarea");
      el.value = pixPayload;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
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

      const res = await fetch(FUNC_URL, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          token,
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
        setPaidAmount(result.payment_registered || depositValue);
        setRemainingAmount(result.remaining ?? null);
        savePaymentChoice("pagar_agora", "pix");
        // Auto-redirect to contract view after 2 seconds
        setRedirecting(true);
        setTimeout(() => {
          window.location.href = clientAreaUrl;
        }, 2000);
      } else {
        throw new Error(result.error || "Erro ao processar comprovante");
      }
    } catch (err: any) {
      alert(err?.message || "Erro ao enviar comprovante. Tente novamente.");
    } finally {
      setUploading(false);
      // Reset file input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const openWhatsApp = (message: string, paymentData?: { payment_choice: string; payment_method_selected: string; payment_due_date?: string }) => {
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
    onComplete(paymentData);
  };

  const handleCardPayment = async () => {
    setCardLoading(true);
    try {
      // Save payment choice
      await savePaymentChoice("pagar_agora", "cartao");

      // Create dynamic MP checkout
      const CHECKOUT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-mp-checkout`;
      const res = await fetch(CHECKOUT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ contract_id: contractId, token }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Fallback to static link if MP not configured
        if (data.error?.includes("não configurado")) {
          onComplete({ payment_choice: "pagar_agora", payment_method_selected: "cartao" });
          window.open("https://mpago.la/18R9LwG", "_blank");
          return;
        }
        throw new Error(data.error || "Erro ao criar checkout");
      }

      // Redirect to Mercado Pago checkout
      const redirectUrl = data.init_point || data.sandbox_init_point;
      if (redirectUrl) {
        onComplete({ payment_choice: "pagar_agora", payment_method_selected: "cartao" });
        window.location.href = redirectUrl;
      } else {
        throw new Error("URL de checkout não retornada");
      }
    } catch (err: any) {
      console.error("MP checkout error:", err);
      alert(err?.message || "Erro ao criar pagamento. Tente novamente.");
    } finally {
      setCardLoading(false);
    }
  };

  const handleLaterPayment = () => {
    if (!laterDate) return;
    const dateStr = format(laterDate, "dd/MM/yyyy");
    const isoDate = format(laterDate, "yyyy-MM-dd");
    const msg = `Olá! Assinei o contrato e quero combinar o pagamento do sinal para outro dia.\n\nNome: ${clientName}\nValor do sinal: ${fmt(depositValue)}\nData prevista para pagamento: ${dateStr}\n\nPodem confirmar se está tudo certo?`;
    openWhatsApp(msg, { payment_choice: "pagar_depois", payment_method_selected: "pix", payment_due_date: isoDate });
  };

  // ═══ METHOD SELECTION ═══
  if (!method) {
    return (
      <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Success banner */}
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 text-center">
          <div className="bg-emerald-500/15 rounded-full h-14 w-14 flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="h-7 w-7 text-emerald-600" />
          </div>
          <h2 className="text-lg font-display font-semibold text-foreground">Contrato assinado com sucesso!</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Agora falta apenas o pagamento do sinal para garantir sua reserva.
          </p>
        </div>

        {/* Deposit value highlight */}
        <div className="bg-card rounded-2xl border border-border shadow-sm p-5 text-center">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Valor do sinal</p>
          <p className="text-3xl font-bold text-primary">{fmt(depositValue)}</p>
          <div className="flex items-center justify-center gap-3 mt-3 text-xs text-muted-foreground">
            <span>Total: {fmt(totalValue)}</span>
            <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
            <span>Sinal: {depositPercent}%</span>
          </div>
        </div>

        {/* Payment options */}
        <div>
          <h3 className="text-base font-display font-semibold text-foreground mb-3 text-center">
            Escolha a forma de pagamento
          </h3>
          <div className="grid gap-3">
            <button
              onClick={() => setMethod("pix")}
              className="bg-card rounded-xl border border-border p-4 text-left hover:border-primary/40 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <QrCode size={22} className="text-emerald-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">PIX</p>
                  <p className="text-xs text-muted-foreground">Pagamento instantâneo via QR Code ou chave</p>
                </div>
              </div>
            </button>
            <button
              onClick={() => setMethod("card")}
              className="bg-card rounded-xl border border-border p-4 text-left hover:border-primary/40 hover:shadow-md transition-all group"
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
            <button
              onClick={() => setMethod("later")}
              className="bg-card rounded-xl border border-border p-4 text-left hover:border-primary/40 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Clock size={22} className="text-amber-600" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">Pagar depois</p>
                  <p className="text-xs text-muted-foreground">Combine uma data para realizar o pagamento</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══ PIX ═══
  if (method === "pix") {
    if (receiptSent) {
      return (
        <div className="space-y-5 animate-in fade-in duration-300">
          <div className="bg-card rounded-2xl border border-border shadow-sm p-8 text-center">
            <div className="relative mx-auto w-16 h-16 mb-4">
              {redirecting && <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />}
              <div className="relative bg-emerald-500/15 rounded-full h-16 w-16 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-emerald-600" />
              </div>
            </div>
            <h2 className="text-xl font-display font-semibold text-foreground mb-2">Comprovante enviado!</h2>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              {redirecting
                ? "Redirecionando para seu contrato…"
                : "Recebemos seu comprovante. Aguardando validação."
              }
            </p>

            {redirecting && (
              <div className="flex items-center justify-center gap-2 mt-4 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Abrindo área do contrato…</span>
              </div>
            )}

            {/* Payment summary */}
            <div className="bg-secondary rounded-xl p-4 mt-5 text-left space-y-2 max-w-sm mx-auto">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Valor enviado:</span>
                <span className="font-semibold text-foreground">{fmt(paidAmount || depositValue)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Método:</span>
                <span className="font-semibold text-foreground">PIX</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status:</span>
                <span className="font-semibold text-amber-600">Comprovante enviado ⏳</span>
              </div>
            </div>

            <Button
              onClick={() => window.location.href = clientAreaUrl}
              className="mt-6 w-full h-11 rounded-xl"
            >
              Acessar meu contrato
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-400">
        <button onClick={() => setMethod(null)} className="text-xs text-primary hover:underline">
          ← Voltar
        </button>

        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="bg-emerald-500/10 px-5 py-3 border-b border-border flex items-center gap-2">
            <QrCode size={16} className="text-emerald-600" />
            <span className="font-semibold text-sm text-foreground">Pagamento via PIX</span>
          </div>
          <div className="p-5 space-y-5">
            {/* Amount */}
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Valor a pagar</p>
              <p className="text-2xl font-bold text-primary">{fmt(depositValue)}</p>
            </div>

            {/* QR Code */}
            <div className="flex justify-center">
              <div className="bg-white rounded-xl p-3 shadow-sm border">
                <img src={qrUrl} alt="QR Code PIX" className="w-[200px] h-[200px]" />
              </div>
            </div>

            {/* PIX Key */}
            <div className="bg-secondary rounded-xl p-4">
              <p className="text-xs text-muted-foreground mb-1">Chave PIX (CNPJ)</p>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono text-foreground flex-1 break-all">{PIX_CNPJ}</code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyPix}
                  className="shrink-0 gap-1.5"
                >
                  {copied ? <CheckCircle size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  {copied ? "Copiado!" : "Copiar"}
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Após realizar o pagamento, envie o comprovante abaixo para confirmar.
            </p>

            {/* Upload receipt */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUploadReceipt(file);
              }}
            />
            <Button
              onClick={() => {
                // Reset value before click to allow re-selecting same file
                if (fileInputRef.current) fileInputRef.current.value = "";
                fileInputRef.current?.click();
              }}
              disabled={uploading}
              className="w-full h-12 rounded-xl text-base font-semibold gap-2"
            >
              {uploading ? (
                <><Loader2 className="h-5 w-5 animate-spin" /> Enviando...</>
              ) : (
                <><Upload size={18} /> Já paguei / Enviar comprovante</>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ═══ CARTÃO ═══
  if (method === "card") {
    return (
      <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-400">
        <button onClick={() => setMethod(null)} className="text-xs text-primary hover:underline">
          ← Voltar
        </button>

        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="bg-blue-500/10 px-5 py-3 border-b border-border flex items-center gap-2">
            <CreditCard size={16} className="text-blue-600" />
            <span className="font-semibold text-sm text-foreground">Cartão de crédito</span>
          </div>
          <div className="p-5 space-y-5">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Valor do sinal</p>
              <p className="text-2xl font-bold text-primary">{fmt(depositValue)}</p>
            </div>

            <p className="text-sm text-muted-foreground text-center">
              Você será redirecionado para a página de pagamento segura do Mercado Pago para finalizar com cartão de crédito.
            </p>

            <Button
              onClick={handleCardPayment}
              disabled={cardLoading}
              className="w-full h-12 rounded-xl text-base font-semibold gap-2"
            >
              {cardLoading ? (
                <><Loader2 className="h-5 w-5 animate-spin" /> Criando pagamento...</>
              ) : (
                <><CreditCard size={18} /> Pagar com cartão <ExternalLink size={14} /></>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ═══ PAGAR DEPOIS ═══
  if (method === "later") {
    return (
      <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-400">
        <button onClick={() => setMethod(null)} className="text-xs text-primary hover:underline">
          ← Voltar
        </button>

        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="bg-amber-500/10 px-5 py-3 border-b border-border flex items-center gap-2">
            <Clock size={16} className="text-amber-600" />
            <span className="font-semibold text-sm text-foreground">Pagar depois</span>
          </div>
          <div className="p-5 space-y-5">
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">Valor do sinal</p>
              <p className="text-2xl font-bold text-primary">{fmt(depositValue)}</p>
            </div>

            <div>
              <p className="text-sm font-medium text-foreground mb-3 text-center">
                Qual dia você poderá realizar o pagamento?
              </p>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-11 rounded-xl",
                      !laterDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {laterDate ? format(laterDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "Selecione uma data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="center">
                  <Calendar
                    mode="single"
                    selected={laterDate}
                    onSelect={setLaterDate}
                    disabled={(date) => date < new Date()}
                    className={cn("p-3 pointer-events-auto")}
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <Button
              onClick={handleLaterPayment}
              disabled={!laterDate}
              className="w-full h-12 rounded-xl text-base font-semibold gap-2 disabled:opacity-40"
            >
              <Smartphone size={18} />
              Confirmar via WhatsApp
              <ExternalLink size={14} />
            </Button>

            <p className="text-[11px] text-muted-foreground text-center">
              Você será redirecionado para o WhatsApp do Espaço Lamoniê para combinar o pagamento.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
