import { useEffect, useState } from "react";
import { Plus, Search, Eye, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  getContracts,
  getClients,
  addContract,
  updateContract,
} from "@/data/store";
import {
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
} from "@/types";
import type { Contract, ContractStatus, EventType, Client } from "@/types";
import ContractDetailModal from "@/components/ContractDetailModal";

const EVENT_TYPES: EventType[] = [
  "Aniversário Infantil",
  "Casamento",
  "Debutante",
  "Formatura",
  "Confraternização",
  "Chá de Bebê",
  "Outro",
];

const emptyForm = {
  clientId: "",
  eventType: "Aniversário Infantil" as EventType,
  eventDate: "",
  eventTime: "",
  guestCount: 0,
  totalValue: 0,
  depositPercent: 30,
  status: "awaiting_documents" as ContractStatus,
  paymentStatus: "pending" as Contract["paymentStatus"],
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

  const load = () => {
    setContracts(getContracts());
    setClients(getClients());
  };
  useEffect(load, []);

  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c]));

  const filtered = contracts.filter((c) => {
    const client = clientMap[c.clientId];
    const matchSearch =
      !search ||
      (client?.name || "").toLowerCase().includes(search.toLowerCase()) ||
      (client?.cpf || "").includes(search) ||
      (client?.email || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const openNew = () => {
    if (clients.length === 0) {
      toast.error("Cadastre um cliente primeiro!");
      return;
    }
    setEditing(null);
    setForm({ ...emptyForm, clientId: clients[0].id });
    setOpen(true);
  };

  const openEdit = (c: Contract) => {
    setEditing(c);
    setForm({
      clientId: c.clientId,
      eventType: c.eventType,
      eventDate: c.eventDate,
      eventTime: c.eventTime,
      guestCount: c.guestCount,
      totalValue: c.totalValue,
      depositPercent: c.depositPercent,
      status: c.status,
      paymentStatus: c.paymentStatus,
    });
    setOpen(true);
  };

  const handleSave = () => {
    if (!form.clientId || !form.eventDate) {
      toast.error("Cliente e data são obrigatórios");
      return;
    }
    if (editing) {
      updateContract(editing.id, form);
      toast.success("Contrato atualizado!");
    } else {
      addContract(form);
      toast.success("Contrato criado!");
    }
    setOpen(false);
    load();
  };

  const set = (field: string, value: any) => setForm((p) => ({ ...p, [field]: value }));

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="animate-fade-in space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display">Contratos</h1>
          <p className="text-sm text-muted-foreground">{contracts.length} contratos</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus size={16} /> Novo Contrato
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
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

      {/* Table */}
      <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Cliente</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Evento</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Data</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Valor</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">Pagamento</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhum contrato encontrado
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{clientMap[c.clientId]?.name || "—"}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">{c.eventType}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {new Date(c.eventDate).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">{fmt(c.totalValue)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${CONTRACT_STATUS_COLORS[c.status]}`}>
                      {CONTRACT_STATUS_LABELS[c.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${PAYMENT_STATUS_COLORS[c.paymentStatus]}`}>
                      {PAYMENT_STATUS_LABELS[c.paymentStatus]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setDetailId(c.id)}>
                        <Eye size={15} />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                        <Pencil size={15} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? "Editar Contrato" : "Novo Contrato"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Cliente *</Label>
              <Select value={form.clientId} onValueChange={(v) => set("clientId", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Tipo de Evento</Label>
              <Select value={form.eventType} onValueChange={(v) => set("eventType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Data do Evento *</Label>
                <Input type="date" value={form.eventDate} onChange={(e) => set("eventDate", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Horário</Label>
                <Input type="time" value={form.eventTime} onChange={(e) => set("eventTime", e.target.value)} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Quantidade de Convidados</Label>
              <Input type="number" value={form.guestCount} onChange={(e) => set("guestCount", +e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Valor Total (R$)</Label>
                <Input type="number" value={form.totalValue} onChange={(e) => set("totalValue", +e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label>Sinal (%)</Label>
                <Input type="number" value={form.depositPercent} onChange={(e) => set("depositPercent", +e.target.value)} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Status do Contrato</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(CONTRACT_STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSave} className="mt-2">
              {editing ? "Salvar Alterações" : "Criar Contrato"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      {detailId && (
        <ContractDetailModal
          contractId={detailId}
          onClose={() => { setDetailId(null); load(); }}
        />
      )}
    </div>
  );
}
