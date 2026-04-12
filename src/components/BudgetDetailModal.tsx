import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown, Copy, MessageCircle, ExternalLink, CheckCircle, Link as LinkIcon, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import {
  getBudgetById, getBudgetItems, getBudgetLogs, updateBudgetStatus,
  Budget, BudgetItem, BudgetLog, BudgetStatus,
  BUDGET_STATUS_LABELS, BUDGET_STATUS_COLORS,
} from "@/data/budgetStore";
import { generateBudgetPdf } from "@/lib/budgetPdf";
import { supabase } from "@/integrations/supabase/client";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string | null) => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "—";
const fmtDateTime = (d: string) => new Date(d).toLocaleString("pt-BR");

interface Props {
  budgetId: string;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

export default function BudgetDetailModal({ budgetId, open, onClose, onUpdated }: Props) {
  const [budget, setBudget] = useState<Budget | null>(null);
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [logs, setLogs] = useState<BudgetLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [signingLink, setSigningLink] = useState<string | null>(null);
  const [signatureStatus, setSignatureStatus] = useState<string | null>(null);
  const [signedPdfUrl, setSignedPdfUrl] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [b, it, lg] = await Promise.all([
        getBudgetById(budgetId),
        getBudgetItems(budgetId),
        getBudgetLogs(budgetId),
      ]);
      setBudget(b);
      setItems(it);
      setLogs(lg);

      // Check for existing signature
      const { data: sig } = await (supabase
        .from("contract_signatures")
        .select("slug, status, signed_at") as any)
        .eq("budget_id", budgetId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sig) {
        setSignatureStatus((sig as any).status);
        if ((sig as any).slug) {
          setSigningLink(`${window.location.origin}/assinar/${(sig as any).slug}`);
        }
        // Check for signed PDF
        if ((sig as any).status === "signed" && b.pdfUrl) {
          setSignedPdfUrl(b.pdfUrl);
        }
      } else {
        setSignatureStatus(null);
        setSigningLink(null);
        setSignedPdfUrl(null);
      }
    } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  };

  useEffect(() => { if (open) load(); }, [open, budgetId]);

  const changeStatus = async (newStatus: string) => {
    try {
      await updateBudgetStatus(budgetId, newStatus as BudgetStatus);
      toast.success("Status atualizado");
      load();
      onUpdated();
    } catch (e: any) { toast.error(e.message); }
  };

  const getPublicUrl = () => `${window.location.origin}/orcamento/${budget?.publicToken}`;

  const copyLink = () => {
    if (!budget) return;
    navigator.clipboard.writeText(getPublicUrl());
    toast.success("Link copiado para a área de transferência");
  };

  const openPublicView = () => {
    window.open(getPublicUrl(), "_blank");
  };

  const handlePdf = () => {
    if (budget) generateBudgetPdf(budget, items);
  };

  const shareWhatsApp = () => {
    if (!budget) return;
    const url = getPublicUrl();
    const msg = encodeURIComponent(`Olá ${budget.clientName}! Segue o orçamento do seu evento no Espaço Lamoniê:\n\n${url}`);
    const phone = budget.clientPhone.replace(/\D/g, "");
    window.open(`https://wa.me/${phone.startsWith("55") ? phone : "55" + phone}?text=${msg}`, "_blank");
  };

  const handleGenerateSigningLink = async () => {
    if (!budget) return;
    setGeneratingLink(true);
    try {
      // Set status to approved
      if (budget.status !== "approved") {
        await updateBudgetStatus(budgetId, "approved");
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const clientSlug = budget.clientName
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-");

      // Check if slug already exists to avoid duplicates
      const { data: existingSig } = await supabase
        .from("contract_signatures")
        .select("id")
        .eq("slug", clientSlug)
        .maybeSingle();

      const finalSlug = existingSig
        ? `${clientSlug}-orc-${Math.random().toString(36).substring(2, 6)}`
        : clientSlug;

      const { data: sigData, error: sigError } = await supabase
        .from("contract_signatures")
        .insert({
          contract_id: null,
          budget_id: budgetId,
          client_name: budget.clientName,
          client_cpf: null,
          client_phone: budget.clientPhone || null,
          client_address: "",
          event_date: budget.eventDate || new Date().toISOString().split("T")[0],
          event_type: budget.eventType || "Evento",
          total_value: budget.finalTotal,
          deposit_percent: 0,
          rental_type: "Locação (1 dia)",
          event_date_end: null,
          slug: finalSlug,
          user_id: user.id,
        } as any)
        .select()
        .single();

      if (sigError) throw sigError;

      const link = `${window.location.origin}/assinar/${finalSlug}`;
      setSigningLink(link);
      setSignatureStatus("pending");
      toast.success("Link de assinatura gerado com sucesso!");
      load();
      onUpdated();
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar link");
    } finally {
      setGeneratingLink(false);
    }
  };

  const copySigningLink = () => {
    if (signingLink) {
      navigator.clipboard.writeText(signingLink);
      toast.success("Link de assinatura copiado!");
    }
  };

  const shareSigningWhatsApp = () => {
    if (!budget || !signingLink) return;
    const msg = encodeURIComponent(`Olá ${budget.clientName}! Seu orçamento foi aprovado. Por favor, assine o documento acessando o link:\n\n${signingLink}`);
    const phone = budget.clientPhone.replace(/\D/g, "");
    window.open(`https://wa.me/${phone.startsWith("55") ? phone : "55" + phone}?text=${msg}`, "_blank");
  };

  const downloadSignedPdf = async () => {
    if (!signedPdfUrl) return;
    try {
      const { data, error } = await supabase.storage.from("documents").download(signedPdfUrl);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Orçamento Lamoniê – ${budget?.clientName} – Assinado.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e: any) {
      toast.error("Erro ao baixar PDF: " + e.message);
    }
  };

  if (loading || !budget) return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent><p className="text-center py-8 text-muted-foreground">Carregando...</p></DialogContent>
    </Dialog>
  );

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-heading)" }}>Detalhes do Orçamento</DialogTitle>
        </DialogHeader>

        {/* Status + Actions */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <Select value={budget.status} onValueChange={changeStatus}>
            <SelectTrigger className="w-[180px]">
              <Badge variant="outline" className={`${BUDGET_STATUS_COLORS[budget.status]} text-xs`}>
                {BUDGET_STATUS_LABELS[budget.status]}
              </Badge>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(BUDGET_STATUS_LABELS) as BudgetStatus[]).map(s => (
                <SelectItem key={s} value={s}>{BUDGET_STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex flex-wrap gap-1.5 ml-auto">
            <Button size="sm" variant="outline" onClick={copyLink} className="gap-1 text-xs"><Copy size={14} /> Copiar link</Button>
            <Button size="sm" variant="outline" onClick={openPublicView} className="gap-1 text-xs"><ExternalLink size={14} /> Abrir</Button>
            <Button size="sm" variant="outline" onClick={handlePdf} className="gap-1 text-xs"><FileDown size={14} /> PDF</Button>
            {budget.clientPhone && (
              <Button size="sm" variant="outline" onClick={shareWhatsApp} className="gap-1 text-xs"><MessageCircle size={14} /> Enviar</Button>
            )}
          </div>
        </div>

        {/* Signature section */}
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <CheckCircle size={16} className="text-primary" />
            Assinatura do Orçamento
          </h4>

          {signatureStatus === "signed" ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge className="bg-success/15 text-success border-success/30 text-xs">✅ Assinado</Badge>
              </div>
              {signedPdfUrl && (
                <Button size="sm" variant="outline" onClick={downloadSignedPdf} className="gap-1 text-xs">
                  <Download size={14} /> Baixar PDF assinado
                </Button>
              )}
            </div>
          ) : signatureStatus === "pending" && signingLink ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge className="bg-warning/15 text-warning border-warning/30 text-xs">⏳ Aguardando assinatura</Badge>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button size="sm" variant="outline" onClick={copySigningLink} className="gap-1 text-xs">
                  <Copy size={14} /> Copiar link
                </Button>
                {budget.clientPhone && (
                  <Button size="sm" variant="outline" onClick={shareSigningWhatsApp} className="gap-1 text-xs">
                    <MessageCircle size={14} /> Enviar WhatsApp
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => window.open(signingLink, "_blank")} className="gap-1 text-xs">
                  <ExternalLink size={14} /> Abrir link
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Gere um link para que o cliente assine digitalmente este orçamento.
              </p>
              <Button
                size="sm"
                onClick={handleGenerateSigningLink}
                disabled={generatingLink}
                className="gap-2"
              >
                {generatingLink ? <Loader2 size={14} className="animate-spin" /> : <LinkIcon size={14} />}
                {generatingLink ? "Gerando..." : "Aprovar e gerar link de assinatura"}
              </Button>
            </div>
          )}
        </div>

        {/* Client info */}
        <div className="rounded-xl border border-border p-4 space-y-1 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div><span className="text-muted-foreground">Cliente:</span> <span className="font-medium">{budget.clientName}</span></div>
            <div><span className="text-muted-foreground">Telefone:</span> <span className="font-medium">{budget.clientPhone || "—"}</span></div>
            <div><span className="text-muted-foreground">Evento:</span> <span className="font-medium">{budget.eventType || "—"}</span></div>
            <div><span className="text-muted-foreground">Data:</span> <span className="font-medium">{fmtDate(budget.eventDate)}</span></div>
            <div><span className="text-muted-foreground">Pessoas:</span> <span className="font-medium">{budget.guestCount}</span></div>
            <div><span className="text-muted-foreground">Criado em:</span> <span className="font-medium">{fmtDateTime(budget.createdAt)}</span></div>
          </div>
          {budget.notes && <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">{budget.notes}</p>}
        </div>

        {/* Items table */}
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 border-b border-border">
                <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Item</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Qtd</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Unit.</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">%</th>
                <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map(it => (
                <tr key={it.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2">{it.name}</td>
                  <td className="px-4 py-2 text-right">{it.quantity}</td>
                  <td className="px-4 py-2 text-right">{fmt(it.unitPrice)}</td>
                  <td className="px-4 py-2 text-right">{it.percentageApplied}%</td>
                  <td className="px-4 py-2 text-right font-semibold">{fmt(it.finalValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 space-y-2">
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{fmt(budget.subtotal)}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Adicional</span><span>{fmt(budget.additionalTotal)}</span></div>
          <div className="border-t border-primary/20 pt-2 flex justify-between">
            <span className="font-bold text-lg">Total Final</span>
            <span className="font-bold text-lg text-primary">{fmt(budget.finalTotal)}</span>
          </div>
        </div>

        {/* Logs */}
        {logs.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Histórico</h4>
            <div className="space-y-1">
              {logs.map(l => (
                <div key={l.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" />
                  <span>{fmtDateTime(l.createdAt)}</span>
                  <span>—</span>
                  <span>{l.action === "created" ? "Orçamento criado" : `Status: ${BUDGET_STATUS_LABELS[l.oldStatus as BudgetStatus] || l.oldStatus} → ${BUDGET_STATUS_LABELS[l.newStatus as BudgetStatus] || l.newStatus}`}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
