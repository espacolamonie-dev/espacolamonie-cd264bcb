import { useEffect, useState, useRef, lazy, Suspense } from "react";
import { formatDateBR } from "@/lib/dateUtils";
import { CurrencyInput } from "@/components/CurrencyInput";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { getSafeErrorMessage } from "@/lib/errorSanitizer";
import { CalendarDays, Users, DollarSign, FileText, Plus, AlertTriangle, Upload, Trash2, Download, FileOutput, ShieldCheck, Monitor, Smartphone, Globe, Hash, Clock, Pencil, X, Receipt } from "lucide-react";
import ReservationCountdown from "@/components/ReservationCountdown";
import ImportReceiptModal from "@/components/ImportReceiptModal";
import { AttributionBadge } from "@/components/AttributionBadge";
import GenerateContractModal from "@/components/GenerateContractModal";
import ContractTimeline from "@/components/ContractTimeline";
import { supabase } from "@/integrations/supabase/client";
import { triggerGoogleSync } from "@/lib/googleSync";
import {
  getContracts, getClients, getPayments, getDocuments, addPayment, updateContract,
  addDocument, deleteDocument, getDocumentSignedUrl,
} from "@/data/store";
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUS_COLORS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS } from "@/types";
import type { Contract, Client, Payment, Document } from "@/types";
import { useIsMobile } from "@/hooks/use-mobile";

interface Props { contractId: string; onClose: () => void; onEdit?: () => void; }

interface AuditLog {
  id: string;
  contract_id: string;
  client_name: string;
  client_cpf: string | null;
  signed_file_name: string;
  signature_type: string;
  signed_at: string;
  read_confirmed: boolean;
  signer_ip: string | null;
  device_type: string | null;
  operating_system: string | null;
  browser: string | null;
  user_agent: string | null;
  pdf_hash: string | null;
  contract_version: number;
  created_at: string;
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ContractDetailModal({ contractId, onClose, onEdit }: Props) {
  const [contract, setContract] = useState<Contract | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [docs, setDocs] = useState<Document[]>([]);
  const [payForm, setPayForm] = useState({ amount: 0, date: new Date().toISOString().split("T")[0], description: "", tag: "none" as "none" | "sinal" | "restante" });
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState<string>("outro");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const isMobile = useIsMobile();

  // Payment selection state
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [paymentIdsToDelete, setPaymentIdsToDelete] = useState<string[]>([]);

  const load = async () => {
    try {
      const [allContracts, allClients, allPayments, allDocs] = await Promise.all([
        getContracts(), getClients(), getPayments(), getDocuments(),
      ]);
      const c = allContracts.find((c) => c.id === contractId);
      setContract(c || null);
      if (c) {
        setClient(allClients.find((cl) => cl.id === c.clientId) || null);
        setPayments(allPayments.filter((p) => p.contractId === contractId));
        setDocs(allDocs.filter((d) => d.contractId === contractId));
      }

      // Load audit logs
      const { data: logs } = await supabase
        .from("signature_audit_logs")
        .select("*")
        .eq("contract_id", contractId)
        .order("created_at", { ascending: false });
      setAuditLogs((logs as AuditLog[]) || []);
    } catch {}
  };
  useEffect(() => { load(); }, [contractId]);

  if (!contract) return null;

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

  const handleAddPayment = async () => {
    if (payForm.amount <= 0) { toast.error("Informe o valor do pagamento"); return; }
    const desc = payForm.tag === "sinal"
      ? (payForm.description || "Sinal pago manualmente")
      : payForm.tag === "restante"
        ? (payForm.description || "Pagamento do restante")
        : payForm.description;
    try {
      await addPayment({ ...payForm, description: desc, contractId });
      toast.success("Pagamento registrado com sucesso");
      setPayForm({ amount: 0, date: new Date().toISOString().split("T")[0], description: "", tag: "none" });
      await load();
      triggerGoogleSync(contractId);
    } catch (e: any) { toast.error(getSafeErrorMessage(e)); }
  };

  const handleTagChange = (tag: string) => {
    const t = tag as "none" | "sinal" | "restante";
    if (t === "sinal" && contract) {
      setPayForm((p) => ({ ...p, tag: t, amount: contract.depositValue, description: "Sinal pago manualmente" }));
    } else if (t === "restante" && contract) {
      setPayForm((p) => ({ ...p, tag: t, amount: contract.remainingValue, description: "Pagamento do restante" }));
    } else {
      setPayForm((p) => ({ ...p, tag: t }));
    }
  };

  // Payment selection helpers
  const allSelected = payments.length > 0 && selectedPaymentIds.size === payments.length;
  const someSelected = selectedPaymentIds.size > 0 && selectedPaymentIds.size < payments.length;

  const togglePayment = (id: string) => {
    setSelectedPaymentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedPaymentIds(new Set());
    } else {
      setSelectedPaymentIds(new Set(payments.map((p) => p.id)));
    }
  };

