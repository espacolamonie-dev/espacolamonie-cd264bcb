import { useEffect, useState, useCallback } from "react";
import { parseLocalDate, formatDateBR } from "@/lib/dateUtils";
import { useSearchParams } from "react-router-dom";
import { Plus, Search, Eye, Pencil, Upload, Trash2, CalendarDays, Link2, ExternalLink, FileText, CalendarCheck, Activity } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { getContracts, getClients, addContract, updateContract, deleteContract } from "@/data/store";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUS_COLORS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS } from "@/types";
import type { Contract, ContractStatus, EventType, Client, RentalType } from "@/types";
import ContractDetailModal from "@/components/ContractDetailModal";
import { ContractStatusSelect, PaymentStatusSelect } from "@/components/ContractStatusSelect";
import { CurrencyInput, PercentInput } from "@/components/CurrencyInput";
import { triggerGoogleSync } from "@/lib/googleSync";
import { NumericInput } from "@/components/NumericInput";
import ImportContractModal from "@/components/ImportContractModal";
import { supabase } from "@/integrations/supabase/client";

const EVENT_TYPES: EventType[] = [
  "Aniversário Adulto", "Aniversário Infantil", "Casamento", "Confraternização", "Evento Corporativo",
];

const RENTAL_TYPES: RentalType[] = ["Locação (1 dia)", "Locação (2 dias)"];

const emptyForm = {
  clientId: "", eventType: "Aniversário Infantil" as EventType, eventDate: "", eventDateEnd: "",
  rentalType: "Locação (1 dia)" as RentalType, eventTime: "",
  guestCount: 0, totalValue: 0, depositPercent: 30,
  status: "awaiting_documents" as ContractStatus, paymentStatus: "pending" as Contract["paymentStatus"],
};

