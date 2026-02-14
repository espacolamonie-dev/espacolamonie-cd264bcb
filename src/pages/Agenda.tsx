import { useEffect, useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Lock, Cake, Heart, PartyPopper, Building2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getContracts, getClients } from "@/data/store";
import type { Contract, Client } from "@/types";
import {
  addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, format, isSameMonth, isSameDay, isToday,
  addWeeks, subWeeks,
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

const EVENT_ICONS: Record<string, React.ElementType> = {
  "Aniversário Adulto": Cake,
  "Aniversário Infantil": Cake,
  "Casamento": Heart,
  "Confraternização": PartyPopper,
  "Evento Corporativo": Building2,
};

export default function Agenda() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewMode>("month");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [c, cl] = await Promise.all([getContracts(), getClients()]);
        setContracts(c);
        setClients(cl);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const clientMap = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c])), [clients]);
  const activeContracts = useMemo(() => contracts.filter((c) => c.status !== "cancelled"), [contracts]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, Contract[]> = {};
    contracts.forEach((c) => {
      const key = c.eventDate;
      if (!map[key]) map[key] = [];
      map[key].push(c);
    });
    return map;
  }, [contracts]);

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
            className="h-8 text-xs rounded-lg"
          >
            Mensal
          </Button>
          <Button
            variant={view === "week" ? "default" : "outline"}
            size="sm"
            onClick={() => setView("week")}
            className="h-8 text-xs rounded-lg"
          >
            Semanal
          </Button>
        </div>
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

      {/* Calendar grid */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
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

            return (
              <div
                key={dateKey}
                className={`relative border-b border-r border-border/40 ${isWeekView ? "min-h-[180px]" : "min-h-[100px]"} p-1.5 transition-colors ${
                  !isCurrentMonth && !isWeekView ? "bg-muted/20" : ""
                } ${isTodayDate ? "bg-primary/5 ring-1 ring-inset ring-primary/15" : ""} ${
                  isBlocked && !isTodayDate ? "bg-secondary/50" : ""
                }`}
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
                    const client = clientMap[evt.clientId];
                    const isCancelled = evt.status === "cancelled";
                    const EventIcon = EVENT_ICONS[evt.eventType] || Users;
                    return (
                      <div
                        key={evt.id}
                        className={`rounded-md px-1.5 py-0.5 text-[10px] leading-tight truncate border flex items-center gap-1 ${
                          STATUS_COLORS[evt.status] || "bg-muted text-muted-foreground"
                        } ${isCancelled ? "opacity-40 line-through" : ""}`}
                      >
                        <EventIcon size={9} className="shrink-0" />
                        <span className="truncate">{client?.name || "—"}</span>
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
          <Lock size={10} /> Data ocupada
        </div>
      </div>
    </div>
  );
}
