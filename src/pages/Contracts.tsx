import { useEffect, useState } from "react";
import { Plus, Search, Eye, Pencil, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { getContracts, getClients, addContract, updateContract } from "@/data/store";
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUS_COLORS, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_COLORS } from "@/types";
import type { Contract, ContractStatus, EventType, Client } from "@/types";
import ContractDetailModal from "@/components/ContractDetailModal";
import { ContractStatusSelect, PaymentStatusSelect } from "@/components/ContractStatusSelect";
import { NumericInput } from "@/components/NumericInput";
import ImportContractModal from "@/components/ImportContractModal";

const EVENT_TYPES: EventType[] = [
  "Aniversário Adulto", "Aniversário Infantil", "Casamento", "Confraternização", "Evento Corporativo",
];

const emptyForm = {
  clientId: "", eventType: "Aniversário Infantil" as EventType, eventDate: "", eventTime: "",
  guestCount: 0, totalValue: 0, depositPercent: 30,
  status: "awaiting_documents" as ContractStatus, paymentStatus: "pending" as Contract["paymentStatus"],
};

export default function Contracts() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contract | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const load = async () => {
    try {
      const [c, cl] = await Promise.all([getContracts(), getClients()]);
      setContracts(c); setClients(cl);
    } catch {}
  };
  useEffect(() => { load(); }, []);

  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c]));

  const filtered = contracts.filter((c) => {
    const client = clientMap[c.clientId];
    const matchSearch = !search ||
      (client?.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (client?.cpf || "").includes(search) ||
      (client?.email || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const openNew = () => {
    if (clients.length === 0) { toast.error("Cadastre um cliente antes de criar um contrato"); return; }
    setEditing(null); setForm({ ...emptyForm, clientId: clients[0].id }); setOpen(true);
  };

  const openEdit = (c: Contract) => {
    setEditing(c);
    setForm({ clientId: c.clientId, eventType: c.eventType, eventDate: c.eventDate, eventTime: c.eventTime, guestCount: c.guestCount, totalValue: c.totalValue, depositPercent: c.depositPercent, status: c.status, paymentStatus: c.paymentStatus });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.clientId || !form.eventDate) { toast.error("Cliente e data são obrigatórios"); return; }
    // Date blocking: check if date is already taken by active contract
    if (!editing || form.eventDate !== editing.eventDate) {
      const conflict = contracts.find(
        (c) => c.eventDate === form.eventDate && c.status !== "cancelled" && c.id !== editing?.id
      );
      if (conflict) {
        const conflictClient = clientMap[conflict.clientId]?.name || "outro evento";
        toast.error(`Data bloqueada! Já existe um evento em ${new Date(form.eventDate).toLocaleDateString("pt-BR")} (${conflictClient})`);
        return;
      }
    }
    try {
      if (editing) {
        // Check if payment status changed — handle auto-payment
        const paymentStatusChanged = form.paymentStatus !== editing.paymentStatus;
        const updates: Record<string, any> = { ...form };
        if (paymentStatusChanged) {
          updates.paymentStatus = form.paymentStatus;
        }
        await updateContract(editing.id, updates);
        toast.success("Informações salvas com sucesso");
      } else {
        await addContract(form);
        toast.success("Contrato criado com sucesso");
      }
      setOpen(false); await load();
    } catch (e: any) { toast.error(e.message); }
  };

  const set = (field: string, value: any) => setForm((p) => ({ ...p, [field]: value }));
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-semibold tracking-tight">Contratos</h1>
          <p className="text-sm text-muted-foreground mt-1">Gestão de contratos e eventos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2 h-9" onClick={() => setImportOpen(true)}>
            <Upload size={15} /> Importar PDF
          </Button>
          <Button onClick={openNew} size="sm" className="gap-2 h-9">
            <Plus size={15} /> Novo contrato
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nome, e-mail ou CPF" className="pl-9 h-9 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] h-9 text-sm">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(CONTRACT_STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border/60 bg-card overflow-x-auto">
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
              <tr><td colSpan={6} className="!py-10 text-center text-muted-foreground">Nenhum registro encontrado</td></tr>
            ) : (
              filtered.map((c) => {
                const isCancelled = c.status === "cancelled";
                return (
                <tr key={c.id} className={isCancelled ? "opacity-60" : ""}>
                  <td>
                    <div>
                      <p className="font-semibold text-sm">{clientMap[c.clientId]?.name || "—"}</p>
                      <p className="text-xs text-muted-foreground">{c.eventType}</p>
                    </div>
                  </td>
                  <td className="hidden sm:table-cell text-muted-foreground tabular-nums text-sm">{new Date(c.eventDate).toLocaleDateString("pt-BR")}</td>
                  <td className="hidden lg:table-cell text-right font-semibold tabular-nums text-sm">
                    {isCancelled ? <span className="text-muted-foreground line-through">{fmt(c.totalValue)}</span> : fmt(c.totalValue)}
                  </td>
                  <td>
                    <ContractStatusSelect
                      contractId={c.id}
                      value={c.status}
                      onChanged={load}
                    />
                  </td>
                  <td className="hidden md:table-cell">
                    <PaymentStatusSelect
                      contractId={c.id}
                      value={c.paymentStatus}
                      isCancelled={isCancelled}
                      onChanged={load}
                    />
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetailId(c.id)}>
                        <Eye size={14} />
                      </Button>
                      {!isCancelled && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                          <Pencil size={14} />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">{editing ? "Editar contrato" : "Novo contrato"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Cliente *</Label>
              <Select value={form.clientId} onValueChange={(v) => set("clientId", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Tipo de evento</Label>
              <Select value={form.eventType} onValueChange={(v) => set("eventType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Data do evento *</Label>
                <Input type="date" value={form.eventDate} onChange={(e) => set("eventDate", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Horário</Label>
                <Input type="time" value={form.eventTime} onChange={(e) => set("eventTime", e.target.value)} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Convidados</Label>
              <NumericInput value={form.guestCount} onChange={(v) => set("guestCount", v)} placeholder="Nº de convidados" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Valor total (R$)</Label>
                <NumericInput value={form.totalValue} onChange={(v) => set("totalValue", v)} placeholder="Digite o valor" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Sinal (%)</Label>
                <NumericInput value={form.depositPercent} onChange={(v) => set("depositPercent", v)} placeholder="30" selectOnFocus />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Status do contrato</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(CONTRACT_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {editing && form.status !== "cancelled" && (
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Status de pagamento</Label>
                <Select value={form.paymentStatus} onValueChange={(v) => set("paymentStatus", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
            <Button onClick={handleSave} className="mt-2">{editing ? "Salvar alterações" : "Criar contrato"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {detailId && <ContractDetailModal contractId={detailId} onClose={() => { setDetailId(null); load(); }} />}

      <ImportContractModal open={importOpen} onOpenChange={setImportOpen} onImported={load} />
    </div>
  );
}