export default function Contracts() {
  const isMobile = useIsMobile();
  const [searchParams, setSearchParams] = useSearchParams();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contract | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Contract | null>(null);

  const load = async () => {
    try {
      const [c, cl] = await Promise.all([getContracts(), getClients()]);
      setContracts(c); setClients(cl);
    } catch {}
  };
  useEffect(() => { load(); }, []);

  // Handle query params from dashboard alerts
  useEffect(() => {
    const paymentParam = searchParams.get("payment");
    if (paymentParam === "pending_urgent") {
      setPaymentFilter("pending_urgent");
      // Clear the query param to keep URL clean
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c]));

  const filtered = contracts.filter((c) => {
    const client = clientMap[c.clientId];
    const matchSearch = !search ||
      (client?.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (client?.cpf || "").includes(search);
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    let matchPayment = true;
    if (paymentFilter === "pending_urgent") {
      const sevenDays = new Date();
      sevenDays.setDate(sevenDays.getDate() + 7);
      const eventDate = parseLocalDate(c.eventDate);
      matchPayment = c.paymentStatus !== "paid_full" && c.status !== "cancelled" && eventDate >= new Date() && eventDate <= sevenDays;
    } else if (paymentFilter !== "all") {
      matchPayment = c.paymentStatus === paymentFilter;
    }
    return matchSearch && matchStatus && matchPayment;
  });

  const openNew = () => {
    if (clients.length === 0) { toast.error("Cadastre um cliente antes de criar um contrato"); return; }
    setEditing(null); setForm({ ...emptyForm, clientId: clients[0].id, rentalType: "Locação (1 dia)", eventDateEnd: "" }); setOpen(true);
    // Auto-fill from most recent visit of first client
    autoFillFromClient(clients[0].id);
  };

  const autoFillFromClient = async (clientId: string) => {
    try {
      const { data: visitRows } = await supabase
        .from("visits")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(1);
      if (visitRows && visitRows.length > 0) {
        const v = visitRows[0];
        const updates: Record<string, any> = {};
        if (v.event_type_desired) {
          const validTypes = ["Aniversário Adulto", "Aniversário Infantil", "Casamento", "Confraternização", "Evento Corporativo"];
          if (validTypes.includes(v.event_type_desired)) {
            updates.eventType = v.event_type_desired;
          }
        }
        if (v.interest_event_date) updates.eventDate = v.interest_event_date;
        if (v.guest_count > 0) updates.guestCount = v.guest_count;
        if (Number(v.event_value) > 0) updates.totalValue = Number(v.event_value);
        if (Object.keys(updates).length > 0) {
          setForm(prev => ({ ...prev, ...updates }));
          toast.info("Dados preenchidos automaticamente com base na visita", { duration: 3000 });
        }
      }
    } catch {}
  };

  const openEdit = (c: Contract) => {
    setEditing(c);
    setForm({ clientId: c.clientId, eventType: c.eventType, eventDate: c.eventDate, eventDateEnd: c.eventDateEnd || "", rentalType: c.rentalType || "Locação (1 dia)", eventTime: c.eventTime, guestCount: c.guestCount, totalValue: c.totalValue, depositPercent: c.depositPercent, status: c.status, paymentStatus: c.paymentStatus });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.clientId || !form.eventDate) { toast.error("Cliente e data são obrigatórios"); return; }
    if (form.rentalType === "Locação (2 dias)" && !form.eventDateEnd) { toast.error("Informe a data fim para locação de 2 dias"); return; }
    if (!editing || form.eventDate !== editing.eventDate) {
      const conflict = contracts.find(
        (c) => c.eventDate === form.eventDate && c.status !== "cancelled" && c.id !== editing?.id
      );
      if (conflict) {
        const conflictClient = clientMap[conflict.clientId]?.name || "outro evento";
        toast.error(`Data bloqueada! Já existe um evento em ${formatDateBR(form.eventDate)} (${conflictClient})`);
        return;
      }
    }
    try {
      if (editing) {
        const paymentStatusChanged = form.paymentStatus !== editing.paymentStatus;
        const updates: Record<string, any> = { ...form };
        if (paymentStatusChanged) {
          updates.paymentStatus = form.paymentStatus;
        }
        await updateContract(editing.id, updates);
        toast.success("Contrato salvo com sucesso");
        // Sync to Google Calendar on edit too
        triggerGoogleSync(editing.id);
      } else {
        const newContract = await addContract(form);
        toast.success("Contrato criado com sucesso");
        // Sync to Google Calendar immediately (even before signature)
        triggerGoogleSync(newContract.id);
      }
      setOpen(false); await load();
    } catch (e: any) { toast.error(e.message); }
  };

  const set = (field: string, value: any) => setForm((p) => ({ ...p, [field]: value }));
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const depositValue = (form.totalValue * form.depositPercent) / 100;

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const getLocalDateStr = (isoStr: string) => {
    const d = new Date(isoStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const contractsThisMonth = contracts.filter((c) => {
    const d = new Date(c.createdAt || c.eventDate);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  }).length;

  const contractsToday = contracts.filter((c) => {
    return getLocalDateStr(c.createdAt || "") === todayStr;
  }).length;

  const activeContracts = contracts.filter((c) => c.status !== "cancelled").length;

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {!isMobile && (
            <>
              <h1 className="text-3xl font-display font-semibold tracking-tight">Contratos</h1>
              <p className="text-sm text-muted-foreground mt-1">Gestão de contratos e eventos</p>
            </>
          )}
        </div>
        {!isMobile && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2 h-9 rounded-lg" onClick={() => setImportOpen(true)}>
              <Upload size={15} /> Importar PDF
            </Button>
            <Button onClick={openNew} size="sm" className="gap-2 h-9 rounded-lg">
              <Plus size={15} /> Novo contrato
            </Button>
          </div>
        )}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <CalendarCheck size={20} className="text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{contractsToday}</p>
            <p className="text-xs text-muted-foreground">Hoje</p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-accent/50 flex items-center justify-center shrink-0">
            <FileText size={20} className="text-foreground" />
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{contractsThisMonth}</p>
            <p className="text-xs text-muted-foreground">Este mês</p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
            <Activity size={20} className="text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums">{activeContracts}</p>
            <p className="text-xs text-muted-foreground">Ativos</p>
          </div>
        </div>
      </div>

      {/* Link de datas para eventos */}
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-3">
        <Link2 size={16} className="text-muted-foreground shrink-0" />
        <span className="text-sm text-muted-foreground truncate flex-1">{window.location.origin}/datas-eventos</span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            navigator.clipboard.writeText(`${window.location.origin}/datas-eventos`);
            toast.success("Link copiado!");
          }}
          className="gap-1.5 shrink-0"
        >
          <Link2 size={14} /> Copiar
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => window.open("/datas-eventos", "_blank")}
          className="gap-1.5 shrink-0"
        >
          <ExternalLink size={14} /> Abrir
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou CPF" className="pl-9 h-9 text-sm rounded-lg" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {!isMobile && (
          <>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] h-9 text-sm rounded-lg">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {Object.entries(CONTRACT_STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className={`w-[220px] h-9 text-sm rounded-lg ${paymentFilter !== "all" ? "border-danger/50 bg-danger/5" : ""}`}>
                <SelectValue placeholder="Todos os pagamentos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os pagamentos</SelectItem>
                <SelectItem value="pending_urgent">⚠ Pendentes (próx. 7 dias)</SelectItem>
                {Object.entries(PAYMENT_STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      {isMobile ? (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center text-muted-foreground py-12 text-sm">Nenhum contrato encontrado</div>
          ) : (
            filtered.map((c) => {
              const isCancelled = c.status === "cancelled";
              const statusLabel = CONTRACT_STATUS_LABELS[c.status] || c.status;
              const statusColor = CONTRACT_STATUS_COLORS[c.status] || "";
              return (
                <div key={c.id} className={`rounded-xl border border-border bg-card p-4 ${isCancelled ? "opacity-50" : ""}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-base">{clientMap[c.clientId]?.name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{c.eventType}</p>
                    </div>
                    <Badge className={`text-[10px] font-medium border rounded-full px-2.5 py-0.5 shrink-0 ${statusColor}`}>
                      {statusLabel}
                    </Badge>
                  </div>
                   <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                    <span className="flex items-center gap-1">
                      <CalendarDays size={13} />
                      {formatDateBR(c.eventDate)}
                      {c.eventDateEnd && ` – ${formatDateBR(c.eventDateEnd)}`}
                    </span>
                    <span className="font-semibold text-foreground">{fmt(c.totalValue)}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 h-11 gap-1.5" onClick={() => setDetailId(c.id)}>
                      <Eye size={16} /> Detalhes
                    </Button>
                    {!isCancelled && (
                      <Button size="sm" variant="outline" className="flex-1 h-11 gap-1.5" onClick={() => openEdit(c)}>
                        <Pencil size={16} /> Editar
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-11 px-3 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => setDeleteTarget(c)}>
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="table-premium">
            <thead>
              <tr>
                <th>Cliente</th>
                <th className="hidden sm:table-cell">Data</th>
                <th className="hidden lg:table-cell text-right">Valor</th>
                <th>Contrato</th>
                <th className="hidden md:table-cell">Pagamento</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="!py-12 text-center text-muted-foreground">Nenhum contrato encontrado</td></tr>
              ) : (
                filtered.map((c) => {
                  const isCancelled = c.status === "cancelled";
                  return (
                  <tr key={c.id} className={isCancelled ? "opacity-50" : ""}>
                    <td>
                      <div>
                        <p className="font-semibold text-sm">{clientMap[c.clientId]?.name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{c.eventType}</p>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell text-muted-foreground tabular-nums text-sm">{formatDateBR(c.eventDate)}{c.eventDateEnd && ` – ${formatDateBR(c.eventDateEnd)}`}</td>
                    <td className="hidden lg:table-cell text-right font-semibold tabular-nums text-sm">
                      {isCancelled ? <span className="text-muted-foreground line-through">{fmt(c.totalValue)}</span> : fmt(c.totalValue)}
                    </td>
                    <td>
                      <ContractStatusSelect contractId={c.id} value={c.status} onChanged={load} />
                    </td>
                    <td className="hidden md:table-cell">
                      <PaymentStatusSelect contractId={c.id} value={c.paymentStatus} isCancelled={isCancelled} onChanged={load} />
                    </td>
                    <td className="text-right">
                       <div className="flex items-center justify-end gap-1">
                         <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => setDetailId(c.id)}>
                           <Eye size={14} />
                         </Button>
                         {!isCancelled && (
                           <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => openEdit(c)}>
                             <Pencil size={14} />
                           </Button>
                         )}
                         <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive hover:text-destructive" onClick={() => setDeleteTarget(c)}>
                           <Trash2 size={14} />
                         </Button>
                       </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile FAB */}
      {isMobile && (
        <button
          onClick={openNew}
          className="fixed z-40 bottom-[calc(var(--safe-bottom)+var(--mobile-bottom-h)+16px)] right-4 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        >
          <Plus size={28} strokeWidth={2.5} />
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent hideClose={isMobile} className={isMobile ? "max-w-[100vw] w-full h-[100dvh] max-h-[100dvh] rounded-none border-0 flex flex-col p-0" : "max-w-lg max-h-[90vh] overflow-y-auto"}>
          {isMobile && (
            <div className="shrink-0 flex items-center justify-between border-b border-border px-4" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)", paddingBottom: "12px" }}>
              <div>
                <h2 className="text-lg font-display font-semibold">{editing ? "Editar contrato" : "Novo contrato"}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{editing ? "Atualize as informações" : "Preencha os dados"}</p>
              </div>
              <button onClick={() => setOpen(false)} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-muted" aria-label="Fechar">
                <Plus size={20} className="rotate-45" />
              </button>
            </div>
          )}
          {!isMobile && (
            <DialogHeader>
              <DialogTitle className="font-display text-xl">{editing ? "Editar contrato" : "Novo contrato"}</DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">{editing ? "Atualize as informações do contrato" : "Preencha os dados para criar um novo contrato"}</p>
            </DialogHeader>
          )}
          <div className={isMobile ? "flex-1 overflow-y-auto px-4 py-5" : ""}>
            <div className="grid gap-5">
            {/* Step 1: Client & Event */}
            <div className="space-y-4">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Cliente e evento</p>
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Cliente *</Label>
                <Select value={form.clientId} onValueChange={(v) => { set("clientId", v); if (!editing) autoFillFromClient(v); }}>
                  <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Tipo de evento</Label>
                <Select value={form.eventType} onValueChange={(v) => set("eventType", v)}>
                  <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>{EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Tipo de locação</Label>
                <Select value={form.rentalType} onValueChange={(v) => {
                  set("rentalType", v);
                  if (v === "Locação (1 dia)") set("eventDateEnd", "");
                }}>
                  <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>{RENTAL_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">{form.rentalType === "Locação (2 dias)" ? "Data início *" : "Data do evento *"}</Label>
                <Input type="date" value={form.eventDate} onChange={(e) => set("eventDate", e.target.value)} className="rounded-lg" />
              </div>
              {form.rentalType === "Locação (2 dias)" && (
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Data fim *</Label>
                  <Input type="date" value={form.eventDateEnd} onChange={(e) => set("eventDateEnd", e.target.value)} className="rounded-lg" min={form.eventDate || undefined} />
                </div>
              )}
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Convidados</Label>
                <NumericInput value={form.guestCount} onChange={(v) => set("guestCount", v)} placeholder="Nº de convidados" />
              </div>
            </div>

            {/* Step 2: Values */}
            <div className="space-y-4 rounded-xl border border-border bg-secondary/30 p-4">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Valores</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Valor total</Label>
                  <CurrencyInput value={form.totalValue} onChange={(v) => set("totalValue", v)} placeholder="R$ 0,00" />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Sinal</Label>
                  <PercentInput value={form.depositPercent} onChange={(v) => set("depositPercent", v)} placeholder="30%" />
                </div>
              </div>
              {form.totalValue > 0 && (
                <div className="text-xs text-muted-foreground bg-card rounded-lg p-3 space-y-1 border border-border">
                  <p>Sinal: <span className="font-semibold text-foreground">{fmt(depositValue)}</span></p>
                  <p>Restante: <span className="font-semibold text-foreground">{fmt(form.totalValue - depositValue)}</span></p>
                </div>
              )}
            </div>

            {/* Step 3: Status */}
            <div className="space-y-4">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">Status</p>
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Status do contrato</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(CONTRACT_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {editing && form.status !== "cancelled" && (
                <div className="grid gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Status de pagamento</Label>
                  <Select value={form.paymentStatus} onValueChange={(v) => set("paymentStatus", v)}>
                    <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(PAYMENT_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                  {form.paymentStatus === "deposit_paid" && (
                    <p className="text-[11px] text-muted-foreground">O sinal ({form.depositPercent}%) será registrado automaticamente como entrada financeira.</p>
                  )}
                  {form.paymentStatus === "paid_full" && (
                    <p className="text-[11px] text-muted-foreground">O valor restante será registrado automaticamente como entrada financeira.</p>
                  )}
                </div>
              )}
            </div>
            </div>
          </div>
          {isMobile ? (
            <div className="shrink-0 flex flex-col gap-2 px-4 pt-3 border-t border-border bg-background" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}>
              <Button onClick={handleSave} className="h-12 w-full font-semibold rounded-lg">{editing ? "Salvar contrato" : "Criar contrato"}</Button>
              <Button variant="outline" className="h-12 w-full rounded-lg" onClick={() => setOpen(false)}>Cancelar</Button>
            </div>
          ) : (
            <Button onClick={handleSave} className="mt-1 rounded-lg h-10">{editing ? "Salvar contrato" : "Criar contrato"}</Button>
          )}
        </DialogContent>
      </Dialog>

      {detailId && <ContractDetailModal contractId={detailId} onClose={() => { setDetailId(null); load(); }} onEdit={() => { const c = contracts.find(x => x.id === detailId); if (c) openEdit(c); }} />}

      <ImportContractModal open={importOpen} onOpenChange={setImportOpen} onImported={load} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Excluir contrato definitivamente</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Esta ação é <strong>irreversível</strong>. Serão removidos permanentemente:</p>
              <ul className="list-disc pl-5 text-sm space-y-1">
                <li>O contrato e todos os dados associados</li>
                <li>Pagamentos vinculados</li>
                <li>Documentos anexados</li>
                <li>Registros de assinatura e auditoria</li>
              </ul>
              <p className="text-destructive font-medium">Tem certeza que deseja excluir este contrato?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  await deleteContract(deleteTarget.id);
                  toast.success("Contrato excluído definitivamente");
                  setDeleteTarget(null);
                  await load();
                } catch (e: any) {
                  toast.error(e.message);
                }
              }}
            >
              Excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
