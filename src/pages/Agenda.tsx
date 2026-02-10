import { useEffect, useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getContracts, getClients } from "@/data/store";
import type { Contract, Client } from "@/types";
import {
  addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isSameDay, isToday,
  addWeeks, subWeeks, startOfDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";

type ViewMode = "month" | "week";

const STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-success/15 text-success border-success/30",
  signed: "bg-primary/15 text-primary border-primary/30",
  awaiting_documents: "bg-warning/15 text-warning border-warning/30",
  awaiting_signature: "bg-warning/15 text-warning border-warning/30",
  cancelled: "bg-danger/15 text-danger border-danger/30",
};

const STATUS_DOT: Record<string, string> = {
  confirmed: "bg-success",
  signed: "bg-primary",
  awaiting_documents: "bg-warning",
  awaiting_signature: "bg-warning",
  cancelled: "bg-danger",
};

export default function Agenda() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewMode>("month");

  useEffect(() => {
    (async () => {
      const [c, cl] = await Promise.all([getContracts(), getClients()]);
      setContracts(c);
      setClients(cl);
    })();
  }, []);

  const clientMap = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c])), [clients]);

  // Active contracts (not cancelled) for blocking
  const activeContracts = useMemo(() => contracts.filter((c) => c.status !== "cancelled"), [contracts]);

  // Map date string -> contracts
  const eventsByDate = useMemo(() => {
    const map: Record<string, Contract[]> = {};
    contracts.forEach((c) => {
      const key = c.eventDate;
      if (!map[key]) map[key] = [];
      map[key].push(c);
    });
    return map;
  }, [contracts]);

  // Blocked dates (have active contract)
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

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-semibold tracking-tight">Agenda</h1>
          <p className="text-sm text-muted-foreground mt-1">Eventos e disponibilidade</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={view === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("month")}
            className="h-8 text-xs"
          >
            Mensal
          </Button>
          <Button
            variant={view === "week" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("week")}
            className="h-8 text-xs"
          >
            Semanal
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
          <ChevronLeft size={16} />
        </Button>
        <h2 className="text-lg font-display font-semibold capitalize">{title}</h2>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(1)}>
          <ChevronRight size={16} />
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-7 border-b border-border/60">
          {weekDays.map((d) => (
            <div key={d} className="px-2 py-2 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const dayEvents = eventsByDate[dateKey] || [];
            const isBlocked = blockedDates.has(dateKey);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isWeekView = view === "week";

            return (
              <div
                key={dateKey}
                className={`relative border-b border-r border-border/30 ${isWeekView ? "min-h-[180px]" : "min-h-[100px]"} p-1.5 transition-colors ${
                  !isCurrentMonth && !isWeekView ? "bg-muted/20" : ""
                } ${isToday(day) ? "bg-primary/5" : ""}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                      isToday(day)
                        ? "bg-primary text-primary-foreground"
                        : !isCurrentMonth && !isWeekView
                        ? "text-muted-foreground/40"
                        : "text-foreground"
                    }`}
                  >
                    {format(day, "d")}
                  </span>
                  {isBlocked && (
                    <Lock size={10} className="text-danger/60" />
                  )}
                </div>

                <div className="space-y-0.5">
                  {dayEvents.slice(0, isWeekView ? 10 : 2).map((evt) => {
                    const client = clientMap[evt.clientId];
                    const isCancelled = evt.status === "cancelled";
                    return (
                      <div
                        key={evt.id}
                        className={`rounded px-1.5 py-0.5 text-[10px] leading-tight truncate border ${
                          STATUS_COLORS[evt.status] || "bg-muted text-muted-foreground"
                        } ${isCancelled ? "opacity-50 line-through" : ""}`}
                      >
                        <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1 ${STATUS_DOT[evt.status] || "bg-muted-foreground"}`} />
                        {evt.eventType} – {client?.name || "—"}
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

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
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
          <Lock size={10} /> Data bloqueada
        </div>
      </div>
    </div>
  );
}