  const requestDeletePayments = (ids: string[]) => {
    setPaymentIdsToDelete(ids);
    setDeleteConfirmOpen(true);
  };

  const confirmDeletePayments = async () => {
    setDeleteConfirmOpen(false);
    try {
      for (const id of paymentIdsToDelete) {
        await supabase.from("payments").delete().eq("id", id);
      }
      const remainingPayments = payments.filter((p) => !paymentIdsToDelete.includes(p.id));
      const totalPaidAfter = remainingPayments.reduce((s, p) => s + p.amount, 0);
      const contractTotal = contract!.totalValue;
      const remaining = Math.max(0, contractTotal - totalPaidAfter);
      let newPaymentStatus = "pending";
      if (totalPaidAfter >= contractTotal) newPaymentStatus = "paid_full";
      else if (totalPaidAfter > 0) newPaymentStatus = "deposit_paid";
      await supabase
        .from("contracts")
        .update({ remaining_value: remaining, payment_status: newPaymentStatus })
        .eq("id", contractId);
      setSelectedPaymentIds(new Set());
      toast.success(
        paymentIdsToDelete.length === 1
          ? "Pagamento excluído com sucesso"
          : `${paymentIdsToDelete.length} pagamentos excluídos com sucesso`
      );
      await load();
      triggerGoogleSync(contractId);
    } catch (e: any) {
      toast.error(getSafeErrorMessage(e));
    }
  };

  const handleCancel = async () => {
    try {
      await updateContract(contractId, { status: "cancelled", cancelledAt: new Date().toISOString(), cancelledBy: "Administrador" });
      toast.success("Contrato cancelado"); await load();
    } catch (e: any) { toast.error(getSafeErrorMessage(e)); }
  };

