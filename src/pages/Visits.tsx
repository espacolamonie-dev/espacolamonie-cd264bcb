import { useEffect, useState, useMemo, useCallback } from "react";
import { Plus, Search, Phone, CalendarDays, Clock, Filter, Eye, Check, RotateCcw, X as XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getVisits, addVisit, updateVisit, deleteVisit, type Visit } from "@/data/visitStore";
import { syncVisitToGoogle, deleteVisitGoogleEvent } from "@/lib/visitGoogleSync";

type VisitStatus = "Agendada" | "Confirmada" | "Remarcada" | "Cancelada";

const VISIT_STATUS_COLORS: Record<VisitStatus, string> = {
  Agendada: "bg-primary/15 text-primary border-primary/30",
  Confirmada: "bg-success/15 text-success border-success/30",
  Remarcada: "bg-warning/15 text-warning border-warning/30",
  Cancelada: "bg-danger/15 text-danger border-danger/30",
};

function phoneMask(v: string): string {
  const digits = v.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export default function Visits() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [detailVisit, setDetailVisit] = useState<Visit | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formInterestDate, setFormInterestDate] = useState("");
  const [formVisitDate, setFormVisitDate] = useState("");
  const [formVisitTime, setFormVisitTime] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const loadVisits = useCallback(async () => {
    setLoading(true);
    try {
      setVisits(await getVisits());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadVisits(); }, [loadVisits]);

  const filtered = useMemo(() => {
    let list = visits;
    if (filterStatus !== "all") list = list.filter((v) => v.status === filterStatus);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (v) => v.clientName.toLowerCase().includes(q) || v.clientPhone.includes(q)
      );
    }
    return list;
  }, [visits, filterStatus, search]);

  const resetForm = () => {
    setFormName(""); setFormPhone(""); setFormInterestDate("");
    setFormVisitDate(""); setFormVisitTime(""); setFormNotes("");
  };

  const handleCreate = async () => {
    if (!formName.trim() || !formPhone.trim() || !formVisitDate || !formVisitTime) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    setSaving(true);
    try {
      const visit = await addVisit({
        clientName: formName.trim(),
        clientPhone: formPhone.trim(),
        interestEventDate: formInterestDate || null,
        visitDate: formVisitDate,
        visitTime: formVisitTime,
        notes: formNotes.trim(),
      });
      toast.success("Visita agendada com sucesso!");
      syncVisitToGoogle(visit.id);
      setModalOpen(false);
      resetForm();
      loadVisits();
    } catch (e: any) {
      toast.error(e.message || "Erro ao agendar visita");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (visit: Visit, newStatus: VisitStatus) => {
    try {
      if (newStatus === "Cancelada") {
        await updateVisit(visit.id, { status: newStatus });
        deleteVisitGoogleEvent(visit.id);
      } else {
        await updateVisit(visit.id, { status: newStatus });
        syncVisitToGoogle(visit.id);
      }
      toast.success(`Status alterado para "${newStatus}"`);
      setDetailVisit(null);
      loadVisits();
    } catch (e: any) {
      toast.error(e.message || "Erro ao alterar status");
    }
  };

  if (loading) {
    return (
      <div className="animate-fade-in space-y-6">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-10 w-full max-w-sm" />
        <Skeleton className="h-[300px] w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-semibold tracking-tight">Agendar Visita</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie visitas presenciais ao Espaço Lamoniê</p>
        </div>
        <Button onClick={() => { resetForm(); setModalOpen(true); }} className="gap-2">
          <Plus size={16} /> Nova visita
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={13} className="text-muted-foreground" />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-9 text-xs w-40 rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="Agendada">Agendada</SelectItem>
              <SelectItem value="Confirmada">Confirmada</SelectItem>
              <SelectItem value="Remarcada">Remarcada</SelectItem>
              <SelectItem value="Cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="table-premium">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Telefone</th>
              <th>Data Evento (interesse)</th>
              <th>Data da Visita</th>
              <th>Horário</th>
              <th>Status</th>
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-muted-foreground py-12">
                  Nenhuma visita encontrada
                </td>
              </tr>
            ) : (
              filtered.map((v) => (
                <tr key={v.id}>
                  <td className="font-medium text-sm">{v.clientName}</td>
                  <td className="text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Phone size={12} /> {v.clientPhone}
                    </span>
                  </td>
                  <td className="text-sm text-muted-foreground">
                    {v.interestEventDate
                      ? format(new Date(v.interestEventDate + "T12:00:00"), "dd/MM/yyyy")
                      : "—"}
                  </td>
                  <td className="text-sm">
                    <span className="flex items-center gap-1.5">
                      <CalendarDays size={12} className="text-muted-foreground" />
                      {format(new Date(v.visitDate + "T12:00:00"), "dd/MM/yyyy")}
                    </span>
                  </td>
                  <td className="text-sm">
                    <span className="flex items-center gap-1.5">
                      <Clock size={12} className="text-muted-foreground" />
                      {v.visitTime.slice(0, 5)}
                    </span>
                  </td>
                  <td>
                    <Badge className={`text-[10px] font-medium border rounded-full px-2.5 py-0.5 ${VISIT_STATUS_COLORS[v.status as VisitStatus] || ""}`}>
                      {v.status}
                    </Badge>
                  </td>
                  <td className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => setDetailVisit(v)}
                    >
                      <Eye size={12} /> Detalhes
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Nova Visita</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do cliente *</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Nome completo" />
            </div>
            <div>
              <Label>Telefone *</Label>
              <Input
                value={formPhone}
                onChange={(e) => setFormPhone(phoneMask(e.target.value))}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div>
              <Label>Data de interesse do evento (opcional)</Label>
              <Input type="date" value={formInterestDate} onChange={(e) => setFormInterestDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data da visita *</Label>
                <Input type="date" value={formVisitDate} onChange={(e) => setFormVisitDate(e.target.value)} />
              </div>
              <div>
                <Label>Horário *</Label>
                <Input type="time" value={formVisitTime} onChange={(e) => setFormVisitTime(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Anotações sobre a visita..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Agendando..." : "Agendar visita"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog open={!!detailVisit} onOpenChange={(open) => !open && setDetailVisit(null)}>
        <DialogContent className="max-w-md">
          {detailVisit && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">Detalhes da Visita</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cliente</span>
                  <span className="font-medium">{detailVisit.clientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Telefone</span>
                  <span>{detailVisit.clientPhone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Data de interesse</span>
                  <span>
                    {detailVisit.interestEventDate
                      ? format(new Date(detailVisit.interestEventDate + "T12:00:00"), "dd/MM/yyyy")
                      : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Data da visita</span>
                  <span className="font-medium">
                    {format(new Date(detailVisit.visitDate + "T12:00:00"), "dd/MM/yyyy")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Horário</span>
                  <span>{detailVisit.visitTime.slice(0, 5)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <Badge className={`text-[10px] font-medium border rounded-full px-2.5 py-0.5 ${VISIT_STATUS_COLORS[detailVisit.status as VisitStatus] || ""}`}>
                    {detailVisit.status}
                  </Badge>
                </div>
                {detailVisit.notes && (
                  <div>
                    <span className="text-muted-foreground block mb-1">Observações</span>
                    <p className="text-sm bg-muted/50 rounded-lg p-3">{detailVisit.notes}</p>
                  </div>
                )}
              </div>
              {detailVisit.status !== "Cancelada" && (
                <DialogFooter className="flex-wrap gap-2">
                  {detailVisit.status !== "Confirmada" && (
                    <Button size="sm" className="gap-1.5 bg-success hover:bg-success/90 text-success-foreground" onClick={() => handleStatusChange(detailVisit, "Confirmada")}>
                      <Check size={14} /> Confirmar
                    </Button>
                  )}
                  {detailVisit.status !== "Remarcada" && (
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => handleStatusChange(detailVisit, "Remarcada")}>
                      <RotateCcw size={14} /> Remarcar
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => handleStatusChange(detailVisit, "Cancelada")}>
                    <XIcon size={14} /> Cancelar
                  </Button>
                </DialogFooter>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
