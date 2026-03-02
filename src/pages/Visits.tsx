import { useEffect, useState, useMemo, useCallback } from "react";
import { Plus, Search, Phone, CalendarDays, Clock, Filter, Eye, Check, RotateCcw, X as XIcon, AlertTriangle } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
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
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";

type VisitStatus = "Agendada" | "Confirmada" | "Remarcada" | "Cancelada";

const VISIT_STATUS_COLORS: Record<VisitStatus, string> = {
  Agendada: "bg-primary/15 text-primary border-primary/30",
  Confirmada: "bg-success/15 text-success border-success/30",
  Remarcada: "bg-warning/15 text-warning border-warning/30",
  Cancelada: "bg-danger/15 text-danger border-danger/30",
};

const VISIT_STATUS_BG: Record<VisitStatus, string> = {
  Agendada: "border-l-primary",
  Confirmada: "border-l-success",
  Remarcada: "border-l-warning",
  Cancelada: "border-l-danger",
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
  const isMobile = useIsMobile();

  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formInterestDate, setFormInterestDate] = useState("");
  const [formVisitDate, setFormVisitDate] = useState("");
  const [formVisitTime, setFormVisitTime] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [dateConflicts, setDateConflicts] = useState<{ name: string; phone: string; stage: string; type: string }[]>([]);
  const loadVisits = useCallback(async () => {
    setLoading(true);
    try {
      setVisits(await getVisits());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadVisits(); }, [loadVisits]);

  // Check for date interest conflicts
  useEffect(() => {
    if (!formInterestDate) {
      setDateConflicts([]);
      return;
    }
    const checkConflicts = async () => {
      const conflicts: { name: string; phone: string; stage: string; type: string }[] = [];
      // Check other visits with same interest date
      const { data: otherVisits } = await supabase
        .from("visits")
        .select("client_name, client_phone, status, interest_event_date")
        .eq("interest_event_date", formInterestDate)
        .neq("status", "Cancelada");
      if (otherVisits) {
        for (const v of otherVisits) {
          conflicts.push({ name: v.client_name, phone: v.client_phone, stage: v.status, type: "Visita" });
        }
      }
      // Check leads with same interest date
      const { data: leads } = await supabase
        .from("leads")
        .select("name, phone, stage, interest_date")
        .eq("interest_date", formInterestDate);
      if (leads) {
        for (const l of leads) {
          if (l.stage !== "perdido") {
            conflicts.push({ name: l.name, phone: l.phone, stage: l.stage, type: "Lead" });
          }
        }
      }
      // Check contracts with same event date (not cancelled)
      const { data: contracts } = await supabase
        .from("contracts")
        .select("id, client_id, event_date, status")
        .eq("event_date", formInterestDate)
        .neq("status", "cancelled");
      if (contracts && contracts.length > 0) {
        const clientIds = contracts.map(c => c.client_id);
        const { data: clients } = await supabase
          .from("clients")
          .select("id, name, phone")
          .in("id", clientIds);
        const clientMap = Object.fromEntries((clients || []).map(c => [c.id, c]));
        for (const c of contracts) {
          const cl = clientMap[c.client_id];
          conflicts.push({ name: cl?.name || "—", phone: cl?.phone || "", stage: c.status, type: "Contrato" });
        }
      }
      setDateConflicts(conflicts);
    };
    checkConflicts();
  }, [formInterestDate]);

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
    setDateConflicts([]);
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
          <h1 className="text-3xl font-display font-semibold tracking-tight">
            {isMobile ? "Visitas" : "Agendar Visita"}
          </h1>
          {!isMobile && (
            <p className="text-sm text-muted-foreground mt-1">Gerencie visitas presenciais ao Espaço Lamoniê</p>
          )}
        </div>
        {!isMobile && (
          <Button onClick={() => { resetForm(); setModalOpen(true); }} className="gap-2">
            <Plus size={16} /> Nova visita
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
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
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="Agendada">Agendada</SelectItem>
              <SelectItem value="Confirmada">Confirmada</SelectItem>
              <SelectItem value="Remarcada">Remarcada</SelectItem>
              <SelectItem value="Cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Mobile: Cards / Desktop: Table */}
      {isMobile ? (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center text-muted-foreground py-12 text-sm">
              Nenhuma visita encontrada
            </div>
          ) : (
            filtered.map((v) => (
              <div
                key={v.id}
                className={`rounded-xl border border-border bg-card p-4 border-l-4 ${VISIT_STATUS_BG[v.status as VisitStatus] || ""}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-base">{v.clientName}</p>
                    <a
                      href={`tel:${v.clientPhone.replace(/\D/g, "")}`}
                      className="text-sm text-primary flex items-center gap-1 mt-0.5"
                    >
                      <Phone size={12} /> {v.clientPhone}
                    </a>
                  </div>
                  <Badge className={`text-[10px] font-medium border rounded-full px-2.5 py-0.5 shrink-0 ${VISIT_STATUS_COLORS[v.status as VisitStatus] || ""}`}>
                    {v.status}
                  </Badge>
                </div>

                <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                  <span className="flex items-center gap-1">
                    <CalendarDays size={13} />
                    {format(new Date(v.visitDate + "T12:00:00"), "dd/MM/yyyy")}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={13} />
                    {v.visitTime.slice(0, 5)}
                  </span>
                </div>

                {v.notes && (
                  <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-2 mb-3 line-clamp-2">{v.notes}</p>
                )}

                {/* Action buttons */}
                {v.status !== "Cancelada" ? (
                  <div className="flex gap-2">
                    {v.status !== "Confirmada" && (
                      <Button
                        size="sm"
                        className="flex-1 gap-1.5 h-11 bg-success hover:bg-success/90 text-success-foreground font-semibold"
                        onClick={() => handleStatusChange(v, "Confirmada")}
                      >
                        <Check size={16} /> Confirmar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1.5 h-11"
                      onClick={() => setDetailVisit(v)}
                    >
                      <Eye size={16} /> Detalhes
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-11 px-3"
                      onClick={() => handleStatusChange(v, "Cancelada")}
                    >
                      <XIcon size={16} />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1.5 h-11"
                      onClick={() => setDetailVisit(v)}
                    >
                      <Eye size={16} /> Detalhes
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        /* Desktop Table */
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
      )}

      {/* Mobile FAB */}
      {isMobile && (
        <button
          onClick={() => { resetForm(); setModalOpen(true); }}
          className="fixed z-40 bottom-[calc(var(--safe-bottom)+var(--mobile-bottom-h)+16px)] right-4 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        >
          <Plus size={28} strokeWidth={2.5} />
        </button>
      )}

      {/* Create Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className={isMobile ? "max-w-[100vw] w-full h-full max-h-full rounded-none" : "max-w-md"}>
          <DialogHeader>
            <DialogTitle className="font-display">Nova Visita</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 flex-1 overflow-y-auto">
            <div>
              <Label>Nome do cliente *</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Nome completo" className="h-12" />
            </div>
            <div>
              <Label>Telefone *</Label>
              <Input
                type="tel"
                value={formPhone}
                onChange={(e) => setFormPhone(phoneMask(e.target.value))}
                placeholder="(00) 00000-0000"
                className="h-12"
              />
            </div>
            <div>
              <Label>Data de interesse do evento (opcional)</Label>
              <Input type="date" value={formInterestDate} onChange={(e) => setFormInterestDate(e.target.value)} className="h-12" />
            </div>
            {dateConflicts.length > 0 && (
              <Alert variant="default" className="border-warning/50 bg-warning/10">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertTitle className="text-warning font-semibold text-sm">
                  Atenção: já existe interesse nesta data
                </AlertTitle>
                <AlertDescription className="text-xs space-y-1 mt-1">
                  {dateConflicts.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-muted-foreground">({c.phone})</span>
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0">{c.type} — {c.stage}</Badge>
                    </div>
                  ))}
                  <p className="text-muted-foreground mt-1">Você ainda pode salvar normalmente.</p>
                </AlertDescription>
              </Alert>
            )}
            <div>
              <Label>Data da visita *</Label>
              <Input type="date" value={formVisitDate} onChange={(e) => setFormVisitDate(e.target.value)} className="h-12" />
            </div>
            <div>
              <Label>Horário *</Label>
              <Input type="time" value={formVisitTime} onChange={(e) => setFormVisitTime(e.target.value)} className="h-12" />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Anotações..." rows={3} />
            </div>
          </div>
          <DialogFooter className={isMobile ? "sticky bottom-0 bg-background pt-3 border-t border-border" : ""}>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving} className="h-12 font-semibold">
              {saving ? "Agendando..." : "Salvar visita"}
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
                  <a href={`tel:${detailVisit.clientPhone.replace(/\D/g, "")}`} className="text-primary">
                    {detailVisit.clientPhone}
                  </a>
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
                    <Button size="sm" className="gap-1.5 h-11 bg-success hover:bg-success/90 text-success-foreground" onClick={() => handleStatusChange(detailVisit, "Confirmada")}>
                      <Check size={14} /> Confirmar
                    </Button>
                  )}
                  {detailVisit.status !== "Remarcada" && (
                    <Button size="sm" variant="outline" className="gap-1.5 h-11" onClick={() => handleStatusChange(detailVisit, "Remarcada")}>
                      <RotateCcw size={14} /> Remarcar
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" className="gap-1.5 h-11" onClick={() => handleStatusChange(detailVisit, "Cancelada")}>
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