  const handleUploadDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await addDocument({ contractId, name: file.name, type: docType, file });
      toast.success("Documento enviado com sucesso");
      setDocType("outro");
      await load();
    } catch (err: any) {
      toast.error(getSafeErrorMessage(err));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteDoc = async (doc: Document) => {
    try {
      await deleteDocument(doc.id, doc.fileName);
      toast.success("Documento removido");
      await load();
    } catch (err: any) { toast.error(getSafeErrorMessage(err)); }
  };

  const handleDownloadDoc = async (doc: Document) => {
    try {
      const url = await getDocumentSignedUrl(doc.fileName);
      window.open(url, "_blank");
    } catch (err: any) { toast.error(getSafeErrorMessage(err)); }
  };

  const docStatus = docs.length === 0 ? "Nenhum documento" : docs.length < 3 ? "Documentos pendentes" : "Documentos completos";
  const docStatusColor = docs.length === 0 ? "text-danger" : docs.length < 3 ? "text-warning" : "text-success";

  const TAB_LABELS = isMobile
    ? ["Evento", "Pagtos", "Docs", "Histórico", "Jurídico"]
    : ["Evento", "Pagamentos", "Documentos", "Histórico", "Log Jurídico"];

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent hideClose={isMobile} className={isMobile ? "max-w-[100vw] w-full h-[100dvh] max-h-[100dvh] rounded-none p-0 flex flex-col border-0" : "max-w-2xl max-h-[90vh] overflow-y-auto"}>
        {isMobile && (
          <div className="shrink-0 flex items-center justify-between border-b border-border px-4" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)", paddingBottom: "12px" }}>
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <h2 className="text-lg font-display font-semibold">Detalhes do Contrato</h2>
              <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium shrink-0 ${CONTRACT_STATUS_COLORS[contract.status]}`}>
                {CONTRACT_STATUS_LABELS[contract.status]}
              </span>
            </div>
            <button
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-muted shrink-0"
              aria-label="Fechar"
            >
              <X size={20} />
            </button>
          </div>
        )}
        <div className={isMobile ? "flex-1 overflow-y-auto px-4 pb-40" : ""}>
          {!isMobile && (
            <DialogHeader>
              <DialogTitle className="font-display text-lg flex items-center gap-2 flex-wrap">
                Detalhes do Contrato
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${CONTRACT_STATUS_COLORS[contract.status]}`}>
                  {CONTRACT_STATUS_LABELS[contract.status]}
                </span>
              </DialogTitle>
            </DialogHeader>
          )}

          {contract.status === "cancelled" && (
            <div className="flex items-center gap-2.5 rounded-md border border-danger/20 bg-danger/5 p-3 text-sm">
              <AlertTriangle size={15} className="text-danger shrink-0" />
              <div>
                <span className="font-medium text-danger">Evento cancelado</span>
                {contract.cancelledAt && (
                  <span className="ml-2 text-muted-foreground text-xs">
                    em {new Date(contract.cancelledAt).toLocaleString("pt-BR")}
                    {contract.cancelledBy && ` por ${contract.cancelledBy}`}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="rounded-md border border-border/60 bg-muted/10 px-4 py-2 overflow-x-auto mt-3">
            <ContractTimeline contract={contract} docs={docs} payments={payments} />
          </div>

          <Tabs defaultValue="details" className="mt-3">
            {/* Mobile: horizontal scroll tabs / Desktop: grid */}
            {isMobile ? (
              <div className="overflow-x-auto -mx-4 px-4 pb-1">
                <TabsList className="inline-flex w-auto min-w-max gap-1 bg-muted/50 p-1 rounded-lg">
                  <TabsTrigger value="details" className="text-xs px-3 py-1.5 rounded-md data-[state=active]:bg-[hsl(var(--primary))] data-[state=active]:text-primary-foreground whitespace-nowrap">
                    {TAB_LABELS[0]}
                  </TabsTrigger>
                  <TabsTrigger value="payments" className="text-xs px-3 py-1.5 rounded-md data-[state=active]:bg-[hsl(var(--primary))] data-[state=active]:text-primary-foreground whitespace-nowrap">
                    {TAB_LABELS[1]}
                  </TabsTrigger>
                  <TabsTrigger value="documents" className="text-xs px-3 py-1.5 rounded-md data-[state=active]:bg-[hsl(var(--primary))] data-[state=active]:text-primary-foreground whitespace-nowrap">
                    {TAB_LABELS[2]}
                  </TabsTrigger>
                  <TabsTrigger value="history" className="text-xs px-3 py-1.5 rounded-md data-[state=active]:bg-[hsl(var(--primary))] data-[state=active]:text-primary-foreground whitespace-nowrap">
                    {TAB_LABELS[3]}
                  </TabsTrigger>
                  <TabsTrigger value="audit" className="text-xs px-3 py-1.5 rounded-md data-[state=active]:bg-[hsl(var(--primary))] data-[state=active]:text-primary-foreground whitespace-nowrap">
                    {TAB_LABELS[4]}
                  </TabsTrigger>
                </TabsList>
              </div>
            ) : (
              <TabsList className="w-full grid grid-cols-5">
                <TabsTrigger value="details">Evento</TabsTrigger>
                <TabsTrigger value="payments">Pagamentos</TabsTrigger>
                <TabsTrigger value="documents">Documentos</TabsTrigger>
                <TabsTrigger value="history">Histórico</TabsTrigger>
                <TabsTrigger value="audit" className="gap-1">
                  <ShieldCheck size={12} /> Log Jurídico
                </TabsTrigger>
              </TabsList>
            )}

            <TabsContent value="details" className="space-y-5 pt-4">
              {/* Mobile: card blocks / Desktop: grid */}
              {isMobile ? (
                <>
                  {/* Card 1: Event info */}
                  <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Informações do Evento</p>
                    <InfoRow icon={Users} label="Cliente" value={client?.name || "—"} />
                    <InfoRow icon={CalendarDays} label="Data" value={formatDateBR(contract.eventDate)} />
                    <InfoRow icon={Clock} label="Horário" value={contract.eventTime || "—"} />
                    <InfoRow icon={FileText} label="Tipo" value={contract.eventType} />
                    <InfoRow icon={Users} label="Convidados" value={String(contract.guestCount)} />
                  </div>
                  {/* Card 2: Financial */}
                  <div className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Financeiro</p>
                    <InfoRow icon={DollarSign} label="Valor Total" value={fmt(contract.totalValue)} />
                    <InfoRow icon={DollarSign} label="Sinal" value={`${contract.depositPercent}% = ${fmt(contract.depositValue)}`} />
                    <InfoRow icon={DollarSign} label="Restante" value={fmt(contract.remainingValue)} />
                  </div>
                </>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoRow icon={Users} label="Cliente" value={client?.name || "—"} />
                  <InfoRow icon={CalendarDays} label="Data" value={formatDateBR(contract.eventDate)} />
                  <InfoRow icon={CalendarDays} label="Horário" value={contract.eventTime || "—"} />
                  <InfoRow icon={Users} label="Convidados" value={String(contract.guestCount)} />
                  <InfoRow icon={FileText} label="Tipo" value={contract.eventType} />
                  <InfoRow icon={DollarSign} label="Valor Total" value={fmt(contract.totalValue)} />
                  <InfoRow icon={DollarSign} label="Sinal" value={`${contract.depositPercent}% = ${fmt(contract.depositValue)}`} />
                  <InfoRow icon={DollarSign} label="Restante" value={fmt(contract.remainingValue)} />
                  {(contract.source || contract.utmSource) && (
                    <div className="flex items-center gap-2 py-2">
                      <Globe size={14} className="text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground w-20 shrink-0">Origem</span>
                      <AttributionBadge origin={contract.source} utmSource={contract.utmSource} utmCampaign={contract.utmCampaign} utmMedium={contract.utmMedium} metaAdId={contract.metaAdId} metaAdsetId={contract.metaAdsetId} compact />
                    </div>
                  )}
                </div>
              )}

              {/* Mobile: stacked buttons / Desktop: inline */}
              {contract.status !== "cancelled" && (
                <div className={isMobile ? "flex flex-col gap-3 mt-4" : "flex gap-2 mt-4"}>
                  <Button size="sm" onClick={() => setGenerateOpen(true)} className={`gap-1.5 text-xs ${isMobile ? "h-12 w-full text-sm font-semibold" : "h-8"}`}>
                    <FileOutput size={isMobile ? 18 : 13} /> Gerar Contrato
                  </Button>
                  <Button variant="destructive" size="sm" onClick={handleCancel} className={`text-xs ${isMobile ? "h-12 w-full text-sm font-semibold" : "h-8"}`}>
                    Cancelar Contrato
                  </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="payments" className="space-y-4 pt-4">
              {/* Payment choice info */}
              {contract.paymentChoice === "pagar_depois" && (
                <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 space-y-1">
                  <p className="text-xs font-semibold text-warning flex items-center gap-1.5">
                    <AlertTriangle size={13} /> Cliente escolheu pagar depois
                  </p>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <span className="text-muted-foreground">Método:</span>
                    <span className="font-medium">{contract.paymentMethodSelected === "pix" ? "PIX" : contract.paymentMethodSelected === "cartao" ? "Cartão" : contract.paymentMethodSelected || "—"}</span>
                    {contract.paymentDueDate && (
                      <>
                        <span className="text-muted-foreground">Data prometida:</span>
                        <span className="font-medium">{new Date(contract.paymentDueDate + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                      </>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Total pago: <span className="font-semibold text-foreground">{fmt(totalPaid)}</span> de {fmt(contract.totalValue)}
                  </p>
                  <span className={`text-[10px] font-medium rounded-full px-2 py-0.5 ${PAYMENT_STATUS_COLORS[contract.paymentStatus]}`}>
                    {PAYMENT_STATUS_LABELS[contract.paymentStatus]}
                  </span>
                </div>
                {selectedPaymentIds.size > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-1.5 h-8 text-xs"
                    onClick={() => requestDeletePayments([...selectedPaymentIds])}
                  >
                    <Trash2 size={13} />
                    Excluir ({selectedPaymentIds.size})
                  </Button>
                )}
              </div>

              <div className="divide-y divide-border/40 rounded-md border border-border/60">
                {payments.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-center text-muted-foreground">Nenhum pagamento</p>
                ) : (
                  <>
                    <div className="flex items-center gap-3 px-4 py-2 bg-muted/20">
                      <Checkbox
                        checked={allSelected ? true : someSelected ? "indeterminate" : false}
                        onCheckedChange={toggleAll}
                        aria-label="Selecionar todos"
                      />
                      <span className="text-xs text-muted-foreground">
                        {allSelected ? "Desmarcar todos" : "Selecionar todos"}
                      </span>
                    </div>
                    {payments.map((p) => (
                      <div
                        key={p.id}
                        className={`flex items-center gap-3 px-4 py-3 transition-colors ${selectedPaymentIds.has(p.id) ? "bg-primary/5" : ""}`}
                      >
                        <Checkbox
                          checked={selectedPaymentIds.has(p.id)}
                          onCheckedChange={() => togglePayment(p.id)}
                          aria-label={`Selecionar pagamento de ${fmt(p.amount)}`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.description || "Pagamento"}</p>
                          <p className="text-xs text-muted-foreground">{new Date(p.date).toLocaleDateString("pt-BR")}</p>
                        </div>
                        <span className="font-medium text-success tabular-nums text-sm mr-2">{fmt(p.amount)}</span>
                        {contract.status !== "cancelled" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={() => requestDeletePayments([p.id])}
                            aria-label="Excluir pagamento"
                          >
                            <Trash2 size={13} />
                          </Button>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>

              {contract.status !== "cancelled" && (
                <div className="rounded-md border border-border/60 bg-muted/20 p-4 space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Registrar Pagamento</p>
                  <div>
                    <Label className="text-xs text-muted-foreground">Tipo</Label>
                    <Select value={payForm.tag} onValueChange={handleTagChange}>
                      <SelectTrigger className={isMobile ? "h-12" : ""}>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Pagamento avulso</SelectItem>
                        <SelectItem value="sinal">Sinal ({fmt(contract.depositValue)})</SelectItem>
                        <SelectItem value="restante">Restante ({fmt(contract.remainingValue)})</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className={isMobile ? "space-y-3" : "grid grid-cols-3 gap-3"}>
                    <div>
                      <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
                      <CurrencyInput value={payForm.amount} onChange={(v) => setPayForm((p) => ({ ...p, amount: v }))} placeholder="R$ 0,00" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Data</Label>
                      <Input type="date" value={payForm.date} onChange={(e) => setPayForm((p) => ({ ...p, date: e.target.value }))} className={isMobile ? "h-12" : ""} />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Descrição</Label>
                      <Input value={payForm.description} onChange={(e) => setPayForm((p) => ({ ...p, description: e.target.value }))} className={isMobile ? "h-12" : ""} />
                    </div>
                  </div>
                  <div className={isMobile ? "flex flex-col gap-2" : "flex gap-2"}>
                    <Button size="sm" onClick={handleAddPayment} className={`gap-1 text-xs ${isMobile ? "h-12 w-full text-sm font-semibold" : "h-8"}`}>
                      <Plus size={13} /> Adicionar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setReceiptModalOpen(true)} className={`gap-1 text-xs ${isMobile ? "h-12 w-full text-sm font-semibold" : "h-8"}`}>
                      <Receipt size={13} /> Importar Comprovante
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="documents" className="space-y-4 pt-4">
              <p className={`text-sm font-medium ${docStatusColor}`}>{docStatus}</p>
              <div className="divide-y divide-border/40 rounded-md border border-border/60">
                {docs.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-center text-muted-foreground">Nenhum documento enviado</p>
                ) : (
                  docs.map((d) => (
                    <div key={d.id} className="flex items-center justify-between px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{d.name}</p>
                        <p className="text-xs text-muted-foreground">{d.type.toUpperCase()} • {new Date(d.createdAt).toLocaleDateString("pt-BR")}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownloadDoc(d)}>
                          <Download size={14} />
                        </Button>
                        {contract.status !== "cancelled" && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteDoc(d)}>
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {contract.status !== "cancelled" && (
                <div className="rounded-md border border-border/60 bg-muted/20 p-4 space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Enviar Documento</p>
                  <div className={isMobile ? "space-y-3" : "grid grid-cols-2 gap-3"}>
                    <div>
                      <Label className="text-xs text-muted-foreground">Tipo de documento</Label>
                      <Select value={docType} onValueChange={setDocType}>
                        <SelectTrigger className={isMobile ? "h-12" : ""}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="identidade">Identidade</SelectItem>
                          <SelectItem value="cnh">CNH</SelectItem>
                          <SelectItem value="comprovante_residencia">Comprovante de Residência</SelectItem>
                          <SelectItem value="contrato">Contrato</SelectItem>
                          <SelectItem value="recibo">Recibo</SelectItem>
                          <SelectItem value="outro">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className={isMobile ? "" : "flex items-end"}>
                      <input ref={fileInputRef} type="file" className="hidden" onChange={handleUploadDoc} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
                      <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} className={`gap-1 text-xs ${isMobile ? "h-12 w-full text-sm font-semibold" : "h-9 w-full"}`}>
                        <Upload size={13} /> {uploading ? "Enviando..." : "Escolher arquivo"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-4 pt-4">
              <div className="divide-y divide-border/40 rounded-md border border-border/60">
                <HistoryItem date={contract.createdAt} text={`Contrato criado • ${contract.eventType}`} />
                {payments.map((p) => (
                  <HistoryItem key={p.id} date={p.createdAt} text={`Pagamento de ${fmt(p.amount)} registrado`} />
                ))}
                {contract.cancelledAt && (
                  <HistoryItem date={contract.cancelledAt} text={`Contrato cancelado por ${contract.cancelledBy || "—"}`} danger />
                )}
              </div>
            </TabsContent>

            <TabsContent value="audit" className="space-y-4 pt-4">
              {auditLogs.length === 0 ? (
                <div className="text-center py-8">
                  <ShieldCheck size={32} className="mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhum log de assinatura registrado</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">O log será criado automaticamente quando o cliente assinar o contrato</p>
                </div>
              ) : (
                auditLogs.map((log) => (
                  <div key={log.id} className="rounded-md border border-border/60 bg-muted/10 p-4 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <ShieldCheck size={16} className="text-primary" />
                      <span className="text-sm font-semibold">Registro de Assinatura Digital</span>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <AuditRow icon={FileText} label="Cliente" value={log.client_name} />
                      {log.client_cpf && <AuditRow icon={FileText} label="CPF" value={log.client_cpf} />}
                      <AuditRow icon={FileText} label="Arquivo" value={log.signed_file_name} />
                      <AuditRow icon={FileText} label="Tipo" value="Rubrica manual" />
                    </div>

                    <hr className="border-border/40" />
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Dados da Assinatura</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <AuditRow icon={Clock} label="Data/Hora" value={new Date(log.signed_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} />
                      <AuditRow icon={ShieldCheck} label="Leitura confirmada" value={log.read_confirmed ? "Sim ✓" : "Não"} />
                    </div>

                    <hr className="border-border/40" />
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Dados Técnicos</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <AuditRow icon={Globe} label="IP" value={log.signer_ip || "—"} />
                      <AuditRow icon={log.device_type === "mobile" ? Smartphone : Monitor} label="Dispositivo" value={log.device_type || "—"} />
                      <AuditRow icon={Monitor} label="Sistema" value={log.operating_system || "—"} />
                      <AuditRow icon={Globe} label="Navegador" value={log.browser || "—"} />
                    </div>

                    <hr className="border-border/40" />
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Integridade</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <AuditRow icon={Hash} label="Hash SHA-256" value={log.pdf_hash ? log.pdf_hash.substring(0, 16) + "..." : "—"} />
                      <AuditRow icon={FileText} label="Versão" value={`v${log.contract_version}`} />
                    </div>
                    {log.pdf_hash && (
                      <p className="text-[9px] text-muted-foreground/60 break-all font-mono mt-1">Hash completo: {log.pdf_hash}</p>
                    )}
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Mobile FAB: Edit contract */}
        {isMobile && contract.status !== "cancelled" && onEdit && (
          <button
            onClick={() => { onClose(); setTimeout(() => onEdit(), 100); }}
            className="fixed z-[60] bottom-[calc(var(--safe-bottom)+24px)] right-4 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          >
            <Pencil size={22} />
          </button>
        )}
      </DialogContent>

      {client && (
        <GenerateContractModal
          contract={contract}
          client={client}
          open={generateOpen}
          onOpenChange={setGenerateOpen}
          onGenerated={load}
        />
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {paymentIdsToDelete.length === 1
                ? "Tem certeza que deseja excluir este pagamento? O valor restante e o status do contrato serão atualizados automaticamente."
                : `Tem certeza que deseja excluir ${paymentIdsToDelete.length} pagamentos? O valor restante e o status do contrato serão atualizados automaticamente.`}
              <br /><br />
              <span className="font-medium text-destructive">Esta ação não pode ser desfeita.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDeletePayments}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Receipt import modal */}
      <ImportReceiptModal
        open={receiptModalOpen}
        onOpenChange={setReceiptModalOpen}
        mode="contract"
        contractId={contractId}
        contractTotal={contract.totalValue}
        contractDeposit={contract.depositValue}
        totalPaid={totalPaid}
        onImported={() => load()}
      />
    </Dialog>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="rounded-md bg-muted/60 p-2">
        <Icon size={14} className="text-muted-foreground" />
      </div>
      <div>
        <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function HistoryItem({ date, text, danger }: { date: string; text: string; danger?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${danger ? "bg-danger" : "bg-primary"}`} />
      <div className="flex-1">
        <p className={`text-sm ${danger ? "text-danger" : ""}`}>{text}</p>
        <p className="text-xs text-muted-foreground">{new Date(date).toLocaleString("pt-BR")}</p>
      </div>
    </div>
  );
}

function AuditRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={12} className="text-muted-foreground shrink-0" />
      <span className="text-[11px] text-muted-foreground">{label}:</span>
      <span className="text-xs font-medium truncate">{value}</span>
    </div>
  );
}
