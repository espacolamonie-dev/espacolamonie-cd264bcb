import { useEffect, useState, useMemo, useCallback } from "react";
import { Plus, Search, Phone, CalendarDays, Clock, Filter, Eye, Check, RotateCcw, X as XIcon, AlertTriangle, Pencil, Users, Megaphone, TrendingUp, Link2, ExternalLink, MessageCircle, DollarSign, Copy } from "lucide-react";
import { AttributionBadge } from "@/components/AttributionBadge";
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
import { getVisits, addVisit, updateVisit, deleteVisit, type Visit, type LeadSource, LEAD_SOURCE_OPTIONS } from "@/data/visitStore";
import { syncVisitToGoogle, deleteVisitGoogleEvent } from "@/lib/visitGoogleSync";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { CurrencyInput } from "@/components/CurrencyInput";
import { NumericInput } from "@/components/NumericInput";

const EVENT_TYPES_OPTIONS = [
  "Aniversário 15 anos", "Aniversário Adulto", "Aniversário Infantil", "Casamento",
  "Chá de bebê", "Chá de fraldas", "Chá de panela", "Chá de revelação",
  "Confraternização", "Recepção de casamento",
];

const NOTIFICATION_PHONE = "5531998595155";

type VisitStatus = "Agendada" | "Confirmada" | "Remarcada" | "Cancelada" | "Convertida em contrato";

const VISIT_STATUS_COLORS: Record<VisitStatus, string> = {
  Agendada: "bg-primary/15 text-primary border-primary/30",
  Confirmada: "bg-success/15 text-success border-success/30",
  Remarcada: "bg-warning/15 text-warning border-warning/30",
  Cancelada: "bg-danger/15 text-danger border-danger/30",
  "Convertida em contrato": "bg-violet-500/15 text-violet-600 border-violet-500/30",
};

const VISIT_STATUS_BG: Record<VisitStatus, string> = {
  Agendada: "border-l-primary",
  Confirmada: "border-l-success",
  Remarcada: "border-l-warning",
  Cancelada: "border-l-danger",
  "Convertida em contrato": "border-l-violet-500",
};

