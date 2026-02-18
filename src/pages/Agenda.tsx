import { useEffect, useState, useMemo, useCallback } from "react";
import {
  ChevronLeft, ChevronRight, Lock, Cake, Heart, PartyPopper, Building2, Users,
  RefreshCw, Calendar as CalendarIcon, ExternalLink, Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getContracts, getClients } from "@/data/store";
import type { Contract, Client } from "@/types";
import {
  addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isSameDay, isToday,
  addWeeks, subWeeks,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { useGoogleCalendar, GoogleEvent } from "@/hooks/useGoogleCalendar";
import { Link } from "react-router-dom";

type ViewMode = "month" | "week";
type FilterType = "all" | "contracts" | "google";
type FilterPayment = "all" | "pending" | "deposit_paid" | "paid_full" | "cancelled";

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-success/15 text-success border-success/30",
  signed: "bg-primary/15 text-primary border-primary/30",
  awaiting_documents: "bg-warning/15 text-warning border-warning/30",
  awaiting_signature: "bg-warning/15 text-warning border-warning/30",
  cancelled: "bg-danger/15 text-danger border-danger/30",
};

const EVENT_ICONS: Record<string, React.ElementType> = {
  "Aniversário Adulto": Cake,
  "Aniversário Infantil": Cake,
  "Casamento": Heart,
  "Confraternização": PartyPopper,
  "Evento Corporativo": Building2,
};

interface DayEvent {
  type: "contract" | "google";
  id: string;
  title: string;
  subtitle?: string;
  statusColor: string;
  isCancelled?: boolean;
  contract?: Contract;
  googleEvent?: GoogleEvent;
  Icon?: React.ElementType;
}

function googleEventDate(evt: GoogleEvent): string {
  return evt.start.date || (evt.start.dateTime ? evt.start.dateTime.slice(0, 10) : "");
}

