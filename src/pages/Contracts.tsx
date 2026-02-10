import { useEffect, useState } from "react";
import { Plus, Search, Eye, Pencil } from "lucide-react";
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

const EVENT_TYPES: EventType[] = [
  "Aniversário Infantil", "Casamento", "Debutante", "Formatura", "Confraternização", "Chá de Bebê", "Outro",
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

  const load = () => { setContracts(getContracts()); setClients(getClients()); };
  useEffect(load, []);

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
    if (clients.length === 0) { toast.error("Cadastre um cliente primeiro!"); return; }
    setEditing(null); setForm({ ...emptyForm, clientId: clients[0].id }); setOpen(true);
  };

  const openEdit = (c: Contract) => {
    setEditing(c);
    setForm({ clientId: c.clientId, eventType: c.eventType, eventDate: c.eventDate, eventTime: c.eventTime, guestCount: c.guestCount, totalValue: c.totalValue, depositPercent: c.depositPercent, status: c.status, paymentStatus: c.paymentStatus });
    setOpen(true);
  };

  const handleSave = () => {
    if (!form.clientId || !form.eventDate) { toast.error("Cliente e data são obrigatórios"); return; }
    if (editing) { updateContract(editing.id, form); toast.success("Contrato atualizado!"); }
    else { addContract(form); toast.success("Contrato criado!"); }
    setOpen(false); load();
  };

  const set = (field: string, value: any) => setForm((p) => ({ ...p, [field]: value }));
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-semibold tracking-tight">Contratos</h1>
          <p className="text-sm text-muted-foreground mt-1">{contracts.length} contratos</p>
        </div>
        <Button onClick={openNew} size="sm" className="gap-2 h-9">
          <Plus size={15} /> Novo Contrato
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar cliente..." className="pl-9 h-9 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
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
              <th className="hidden sm:table-cell">Evento</th>
              <th className="hidden md:table-cell">Data</th>
              <th className="hidden lg:table-cell">Valor</th>
              <th>Status</th>
              <th className="hidden md:table-cell">Pagamento</th>
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="!py-10 text-center text-muted-foreground">Nenhum contrato encontrado</td></tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium">{clientMap[c.clientId]?.name || "—"}</td>
                  <td className="hidden sm:table-cell text-muted-foreground">{c.eventType}</td>
                  <td className="hidden md:table-cell text-muted-foreground tabular-nums">{new Date(c.eventDate).toLocaleDateString("pt-BR")}</td>
                  <td className="hidden lg:table-cell font-medium tabular-nums">{fmt(c.totalValue)}</td>
                  <td>
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-medium ${CONTRACT_STATUS_COLORS[c.status]}`}>
                      {CONTRACT_STATUS_LABELS[c.status]}
                    </span>
                  </td>
                  <td className="hidden md:table-cell">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-medium ${PAYMENT_STATUS_COLORS[c.paymentStatus]}`}>
                      {PAYMENT_STATUS_LABELS[c.paymentStatus]}
                    </span>
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-0.5">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetailId(c.id)}>
                        <Eye size={14} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                        <Pencil size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">{editing ? "Editar Contrato" : "Novo Contrato"}</DialogTitle>
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
              <Label className="text-xs font-medium text-muted-foreground">Tipo de Evento</Label>
              <Select value={form.eventType} onValueChange={(v) => set("eventType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Data do Evento *</Label>
                <Input type="date" value={form.eventDate} onChange={(e) => set("eventDate", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Horário</Label>
                <Input type="time" value={form.eventTime} onChange={(e) => set("eventTime", e.target.value)} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Convidados</Label>
              <Input type="number" value={form.guestCount} onChange={(e) => set("guestCount", +e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Valor Total (R$)</Label>
                <Input type="number" value={form.totalValue} onChange={(e) => set("totalValue", +e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Sinal (%)</Label>
                <Input type="number" value={form.depositPercent} onChange={(e) => set("depositPercent", +e.target.value)} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(CONTRACT_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={handleSave} className="mt-2">{editing ? "Salvar Alterações" : "Criar Contrato"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {detailId && <ContractDetailModal contractId={detailId} onClose={() => { setDetailId(null); load(); }} />}
    </div>
  );
}