function phoneMask(v: string): string {
  const digits = v.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatCurrency(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function Visits() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [detailVisit, setDetailVisit] = useState<Visit | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    clientName: "", clientPhone: "", visitDate: "", visitTime: "",
    interestEventDate: "", notes: "", status: "" as string, leadSource: "Orgânico" as string,
    eventTypeDesired: "", eventValue: 0, depositPercent: 0, guestCount: 0,
  });
  const isMobile = useIsMobile();

  // Confirmation WhatsApp modal
  const [confirmMsgVisit, setConfirmMsgVisit] = useState<Visit | null>(null);

  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formInterestDate, setFormInterestDate] = useState("");
  const [formVisitDate, setFormVisitDate] = useState("");
  const [formVisitTime, setFormVisitTime] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formLeadSource, setFormLeadSource] = useState<LeadSource>("Orgânico");
  const [formEventType, setFormEventType] = useState("");
  const [formEventValue, setFormEventValue] = useState(0);
  const [formDepositPercent, setFormDepositPercent] = useState(0);
  const [formGuestCount, setFormGuestCount] = useState(0);
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

  const stats = useMemo(() => {
    const now = new Date();
    const spFormatter = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
    const today = spFormatter.format(now);
    const spDayMonth = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(now);
    const toLocalDate = (isoStr: string) => spFormatter.format(new Date(isoStr));
    const activeVisits = visits.filter(v => v.status !== "Cancelada");
    const visitsToday = activeVisits.filter(v => v.visitDate === today).length;
    const scheduledToday = activeVisits.filter(v => toLocalDate(v.createdAt) === today).length;
    const organicCount = activeVisits.filter(v => !v.leadSource || v.leadSource === "Orgânico").length;
    const paidCount = activeVisits.filter(v => ["Tráfego Pago", "Facebook", "Instagram", "Google"].includes(v.leadSource)).length;
    const indicacaoCount = activeVisits.filter(v => v.leadSource === "Indicação").length;
    const convertedCount = visits.filter(v => v.status === "Convertida em contrato").length;
    const totalLeads = activeVisits.length;
    return { visitsToday, scheduledToday, organicCount, paidCount, indicacaoCount, convertedCount, totalLeads, spDayMonth };
  }, [visits]);

  const filtered = useMemo(() => {
    const spFormatter = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
    const today = spFormatter.format(new Date());
    let list = visits;
    const toLocalDate = (isoStr: string) => spFormatter.format(new Date(isoStr));
    if (filterStatus === "today") {
      list = list.filter((v) => v.visitDate === today && v.status !== "Cancelada");
    } else if (filterStatus === "scheduled_today") {
      list = list.filter((v) => toLocalDate(v.createdAt) === today && v.status !== "Cancelada");
    } else if (filterStatus === "organic") {
      list = list.filter((v) => v.leadSource === "Orgânico" && v.status !== "Cancelada");
    } else if (filterStatus === "paid_traffic") {
      list = list.filter((v) => v.leadSource === "Tráfego Pago" && v.status !== "Cancelada");
    } else if (filterStatus === "converted") {
      list = list.filter((v) => v.status === "Convertida em contrato");
    } else if (filterStatus === "all") {
      list = list.filter((v) => v.status !== "Cancelada");
    } else {
      list = list.filter((v) => v.status === filterStatus);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (v) => v.clientName.toLowerCase().includes(q) || v.clientPhone.includes(q)
      );
    }
    list = [...list].sort((a, b) => {
      const dateCompare = a.visitDate.localeCompare(b.visitDate);
      if (dateCompare !== 0) return dateCompare;
      return (a.visitTime || "23:59").localeCompare(b.visitTime || "23:59");
    });
    return list;
  }, [visits, filterStatus, search]);

  const resetForm = () => {
    setFormName(""); setFormPhone(""); setFormInterestDate("");
    setFormVisitDate(""); setFormVisitTime(""); setFormNotes("");
    setFormLeadSource("Orgânico"); setFormEventType(""); setFormEventValue(0);
    setFormDepositPercent(0); setFormGuestCount(0);
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
        leadSource: formLeadSource,
        eventTypeDesired: formEventType,
        eventValue: formEventValue,
        depositPercent: formDepositPercent,
        guestCount: formGuestCount,
      });
      toast.success("Visita agendada e cliente criado automaticamente!");
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

  const buildWhatsAppMessage = (v: Visit) => {
    const visitDateFmt = format(new Date(v.visitDate + "T12:00:00"), "dd/MM/yyyy");
    const timeFmt = v.visitTime.slice(0, 5);
    let msg = `*Visita Confirmada!* ✅\n\n`;
    msg += `*Cliente:* ${v.clientName}\n`;
    msg += `*Data da visita:* ${visitDateFmt}\n`;
    msg += `*Horário:* ${timeFmt}\n`;
    if (v.eventTypeDesired) msg += `*Evento de interesse:* ${v.eventTypeDesired}\n`;
    if (v.interestEventDate) msg += `*Data de interesse:* ${format(new Date(v.interestEventDate + "T12:00:00"), "dd/MM/yyyy")}\n`;
    if (v.guestCount > 0) msg += `*Quantidade de pessoas:* ${v.guestCount}\n`;
    if (v.eventValue > 0) msg += `*Valor informado:* ${formatCurrency(v.eventValue)}\n`;
    if (v.depositPercent > 0) msg += `*Sinal para reserva:* ${v.depositPercent}%${v.eventValue > 0 ? ` (${formatCurrency(v.eventValue * v.depositPercent / 100)})` : ''}\n`;
    msg += `\nInformações da visita que será realizada em breve!`;
    return msg;
  };

  const handleStatusChange = async (visit: Visit, newStatus: VisitStatus) => {
    try {
      if (newStatus === "Cancelada") {
        setVisits((prev) => prev.filter((v) => v.id !== visit.id));
        setDetailVisit(null);
        await updateVisit(visit.id, { status: newStatus });
        if (visit.googleEventId) {
          try {
            await deleteVisitGoogleEvent(visit.id);
            toast.success("Visita cancelada e removida da lista.");
          } catch {
            toast.warning("Visita cancelada, mas não foi possível excluir do Google Agenda.");
          }
        } else {
          toast.success("Visita cancelada e removida da lista.");
        }
        loadVisits();
      } else if (newStatus === "Confirmada") {
        await updateVisit(visit.id, { status: newStatus });
        syncVisitToGoogle(visit.id);
        toast.success(`Status alterado para "Confirmada"`);
        setDetailVisit(null);
        // Show WhatsApp message modal
        const updatedVisit = { ...visit, status: "Confirmada" };
        setConfirmMsgVisit(updatedVisit);
        loadVisits();
      } else {
        await updateVisit(visit.id, { status: newStatus });
        syncVisitToGoogle(visit.id);
        toast.success(`Status alterado para "${newStatus}"`);
        setDetailVisit(null);
        loadVisits();
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao alterar status");
      loadVisits();
    }
  };

  const renderFormFields = (mobile: boolean) => {
    const inputH = mobile ? "h-12" : "h-12";
    return (
      <>
        <div>
          <Label>Nome do cliente *</Label>
          <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Nome completo" className={inputH} autoFocus={mobile} />
        </div>
        <div>
          <Label>Telefone *</Label>
          <Input type="tel" value={formPhone} onChange={(e) => setFormPhone(phoneMask(e.target.value))} placeholder="(00) 00000-0000" className={inputH} />
        </div>
        <div>
          <Label>Data de interesse do evento (opcional)</Label>
          <Input type="date" value={formInterestDate} onChange={(e) => setFormInterestDate(e.target.value)} className={inputH} />
        </div>
        {dateConflicts.length > 0 && (
          <Alert variant="default" className="border-warning/50 bg-warning/10">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <AlertTitle className="text-warning font-semibold text-sm">Atenção: já existe interesse nesta data</AlertTitle>
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
          <Label>Evento que deseja</Label>
          <Select value={formEventType} onValueChange={setFormEventType}>
            <SelectTrigger className={inputH}><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
            <SelectContent>
              {EVENT_TYPES_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Valor do evento</Label>
            <CurrencyInput value={formEventValue} onChange={setFormEventValue} placeholder="R$ 0,00" />
          </div>
          <div>
            <Label>% Sinal</Label>
            <NumericInput value={formDepositPercent} onChange={setFormDepositPercent} placeholder="0" />
          </div>
          <div>
            <Label>Qtd. pessoas</Label>
            <NumericInput value={formGuestCount} onChange={setFormGuestCount} placeholder="0" />
          </div>
        </div>
        <div>
          <Label>Data da visita *</Label>
          <Input type="date" value={formVisitDate} onChange={(e) => setFormVisitDate(e.target.value)} className={inputH} />
        </div>
        <div>
          <Label>Horário *</Label>
          <Input type="time" value={formVisitTime} onChange={(e) => setFormVisitTime(e.target.value)} className={inputH} />
        </div>
        <div>
          <Label>Origem do Lead *</Label>
          <Select value={formLeadSource} onValueChange={(v) => setFormLeadSource(v as LeadSource)}>
            <SelectTrigger className={inputH}><SelectValue /></SelectTrigger>
            <SelectContent>
              {LEAD_SOURCE_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Observações</Label>
          <Textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Anotações..." rows={3} />
        </div>
      </>
    );
  };

  const renderEditFormFields = (mobile: boolean) => {
    const inputH = mobile ? "h-12" : "h-12";
    return (
      <>
        <div><Label>Nome do cliente *</Label><Input className={inputH} value={editForm.clientName} onChange={(e) => setEditForm(p => ({ ...p, clientName: e.target.value }))} /></div>
        <div><Label>Telefone *</Label><Input className={inputH} type="tel" value={editForm.clientPhone} onChange={(e) => setEditForm(p => ({ ...p, clientPhone: phoneMask(e.target.value) }))} /></div>
        <div><Label>Data da visita *</Label><Input className={inputH} type="date" value={editForm.visitDate} onChange={(e) => setEditForm(p => ({ ...p, visitDate: e.target.value }))} /></div>
        <div><Label>Horário *</Label><Input className={inputH} type="time" value={editForm.visitTime} onChange={(e) => setEditForm(p => ({ ...p, visitTime: e.target.value }))} /></div>
        <div><Label>Data de interesse (opcional)</Label><Input className={inputH} type="date" value={editForm.interestEventDate} onChange={(e) => setEditForm(p => ({ ...p, interestEventDate: e.target.value }))} /></div>
        <div>
          <Label>Evento que deseja</Label>
          <Select value={editForm.eventTypeDesired} onValueChange={(v) => setEditForm(p => ({ ...p, eventTypeDesired: v }))}>
            <SelectTrigger className={inputH}><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {EVENT_TYPES_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Valor do evento</Label>
            <CurrencyInput value={editForm.eventValue} onChange={(v) => setEditForm(p => ({ ...p, eventValue: v }))} placeholder="R$ 0,00" />
          </div>
          <div>
            <Label>% Sinal</Label>
            <NumericInput value={editForm.depositPercent} onChange={(v) => setEditForm(p => ({ ...p, depositPercent: v }))} placeholder="0" />
          </div>
          <div>
            <Label>Qtd. pessoas</Label>
            <NumericInput value={editForm.guestCount} onChange={(v) => setEditForm(p => ({ ...p, guestCount: v }))} placeholder="0" />
          </div>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={editForm.status} onValueChange={(v) => setEditForm(p => ({ ...p, status: v }))}>
            <SelectTrigger className={inputH}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Agendada">Agendada</SelectItem>
              <SelectItem value="Confirmada">Confirmada</SelectItem>
              <SelectItem value="Remarcada">Remarcada</SelectItem>
              <SelectItem value="Convertida em contrato">Convertida em contrato</SelectItem>
              <SelectItem value="Cancelada">Cancelada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Origem do Lead</Label>
          <Select value={editForm.leadSource} onValueChange={(v) => setEditForm(p => ({ ...p, leadSource: v as LeadSource }))}>
            <SelectTrigger className={inputH}><SelectValue /></SelectTrigger>
            <SelectContent>
              {LEAD_SOURCE_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Observações</Label><Textarea value={editForm.notes} onChange={(e) => setEditForm(p => ({ ...p, notes: e.target.value }))} rows={3} /></div>
      </>
    );
  };

  const handleEditSave = async () => {
    if (!detailVisit) return;
    if (!editForm.clientName.trim() || !editForm.visitDate || !editForm.visitTime) {
      toast.error("Preencha os campos obrigatórios"); return;
    }
    setEditSaving(true);
    try {
      const updates: Record<string, any> = {
        clientName: editForm.clientName.trim(),
        clientPhone: editForm.clientPhone.trim(),
        visitDate: editForm.visitDate,
        visitTime: editForm.visitTime,
        interestEventDate: editForm.interestEventDate || null,
        notes: editForm.notes.trim(),
        status: editForm.status,
        leadSource: editForm.leadSource,
        eventTypeDesired: editForm.eventTypeDesired,
        eventValue: editForm.eventValue,
        depositPercent: editForm.depositPercent,
        guestCount: editForm.guestCount,
      };
      await updateVisit(detailVisit.id, updates);
      try {
        await syncVisitToGoogle(detailVisit.id);
        toast.success("Visita atualizada e sincronizada!");
      } catch {
        toast.warning("Salvo no CRM, mas falhou sincronizar com Google Agenda.");
      }
      if (editForm.status === "Cancelada" && detailVisit.googleEventId) {
        try { await deleteVisitGoogleEvent(detailVisit.id); } catch {}
      }
      // If status changed to Confirmada, show WhatsApp message
      if (editForm.status === "Confirmada" && detailVisit.status !== "Confirmada") {
        const updatedVisit = { ...detailVisit, ...updates, status: "Confirmada" };
        setConfirmMsgVisit(updatedVisit as Visit);
      }
      setEditing(false);
      setDetailVisit(null);
      loadVisits();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setEditSaving(false);
    }
  };

  const openEditForm = (visit: Visit) => {
    setEditForm({
      clientName: visit.clientName,
      clientPhone: visit.clientPhone,
      visitDate: visit.visitDate,
      visitTime: visit.visitTime.slice(0, 5),
      interestEventDate: visit.interestEventDate || "",
      notes: visit.notes || "",
      status: visit.status,
      leadSource: visit.leadSource || "Orgânico",
      eventTypeDesired: visit.eventTypeDesired || "",
      eventValue: visit.eventValue || 0,
      depositPercent: visit.depositPercent || 0,
      guestCount: visit.guestCount || 0,
    });
    setEditing(true);
  };

  const renderDetailView = (visit: Visit) => (
    <div className="space-y-3 text-sm">
      <div className="flex justify-between"><span className="text-muted-foreground">Cliente</span><span className="font-medium">{visit.clientName}</span></div>
      <div className="flex justify-between"><span className="text-muted-foreground">Telefone</span><a href={`tel:${visit.clientPhone.replace(/\D/g, "")}`} className="text-primary">{visit.clientPhone}</a></div>
      <div className="flex justify-between"><span className="text-muted-foreground">Data de interesse</span><span>{visit.interestEventDate ? format(new Date(visit.interestEventDate + "T12:00:00"), "dd/MM/yyyy") : "—"}</span></div>
      {visit.eventTypeDesired && (
        <div className="flex justify-between"><span className="text-muted-foreground">Evento desejado</span><span className="font-medium">{visit.eventTypeDesired}</span></div>
      )}
      {visit.eventValue > 0 && (
        <div className="flex justify-between"><span className="text-muted-foreground">Valor do evento</span><span className="font-semibold">{formatCurrency(visit.eventValue)}</span></div>
      )}
      {visit.depositPercent > 0 && (
        <div className="flex justify-between"><span className="text-muted-foreground">Sinal para reserva</span><span className="font-semibold">{visit.depositPercent}%{visit.eventValue > 0 ? ` (${formatCurrency(visit.eventValue * visit.depositPercent / 100)})` : ''}</span></div>
      )}
      {visit.guestCount > 0 && (
        <div className="flex justify-between"><span className="text-muted-foreground">Qtd. de pessoas</span><span>{visit.guestCount}</span></div>
      )}
      <div className="flex justify-between"><span className="text-muted-foreground">Data da visita</span><span className="font-medium">{format(new Date(visit.visitDate + "T12:00:00"), "dd/MM/yyyy")}</span></div>
      <div className="flex justify-between"><span className="text-muted-foreground">Horário</span><span>{visit.visitTime.slice(0, 5)}</span></div>
      <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge className={`text-[10px] font-medium border rounded-full px-2.5 py-0.5 ${VISIT_STATUS_COLORS[visit.status as VisitStatus] || ""}`}>{visit.status}</Badge></div>
      <div className="flex justify-between items-center"><span className="text-muted-foreground">Origem</span><AttributionBadge origin={visit.leadSource} utmSource={visit.utmSource} utmCampaign={visit.utmCampaign} utmMedium={visit.utmMedium} metaAdId={visit.metaAdId} metaAdsetId={visit.metaAdsetId} compact /></div>
      <div className="flex justify-between"><span className="text-muted-foreground">Data de cadastro</span><span className="text-sm">{format(new Date(visit.createdAt), "dd/MM/yyyy 'às' HH:mm")}</span></div>
      {visit.notes && (
        <div><span className="text-muted-foreground block mb-1">Observações</span><p className="text-sm bg-muted/50 rounded-lg p-3">{visit.notes}</p></div>
      )}
    </div>
  );

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
          {!isMobile && (
            <>
              <h1 className="text-3xl font-display font-semibold tracking-tight">Agendar Visita</h1>
              <p className="text-sm text-muted-foreground mt-1">Gerencie visitas presenciais ao Espaço Lamoniê</p>
            </>
          )}
        </div>
        {!isMobile && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                const url = `${window.location.origin}/agendar-visita`;
                navigator.clipboard.writeText(url);
                toast.success("Link copiado!");
              }}
              className="gap-2"
            >
              <Link2 size={16} /> Copiar link
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open("/agendar-visita", "_blank")}
              className="gap-2"
            >
              <ExternalLink size={16} /> Abrir página
            </Button>
            <Button onClick={() => { resetForm(); setModalOpen(true); }} className="gap-2">
              <Plus size={16} /> Nova visita
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div
          className={`rounded-xl border bg-card p-4 cursor-pointer hover:border-primary/50 transition-colors ${filterStatus === "today" ? "border-primary/50 ring-1 ring-primary/20" : "border-border"}`}
          onClick={() => setFilterStatus(filterStatus === "today" ? "all" : "today")}
        >
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <CalendarDays size={14} />
            <span className="text-xs font-medium">Visitas Hoje</span>
            {filterStatus === "today" && <Badge variant="outline" className="text-[9px] px-1.5 py-0 ml-auto">Filtrado</Badge>}
          </div>
          <p className="text-2xl font-bold">{stats.visitsToday}</p>
        </div>
        <div
          className={`rounded-xl border bg-card p-4 cursor-pointer hover:border-primary/50 transition-colors ${filterStatus === "scheduled_today" ? "border-primary/50 ring-1 ring-primary/20" : "border-border"}`}
          onClick={() => setFilterStatus(filterStatus === "scheduled_today" ? "all" : "scheduled_today")}
        >
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Plus size={14} />
            <span className="text-xs font-medium">Agendadas Hoje - {stats.spDayMonth}</span>
            {filterStatus === "scheduled_today" && <Badge variant="outline" className="text-[9px] px-1.5 py-0 ml-auto">Filtrado</Badge>}
          </div>
          <p className="text-2xl font-bold">{stats.scheduledToday}</p>
        </div>
        <div
          className={`rounded-xl border bg-card p-4 cursor-pointer hover:border-primary/50 transition-colors ${filterStatus === "organic" ? "border-primary/50 ring-1 ring-primary/20" : "border-border"}`}
          onClick={() => setFilterStatus(filterStatus === "organic" ? "all" : "organic")}
        >
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users size={14} />
            <span className="text-xs font-medium">Orgânico</span>
            {filterStatus === "organic" && <Badge variant="outline" className="text-[9px] px-1.5 py-0 ml-auto">Filtrado</Badge>}
          </div>
          <p className="text-2xl font-bold">{stats.organicCount}<span className="text-sm font-normal text-muted-foreground ml-1">/ {stats.totalLeads}</span></p>
        </div>
        <div
          className={`rounded-xl border bg-card p-4 cursor-pointer hover:border-primary/50 transition-colors ${filterStatus === "paid_traffic" ? "border-primary/50 ring-1 ring-primary/20" : "border-border"}`}
          onClick={() => setFilterStatus(filterStatus === "paid_traffic" ? "all" : "paid_traffic")}
        >
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Megaphone size={14} />
            <span className="text-xs font-medium">Tráfego Pago</span>
            {filterStatus === "paid_traffic" && <Badge variant="outline" className="text-[9px] px-1.5 py-0 ml-auto">Filtrado</Badge>}
          </div>
          <p className="text-2xl font-bold">{stats.paidCount}<span className="text-sm font-normal text-muted-foreground ml-1">/ {stats.totalLeads}</span></p>
        </div>
        <div
          className={`rounded-xl border bg-card p-4 cursor-pointer hover:border-violet-500/50 transition-colors ${filterStatus === "converted" ? "border-violet-500/50 ring-1 ring-violet-500/20" : "border-border"}`}
          onClick={() => setFilterStatus(filterStatus === "converted" ? "all" : "converted")}
        >
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Check size={14} />
            <span className="text-xs font-medium">Convertidas</span>
            {filterStatus === "converted" && <Badge variant="outline" className="text-[9px] px-1.5 py-0 ml-auto">Filtrado</Badge>}
          </div>
          <p className="text-2xl font-bold text-violet-600">{stats.convertedCount}<span className="text-sm font-normal text-muted-foreground ml-1">/ {stats.totalLeads}</span></p>
        </div>
      </div>

      {/* Link de agendamento */}
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-3">
        <Link2 size={16} className="text-muted-foreground shrink-0" />
        <span className="text-sm text-muted-foreground truncate flex-1">{window.location.origin}/agendar-visita</span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            navigator.clipboard.writeText(`${window.location.origin}/agendar-visita`);
            toast.success("Link copiado!");
          }}
          className="gap-1.5 shrink-0"
        >
          <Link2 size={14} /> Copiar
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => window.open("/agendar-visita", "_blank")}
          className="gap-1.5 shrink-0"
        >
          <ExternalLink size={14} /> Abrir
        </Button>
      </div>

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
        <div className="space-y-3 stagger-fade-in">
          {filtered.length === 0 ? (
            <div className="text-center text-muted-foreground py-16 text-sm">
              <CalendarDays size={40} className="mx-auto mb-3 text-muted-foreground/30" />
              <p>Nenhuma visita encontrada</p>
            </div>
          ) : (
            filtered.map((v) => (
              <div
                key={v.id}
                className={`rounded-2xl border bg-card p-4 border-l-4 shadow-sm transition-all duration-200 ${VISIT_STATUS_BG[v.status as VisitStatus] || ""}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-semibold text-base truncate">{v.clientName}</p>
                    <a
                      href={`tel:${v.clientPhone.replace(/\D/g, "")}`}
                      className="text-sm text-primary flex items-center gap-1.5 mt-0.5"
                    >
                      <Phone size={13} /> {v.clientPhone}
                    </a>
                  </div>
                  <Badge className={`text-[10px] font-semibold border rounded-full px-3 py-1 shrink-0 ${VISIT_STATUS_COLORS[v.status as VisitStatus] || ""}`}>
                    {v.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2">
                    <CalendarDays size={14} className="text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium">{format(new Date(v.visitDate + "T12:00:00"), "dd/MM/yyyy")}</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2">
                    <Clock size={14} className="text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium">{v.visitTime.slice(0, 5)}</span>
                  </div>
                </div>

                {(v.eventTypeDesired || v.guestCount > 0 || v.eventValue > 0) && (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {v.eventTypeDesired && (
                      <span className="text-[11px] bg-accent text-accent-foreground rounded-lg px-2 py-1 font-medium">{v.eventTypeDesired}</span>
                    )}
                    {v.guestCount > 0 && (
                      <span className="text-[11px] bg-muted text-muted-foreground rounded-lg px-2 py-1 flex items-center gap-1">
                        <Users size={11} /> {v.guestCount} pessoas
                      </span>
                    )}
                    {v.eventValue > 0 && (
                      <span className="text-[11px] bg-success/10 text-success rounded-lg px-2 py-1 font-semibold flex items-center gap-1">
                        <DollarSign size={11} /> {formatCurrency(v.eventValue)}
                      </span>
                    )}
                  </div>
                )}

                {v.notes && (
                  <p className="text-xs text-muted-foreground bg-muted/40 rounded-xl p-2.5 mb-3 line-clamp-2">{v.notes}</p>
                )}

                {v.status !== "Cancelada" ? (
                  <div className="flex gap-2">
                    {v.status !== "Confirmada" && (
                      <Button
                        size="sm"
                        className="flex-1 gap-1.5 h-12 bg-success hover:bg-success/90 text-success-foreground font-semibold rounded-xl"
                        onClick={() => handleStatusChange(v, "Confirmada")}
                      >
                        <Check size={16} /> Confirmar
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1.5 h-12 rounded-xl"
                      onClick={() => setDetailVisit(v)}
                    >
                      <Eye size={16} /> Detalhes
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-12 px-3.5 rounded-xl"
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
                      className="flex-1 gap-1.5 h-12 rounded-xl"
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
                <th>Evento</th>
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
                  <td colSpan={8} className="text-center text-muted-foreground py-12">
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
                    <td className="text-sm text-muted-foreground">{v.eventTypeDesired || "—"}</td>
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
        <DialogContent hideClose={isMobile} className={isMobile ? "max-w-[100vw] w-full h-[100dvh] max-h-[100dvh] rounded-none border-0 flex flex-col p-0" : "max-w-md max-h-[90vh] overflow-y-auto"}>
          {isMobile ? (
            <>
              <div className="shrink-0 flex items-center justify-between border-b border-border px-4" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)", paddingBottom: "12px" }}>
                <h2 className="text-lg font-display font-semibold">Nova Visita</h2>
                <button onClick={() => setModalOpen(false)} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-muted" aria-label="Fechar">
                  <XIcon size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
                {renderFormFields(true)}
              </div>
              <div className="shrink-0 flex flex-col gap-2 px-4 pt-3 border-t border-border bg-background" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}>
                <Button onClick={handleCreate} disabled={saving} className="h-12 w-full font-semibold">
                  {saving ? "Agendando..." : "Salvar visita"}
                </Button>
                <Button variant="outline" className="h-12 w-full" onClick={() => setModalOpen(false)}>Cancelar</Button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">Nova Visita</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {renderFormFields(false)}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreate} disabled={saving} className="h-12 font-semibold">
                  {saving ? "Agendando..." : "Salvar visita"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Detail Modal */}
      <Dialog open={!!detailVisit} onOpenChange={(open) => { if (!open) { setDetailVisit(null); setEditing(false); } }}>
        <DialogContent hideClose={isMobile} className={isMobile ? "max-w-[100vw] w-full h-[100dvh] max-h-[100dvh] rounded-none border-0 flex flex-col p-0" : "max-w-md max-h-[90vh] overflow-y-auto"}>
          {detailVisit && (
            isMobile ? (
              <>
                <div className="shrink-0 flex items-center justify-between border-b border-border px-4" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)", paddingBottom: "12px" }}>
                  <h2 className="text-lg font-display font-semibold">Detalhes da Visita</h2>
                  <div className="flex items-center gap-1">
                    {!editing && detailVisit.status !== "Cancelada" && (
                      <button onClick={() => openEditForm(detailVisit)} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-muted">
                        <Pencil size={18} />
                      </button>
                    )}
                    <button onClick={() => { setDetailVisit(null); setEditing(false); }} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-muted">
                      <XIcon size={20} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
                  {editing ? renderEditFormFields(true) : renderDetailView(detailVisit)}
                </div>

                <div className="shrink-0 flex flex-col gap-2 px-4 pt-3 border-t border-border bg-background" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}>
                  {editing ? (
                    <>
                      <Button className="h-12 w-full font-semibold" disabled={editSaving} onClick={handleEditSave}>
                        {editSaving ? "Salvando..." : "Salvar alterações"}
                      </Button>
                      <Button variant="outline" className="h-12 w-full" onClick={() => setEditing(false)}>Cancelar edição</Button>
                    </>
                  ) : detailVisit.status !== "Cancelada" ? (
                    <>
                      {detailVisit.status !== "Confirmada" && (
                        <Button className="h-12 w-full gap-1.5 bg-success hover:bg-success/90 text-success-foreground font-semibold" onClick={() => handleStatusChange(detailVisit, "Confirmada")}>
                          <Check size={16} /> Confirmar
                        </Button>
                      )}
                      <Button variant="destructive" className="h-12 w-full gap-1.5" onClick={() => handleStatusChange(detailVisit, "Cancelada")}>
                        <XIcon size={16} /> Cancelar visita
                      </Button>
                    </>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <DialogHeader>
                  <div className="flex items-center justify-between pr-8">
                    <DialogTitle className="font-display">Detalhes da Visita</DialogTitle>
                    {!editing && detailVisit.status !== "Cancelada" && (
                      <Button variant="ghost" size="sm" className="gap-1.5 h-8" onClick={() => openEditForm(detailVisit)}>
                        <Pencil size={14} /> Editar
                      </Button>
                    )}
                  </div>
                </DialogHeader>
                {editing ? (
                  <div className="space-y-4">
                    {renderEditFormFields(false)}
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
                      <Button disabled={editSaving} onClick={handleEditSave}>{editSaving ? "Salvando..." : "Salvar alterações"}</Button>
                    </DialogFooter>
                  </div>
                ) : (
                  <>
                    {renderDetailView(detailVisit)}
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
              </>
            )
          )}
        </DialogContent>
      </Dialog>

      {/* WhatsApp Confirmation Message Modal */}
      <Dialog open={!!confirmMsgVisit} onOpenChange={(open) => { if (!open) setConfirmMsgVisit(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <MessageCircle size={20} className="text-green-500" />
              Enviar confirmação no grupo
            </DialogTitle>
          </DialogHeader>
          {confirmMsgVisit && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-xl p-4 text-sm whitespace-pre-wrap border border-border">
                {buildWhatsAppMessage(confirmMsgVisit)}
              </div>
              <p className="text-xs text-muted-foreground">
                A mensagem será copiada. Cole no grupo do WhatsApp.
              </p>
              <div className="flex gap-2">
                <Button
                  className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => {
                    const msg = buildWhatsAppMessage(confirmMsgVisit);
                    navigator.clipboard.writeText(msg).then(() => {
                      toast.success("Mensagem copiada!");
                    }).catch(() => {
                      toast.error("Não foi possível copiar");
                    });
                    window.open("https://web.whatsapp.com/", "_blank");
                    setConfirmMsgVisit(null);
                  }}
                >
                  <Copy size={16} /> Copiar e abrir WhatsApp
                </Button>
                <Button variant="outline" onClick={() => setConfirmMsgVisit(null)}>
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