export default function Agenda() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewMode>("month");
  const [loading, setLoading] = useState(true);
  const [googleEvents, setGoogleEvents] = useState<GoogleEvent[]>([]);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [filterPayment, setFilterPayment] = useState<FilterPayment>("all");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const { fetchSettings, fetchGoogleEvents } = useGoogleCalendar();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [c, cl] = await Promise.all([getContracts(), getClients()]);
      setContracts(c);
      setClients(cl);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadGoogleEvents = useCallback(async () => {
    setGoogleLoading(true);
    try {
      const s = await fetchSettings();
      setIsGoogleConnected(!!s?.is_connected);
      if (s?.is_connected) {
        const year = currentDate.getFullYear();
        const events = await fetchGoogleEvents(
          `${year - 1}-01-01T00:00:00Z`,
          `${year + 2}-12-31T23:59:59Z`
        );
        setGoogleEvents(events);
      }
    } finally {
      setGoogleLoading(false);
    }
  }, [fetchSettings, fetchGoogleEvents, currentDate.getFullYear()]);

  useEffect(() => {
    loadData();
    loadGoogleEvents();
  }, []);

  const clientMap = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c])), [clients]);
  const activeContracts = useMemo(() => contracts.filter((c) => c.status !== "cancelled"), [contracts]);

  // Map contract IDs that have google events (by google_event_id or extendedProperties)
  const googleLinkedContractIds = useMemo(() => {
    const set = new Set<string>();
    googleEvents.forEach((ge) => {
      const cid = ge.extendedProperties?.private?.contract_id;
      if (cid) set.add(cid);
    });
    return set;
  }, [googleEvents]);

  // External Google events (not linked to any CRM contract)
  const externalGoogleEvents = useMemo(() => {
    return googleEvents.filter(
      (ge) => !ge.extendedProperties?.private?.crm || !ge.extendedProperties?.private?.contract_id
    );
  }, [googleEvents]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, DayEvent[]> = {};

    // Add CRM contracts
    contracts.forEach((c) => {
      const key = c.eventDate;
      if (!map[key]) map[key] = [];
      const client = clientMap[c.clientId];
      const isCancelled = c.status === "cancelled";

      // Payment filter
      if (filterPayment !== "all") {
        if (filterPayment === "cancelled" && !isCancelled) return;
        if (filterPayment !== "cancelled" && c.paymentStatus !== filterPayment && !isCancelled) return;
      }

      if (filterType !== "google") {
        map[key].push({
          type: "contract",
          id: c.id,
          title: client?.name || "—",
          subtitle: c.eventType,
          statusColor: STATUS_COLORS[c.status] || "bg-muted text-muted-foreground border-transparent",
          isCancelled,
          contract: c,
          Icon: EVENT_ICONS[c.eventType] || Users,
        });
      }
    });

    // Add external Google events
    if (filterType !== "contracts" && filterPayment === "all") {
      externalGoogleEvents.forEach((ge) => {
        const key = googleEventDate(ge);
        if (!key) return;
        if (!map[key]) map[key] = [];
        map[key].push({
          type: "google",
          id: ge.id,
          title: ge.summary || "(sem título)",
          statusColor: "bg-muted/60 text-muted-foreground border-border",
          googleEvent: ge,
          Icon: CalendarIcon,
        });
      });
    }

    return map;
  }, [contracts, clientMap, externalGoogleEvents, filterType, filterPayment]);

  const blockedDates = useMemo(() => {
    const set = new Set<string>();
    activeContracts.forEach((c) => set.add(c.eventDate));
    return set;
  }, [activeContracts]);

  const navigate = (dir: number) => {
    if (view === "month") {
      setCurrentDate(dir > 0 ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    } else {
      setCurrentDate(dir > 0 ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
    }
    setSelectedDay(null);
  };

  const days = useMemo(() => {
    if (view === "month") {
      const start = startOfWeek(startOfMonth(currentDate), { locale: ptBR });
      const end = endOfWeek(endOfMonth(currentDate), { locale: ptBR });
      return eachDayOfInterval({ start, end });
    } else {
      const start = startOfWeek(currentDate, { locale: ptBR });
      const end = endOfWeek(currentDate, { locale: ptBR });
      return eachDayOfInterval({ start, end });
    }
  }, [currentDate, view]);

  const title = view === "month"
    ? format(currentDate, "MMMM yyyy", { locale: ptBR })
    : `Semana de ${format(startOfWeek(currentDate, { locale: ptBR }), "dd/MM", { locale: ptBR })} a ${format(endOfWeek(currentDate, { locale: ptBR }), "dd/MM", { locale: ptBR })}`;

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  // Selected day events for side panel
  const selectedDayEvents = selectedDay ? (eventsByDate[selectedDay] || []) : [];

  if (loading) {
    return (
      <div className="animate-fade-in space-y-6">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-8 w-full max-w-xs mx-auto" />
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-semibold tracking-tight">Agenda</h1>
          <p className="text-sm text-muted-foreground mt-1">Eventos e disponibilidade</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Google status */}
          {isGoogleConnected ? (
            <Badge className="bg-success/12 text-success border-success/25 gap-1.5">
              <CalendarIcon size={11} /> Google conectado
            </Badge>
          ) : (
            <Link to="/settings">
              <Badge variant="outline" className="gap-1.5 cursor-pointer hover:bg-muted/50 transition-colors">
                <CalendarIcon size={11} /> Conectar Google Agenda
                <ExternalLink size={9} />
              </Badge>
            </Link>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={loadGoogleEvents}
            disabled={googleLoading}
          >
            <RefreshCw size={11} className={googleLoading ? "animate-spin" : ""} />
            Sincronizar
          </Button>

          <Button
            variant={view === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => { setView("month"); setSelectedDay(null); }}
            className="h-8 text-xs rounded-lg"
          >
            Mensal
          </Button>
          <Button
            variant={view === "week" ? "default" : "outline"}
            size="sm"
            onClick={() => { setView("week"); setSelectedDay(null); }}
            className="h-8 text-xs rounded-lg"
          >
            Semanal
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter size={13} className="text-muted-foreground" />
        <Select value={filterType} onValueChange={(v) => setFilterType(v as FilterType)}>
          <SelectTrigger className="h-8 text-xs w-44 rounded-lg">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os eventos</SelectItem>
            <SelectItem value="contracts">Apenas contratos</SelectItem>
            <SelectItem value="google">Apenas Google (externos)</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterPayment} onValueChange={(v) => setFilterPayment(v as FilterPayment)}>
          <SelectTrigger className="h-8 text-xs w-44 rounded-lg">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Qualquer status</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="deposit_paid">Sinal Pago</SelectItem>
            <SelectItem value="paid_full">Pago Total</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => navigate(-1)}>
          <ChevronLeft size={16} />
        </Button>
        <h2 className="text-lg font-display font-semibold capitalize">{title}</h2>
        <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => navigate(1)}>
          <ChevronRight size={16} />
        </Button>
      </div>

      <div className="flex gap-4">
        {/* Calendar grid */}
        <div className="flex-1 rounded-xl border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border">
            {weekDays.map((d) => (
              <div key={d} className="px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {days.map((day) => {
              const dateKey = format(day, "yyyy-MM-dd");
              const dayEvents = eventsByDate[dateKey] || [];
              const isBlocked = blockedDates.has(dateKey);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isWeekView = view === "week";
              const isTodayDate = isToday(day);
              const isSelected = selectedDay === dateKey;

              return (
                <div
                  key={dateKey}
                  onClick={() => setSelectedDay(isSelected ? null : dateKey)}
                  className={`relative border-b border-r border-border/40 ${isWeekView ? "min-h-[180px]" : "min-h-[100px]"} p-1.5 transition-colors cursor-pointer ${
                    !isCurrentMonth && !isWeekView ? "bg-muted/20" : ""
                  } ${isTodayDate ? "bg-primary/5 ring-1 ring-inset ring-primary/15" : ""} ${
                    isBlocked && !isTodayDate ? "bg-secondary/50" : ""
                  } ${isSelected ? "ring-2 ring-inset ring-primary/40" : ""} hover:bg-muted/30`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                        isTodayDate
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : !isCurrentMonth && !isWeekView
                          ? "text-muted-foreground/30"
                          : "text-foreground"
                      }`}
                    >
                      {format(day, "d")}
                    </span>
                    {isBlocked && (
                      <Lock size={10} className="text-muted-foreground/30" />
                    )}
                  </div>

                  <div className="space-y-0.5">
                    {dayEvents.slice(0, isWeekView ? 10 : 2).map((evt) => {
                      const Icon = evt.Icon || Users;
                      return (
                        <div
                          key={evt.id}
                          className={`rounded-md px-1.5 py-0.5 text-[10px] leading-tight truncate border flex items-center gap-1 ${evt.statusColor} ${
                            evt.isCancelled ? "opacity-40 line-through" : ""
                          }`}
                        >
                          <Icon size={9} className="shrink-0" />
                          <span className="truncate">{evt.title}</span>
                          {evt.type === "google" && (
                            <CalendarIcon size={8} className="shrink-0 ml-auto opacity-60" />
                          )}
                        </div>
                      );
                    })}
                    {dayEvents.length > (isWeekView ? 10 : 2) && (
                      <p className="text-[9px] text-muted-foreground pl-1">
                        +{dayEvents.length - (isWeekView ? 10 : 2)} mais
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Side panel for selected day */}
        {selectedDay && (
          <div className="w-72 shrink-0 rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/30">
              <p className="text-sm font-semibold font-display capitalize">
                {format(new Date(selectedDay + "T12:00:00"), "dd 'de' MMMM", { locale: ptBR })}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedDayEvents.length} evento{selectedDayEvents.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="divide-y divide-border/40 max-h-[480px] overflow-y-auto">
              {selectedDayEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Nenhum evento neste dia.</p>
              ) : (
                selectedDayEvents.map((evt) => {
                  const Icon = evt.Icon || Users;
                  return (
                    <div key={evt.id} className="p-3 space-y-1.5">
                      <div className="flex items-start gap-2">
                        <div className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-md border shrink-0 ${evt.statusColor}`}>
                          <Icon size={11} />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-medium leading-tight ${evt.isCancelled ? "line-through opacity-50" : ""}`}>
                            {evt.title}
                          </p>
                          {evt.subtitle && (
                            <p className="text-xs text-muted-foreground">{evt.subtitle}</p>
                          )}
                          {evt.type === "google" && (
                            <Badge className="mt-1 text-[9px] h-4 bg-muted/80 text-muted-foreground border-border">
                              Externo (Google)
                            </Badge>
                          )}
                          {evt.type === "contract" && (
                            <Badge className="mt-1 text-[9px] h-4 bg-primary/10 text-primary border-primary/20">
                              Contrato (CRM)
                            </Badge>
                          )}
                        </div>
                      </div>

                      {evt.type === "contract" && evt.contract && (() => {
                        const c = evt.contract;
                        const client = clientMap[c.clientId];
                        return (
                          <div className="text-[11px] text-muted-foreground space-y-0.5 pl-8">
                            <p>💰 R$ {c.totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                            <p>🕐 {c.eventTime || "—"}</p>
                            <p>👥 {c.guestCount} convidados</p>
                          </div>
                        );
                      })()}

                      {evt.type === "google" && evt.googleEvent?.description && (
                        <div className="text-[11px] text-muted-foreground pl-8 whitespace-pre-wrap line-clamp-4">
                          {evt.googleEvent.description}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-success" /> Confirmado
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-primary" /> Assinado
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-warning" /> Aguardando
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-danger" /> Cancelado
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" /> Externo (Google)
        </div>
        <div className="flex items-center gap-1.5">
          <Lock size={10} /> Data ocupada
        </div>
      </div>
    </div>
  );
}
