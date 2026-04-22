import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { format, startOfDay, isBefore, addMonths, endOfMonth, eachDayOfInterval, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  Users,
  Loader2,
  Sparkles,
  ChevronRight,
  PartyPopper,
  MessageCircle,
  CalendarHeart,
  AlertTriangle,
  Waves,
  TreePine,
  Home,
  Flame,
  Refrigerator,
  Star,
  Instagram,
  ExternalLink,
  Image as ImageIcon,
} from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const EVENT_PREFILL_KEY = "lamonie:event-prefill";

// Same standardized list used in BookVisit
const EVENT_TYPES_OPTIONS = [
  "Aniversário 15 anos", "Aniversário Adulto", "Aniversário Infantil", "Casamento",
  "Chá de bebê", "Chá de fraldas", "Chá de panela", "Chá de revelação",
  "Confraternização", "Recepção de casamento",
];

async function callBooking(action: string, extra: Record<string, unknown> = {}) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/public-booking`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY },
    body: JSON.stringify({ action, ...extra }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Erro na requisição");
  return json;
}

const EVENT_HOURS = [
  { label: "08h às 20h", value: "08:00 às 20:00" },
  { label: "09h às 21h", value: "09:00 às 21:00" },
  { label: "10h às 22h", value: "10:00 às 22:00" },
  { label: "11h às 23h", value: "11:00 às 23:00" },
];

const STEPS = ["date", "time", "form", "summary"] as const;
const STEP_LABELS = ["Data", "Horário", "Dados", "Resumo"];

const AMENITIES = [
  { icon: Waves, label: "Piscina" },
  { icon: TreePine, label: "Área verde gramada" },
  { icon: Home, label: "150m² de área coberta" },
  { icon: Flame, label: "Churrasqueira" },
  { icon: Refrigerator, label: "Geladeira e freezer" },
];

export default function EventDates() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"date" | "time" | "form" | "summary">("date");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [eventType, setEventType] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [busyDates, setBusyDates] = useState<Set<string>>(new Set());
  const [loadingDates, setLoadingDates] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [galleryOpen, setGalleryOpen] = useState(false);

  // Fetch busy dates for the visible month range
  const fetchBusyDates = useCallback(async (month: Date) => {
    setLoadingDates(true);
    try {
      const startDate = format(month, "yyyy-MM-01");
      const endMonth = addMonths(month, 1);
      const endDate = format(endMonth, "yyyy-MM-01");
      const data = await callBooking("get-busy-event-dates", {
        start_date: startDate,
        end_date: endDate,
      });
      setBusyDates(new Set(data.busy_dates || []));
    } catch (e) {
      console.error("Error fetching busy dates:", e);
    } finally {
      setLoadingDates(false);
    }
  }, []);

  useEffect(() => {
    fetchBusyDates(currentMonth);
  }, [currentMonth, fetchBusyDates]);

  // Available dates count for current month
  const availableDatesCount = useMemo(() => {
    if (loadingDates) return null;
    const today = startOfDay(new Date());
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    let count = 0;
    for (const day of days) {
      if (isBefore(day, today)) continue;
      const dow = day.getDay();
      if (dow !== 5 && dow !== 6 && dow !== 0) continue;
      const dateStr = format(day, "yyyy-MM-dd");
      if (!busyDates.has(dateStr)) count++;
    }
    return count;
  }, [currentMonth, busyDates, loadingDates]);

  const monthName = format(currentMonth, "MMMM", { locale: ptBR });

  const isDateDisabled = useCallback(
    (date: Date) => {
      const today = startOfDay(new Date());
      if (isBefore(date, today)) return true;
      const day = date.getDay();
      if (day !== 5 && day !== 6 && day !== 0) return true;
      const dateStr = format(date, "yyyy-MM-dd");
      return busyDates.has(dateStr);
    },
    [busyDates]
  );

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    setSelectedDate(date);
    setSelectedTime(null);
    setStep("time");
  };

  // Save event data into sessionStorage so the next steps can pre-fill
  const persistPrefill = useCallback(() => {
    if (!selectedDate) return;
    const payload = {
      eventType: eventType.trim(),
      guestCount: guestCount ? parseInt(guestCount, 10) : 0,
      interestDate: format(selectedDate, "yyyy-MM-dd"),
      eventTime: selectedTime || "",
    };
    try {
      sessionStorage.setItem(EVENT_PREFILL_KEY, JSON.stringify(payload));
    } catch {}
  }, [selectedDate, selectedTime, eventType, guestCount]);

  const handleContinueToSummary = () => {
    if (!eventType.trim() || !guestCount.trim()) return;
    persistPrefill();
    setStep("summary");
  };

  const handleScheduleVisit = () => {
    persistPrefill();
    navigate("/agendar-visita");
  };

  const handleWhatsAppMoreInfo = () => {
    if (!selectedDate || !selectedTime) return;
    const dateFormatted = format(selectedDate, "dd/MM/yyyy (EEEE)", { locale: ptBR });
    const msg = `Olá! Estive vendo as datas no site e gostaria de mais informações:\n\n📅 Data de interesse: ${dateFormatted}\n🕐 Horário: ${selectedTime}\n🎉 Tipo de evento: ${eventType.trim()}\n👥 Quantidade de pessoas: ${guestCount.trim()}\n\nPoderiam me enviar mais fotos e tirar algumas dúvidas?`;
    const url = `https://wa.me/5531997111502?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  const currentStepIdx = STEPS.indexOf(step);

  const modifiers = {
    busy: (date: Date) => {
      const day = date.getDay();
      if (day !== 5 && day !== 6 && day !== 0) return false;
      const dateStr = format(date, "yyyy-MM-dd");
      return busyDates.has(dateStr);
    },
  };

  const modifiersStyles = {
    busy: {
      color: "#a8a29e",
      textDecoration: "line-through",
    },
  };

  return (
    <div className="min-h-screen bg-[#FAF9F7]">
      <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-[#1F4D3A]/5 to-transparent pointer-events-none" />

      {/* Header */}
      <header className="relative bg-white/90 backdrop-blur-md border-b border-stone-100 sticky top-0 z-20">
        <div className="max-w-md mx-auto px-5 py-4 flex items-center gap-3.5">
          <img
            src="/images/logo-lamonie.png"
            alt="Lamoniê"
            className="h-11 w-11 rounded-2xl object-cover shadow-sm ring-1 ring-stone-100"
          />
          <div>
            <h1 className="text-base font-bold tracking-tight text-[#1F4D3A]">Espaço Lamoniê</h1>
            <p className="text-[11px] text-stone-400 font-medium tracking-wide uppercase">
              Datas para eventos
            </p>
          </div>
        </div>
      </header>

      <div className="relative max-w-md mx-auto px-5 pt-6 pb-10 space-y-5">

        {/* Hero (visible on date step only) */}
        {step === "date" && (
          <div className="bg-gradient-to-br from-[#1F4D3A] to-[#2a6b50] rounded-3xl p-5 text-white relative overflow-hidden">
            <div className="absolute -right-6 -top-6 w-28 h-28 bg-white/5 rounded-full" />
            <div className="absolute -right-2 -bottom-8 w-20 h-20 bg-white/5 rounded-full" />
            <div className="relative">
              <div className="flex items-center gap-1.5 text-emerald-200 text-[11px] font-semibold uppercase tracking-wider mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                Disponibilidade
              </div>
              <h2 className="text-lg font-bold leading-snug">
                Verifique a disponibilidade para seu evento
              </h2>
              <p className="text-emerald-100/80 text-xs mt-1.5 leading-relaxed">
                Eventos às sextas, sábados e domingos.
              </p>
              <p className="text-white text-sm font-semibold mt-2">
                A partir de <span className="text-emerald-300">R$650</span> para até <span className="text-emerald-300">150 pessoas</span>
              </p>
            </div>
          </div>
        )}

        {/* Social proof + Instagram (date step only) */}
        {step === "date" && (
          <>
            <div className="bg-white rounded-2xl border border-stone-100 px-4 py-3.5 flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-[#1F4D3A]" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-stone-800">+120 eventos realizados</p>
                <div className="flex items-center gap-1 mt-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                  ))}
                  <span className="text-[11px] text-stone-400 ml-1">Avaliações no Google</span>
                </div>
                <p className="text-[11px] text-stone-400 mt-0.5">Casamentos, aniversários e confraternizações</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-stone-100 px-4 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center shrink-0">
                  <Instagram className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold text-stone-800">Espaço Lamoniê</p>
                  <p className="text-[11px] text-stone-400">@espacolamonie</p>
                </div>
              </div>
              <a
                href="https://www.instagram.com/espacolamonie"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] font-semibold text-[#1F4D3A] hover:underline shrink-0"
              >
                Ver <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </>
        )}

        {/* Progress */}
        <div className="flex items-center gap-1 bg-white rounded-2xl p-2 shadow-sm border border-stone-100">
          {STEPS.map((s, i) => (
            <div key={s} className="flex-1 relative">
              <button
                onClick={() => {
                  if (i < currentStepIdx) {
                    if (i === 0) { setStep("date"); setSelectedDate(undefined); }
                    if (i === 1) setStep("time");
                    if (i === 2) setStep("form");
                  }
                }}
                className={cn(
                  "w-full py-2 rounded-xl text-[11px] font-semibold transition-all flex items-center justify-center gap-1",
                  step === s
                    ? "bg-[#1F4D3A] text-white shadow-sm"
                    : currentStepIdx > i
                    ? "text-[#1F4D3A] bg-emerald-50 cursor-pointer"
                    : "text-stone-400 bg-transparent"
                )}
              >
                {currentStepIdx > i && <CheckCircle2 className="w-3 h-3" />}
                {STEP_LABELS[i]}
              </button>
            </div>
          ))}
        </div>

        {/* Step 1: Date */}
        {step === "date" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* What's included */}
            <div className="bg-white rounded-2xl border border-stone-100 p-4">
              <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#1F4D3A]" />
                O que está incluso no espaço
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {AMENITIES.map((a) => (
                  <div key={a.label} className="flex items-center gap-2 text-xs text-stone-600">
                    <a.icon className="w-3.5 h-3.5 text-[#1F4D3A] shrink-0" />
                    {a.label}
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-stone-50 flex items-center gap-1.5 text-xs text-[#1F4D3A] font-semibold">
                <Users className="w-3.5 h-3.5" />
                Ideal para eventos de até 150 pessoas
              </div>
            </div>

            {/* Scarcity warning */}
            <div className="bg-amber-50 border border-amber-200/60 rounded-2xl px-4 py-3 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-amber-800 font-semibold leading-snug">
                  Datas de final de semana costumam esgotar rapidamente.
                </p>
                <p className="text-[11px] text-amber-600 mt-0.5 leading-snug">
                  Recomendamos reservar com antecedência para garantir sua data.
                </p>
              </div>
            </div>

            {availableDatesCount !== null && availableDatesCount <= 5 && (
              <div className="bg-red-50 border border-red-200/60 rounded-2xl px-4 py-3 flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                <p className="text-xs text-red-700 font-semibold">
                  Restam apenas {availableDatesCount} {availableDatesCount === 1 ? "data disponível" : "datas disponíveis"} para{" "}
                  <span className="capitalize">{monthName}</span>
                </p>
              </div>
            )}

            {/* Calendar card */}
            <div className="bg-white rounded-3xl shadow-sm border border-stone-100 overflow-hidden">
              <div className="px-5 pt-5 pb-2 text-center">
                <h2 className="text-base font-bold text-stone-800">Qual data para o evento?</h2>
                <p className="text-xs text-stone-400 mt-0.5">
                  Selecione uma sexta, sábado ou domingo
                </p>
              </div>
              {loadingDates && (
                <div className="flex items-center justify-center gap-2 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#1F4D3A]" />
                  <span className="text-xs text-stone-400">Verificando agenda...</span>
                </div>
              )}
              <div className="flex justify-center px-2 pb-2">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  disabled={isDateDisabled}
                  locale={ptBR}
                  className="p-3 pointer-events-auto"
                  fromDate={new Date()}
                  onMonthChange={setCurrentMonth}
                  modifiers={modifiers}
                  modifiersStyles={modifiersStyles}
                  components={{
                    DayContent: ({ date, activeModifiers }) => (
                      <span title={activeModifiers?.disabled ? "Data já reservada" : undefined}>
                        {date.getDate()}
                      </span>
                    ),
                  }}
                />
              </div>
              <div className="flex items-center gap-4 px-5 pb-4">
                <div className="flex items-center gap-1.5 text-[10px] text-stone-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-white border-2 border-stone-200" /> Disponível
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-stone-400">
                  <span className="w-2.5 h-2.5 rounded-full bg-stone-200" /> Indisponível
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Time */}
        {step === "time" && (
          <div className="bg-white rounded-3xl shadow-sm border border-stone-100 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="px-5 pt-5 pb-3">
              <h2 className="text-base font-bold text-stone-800 text-center">
                Escolha o horário do evento
              </h2>
              {selectedDate && (
                <p className="text-xs text-stone-400 mt-0.5 text-center capitalize">
                  {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </p>
              )}
              <p className="text-[11px] text-stone-400 mt-2 text-center">
                Todos os eventos têm duração de 12 horas
              </p>
            </div>

            <div className="px-5 pb-5 space-y-2">
              {EVENT_HOURS.map((h) => (
                <button
                  key={h.value}
                  onClick={() => setSelectedTime(h.value)}
                  className={cn(
                    "w-full py-3.5 rounded-xl text-sm font-semibold transition-all border-2 flex items-center justify-center gap-2",
                    selectedTime === h.value
                      ? "bg-[#1F4D3A] text-white border-[#1F4D3A] shadow-md shadow-emerald-900/10"
                      : "bg-white text-stone-700 border-stone-100 hover:border-[#1F4D3A]/30 hover:bg-emerald-50/50 active:scale-[0.97]"
                  )}
                >
                  <Clock className="w-4 h-4" />
                  {h.label}
                </button>
              ))}
            </div>

            <div className="flex gap-2.5 px-5 pb-5">
              <Button
                variant="outline"
                onClick={() => { setStep("date"); setSelectedDate(undefined); }}
                className="flex-1 rounded-xl h-11"
              >
                Voltar
              </Button>
              <Button
                onClick={() => selectedTime && setStep("form")}
                disabled={!selectedTime}
                className="flex-1 rounded-xl h-11 bg-[#1F4D3A] hover:bg-[#1a4231] text-white shadow-md shadow-emerald-900/10"
              >
                Continuar <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Form (event details) */}
        {step === "form" && (
          <div className="bg-white rounded-3xl shadow-sm border border-stone-100 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="mx-5 mt-5 mb-4 flex items-center gap-3 bg-emerald-50/70 rounded-xl px-4 py-2.5 border border-emerald-100">
              <CalendarHeart className="w-5 h-5 text-[#1F4D3A] shrink-0" />
              <div className="text-xs">
                <span className="font-semibold text-stone-700 capitalize">
                  {selectedDate && format(selectedDate, "EEEE, dd/MM", { locale: ptBR })}
                </span>
                <span className="text-stone-400 mx-1.5">•</span>
                <span className="font-semibold text-[#1F4D3A]">{selectedTime}</span>
              </div>
            </div>

            <div className="px-5 pb-5 space-y-3.5">
              <div>
                <Label htmlFor="eventType" className="text-xs font-semibold text-stone-600">
                  Tipo de evento *
                </Label>
                <div className="mt-1.5">
                  <Select value={eventType} onValueChange={setEventType}>
                    <SelectTrigger className="h-11 rounded-xl bg-stone-50/50 border-stone-200 focus:bg-white">
                      <div className="flex items-center gap-2">
                        <PartyPopper className="w-4 h-4 text-stone-300" />
                        <SelectValue placeholder="Selecione o tipo de evento" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {EVENT_TYPES_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="guests" className="text-xs font-semibold text-stone-600">
                  Quantidade de pessoas *
                </Label>
                <div className="relative mt-1.5">
                  <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300" />
                  <Input
                    id="guests"
                    type="number"
                    min="1"
                    value={guestCount}
                    onChange={(e) => setGuestCount(e.target.value)}
                    placeholder="Ex: 100"
                    className="pl-10 h-11 rounded-xl bg-stone-50/50 border-stone-200 focus:bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2.5 px-5 pb-5">
              <Button
                variant="outline"
                onClick={() => setStep("time")}
                className="flex-1 rounded-xl h-12"
              >
                Voltar
              </Button>
              <Button
                onClick={handleContinueToSummary}
                disabled={!eventType.trim() || !guestCount.trim()}
                className="flex-1 rounded-xl h-12 bg-[#1F4D3A] hover:bg-[#1a4231] text-white shadow-lg shadow-emerald-900/10 text-sm font-semibold"
              >
                Continuar <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Summary + Actions */}
        {step === "summary" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Summary card */}
            <div className="bg-white rounded-3xl shadow-sm border border-stone-100 overflow-hidden">
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/40 px-6 pt-6 pb-5 text-center">
                <div className="mx-auto w-14 h-14 bg-white rounded-2xl shadow shadow-emerald-200/40 flex items-center justify-center mb-3">
                  <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                </div>
                <h2 className="text-lg font-bold text-stone-800">Resumo do evento</h2>
                <p className="text-xs text-stone-500 mt-1">Confira os dados antes de continuar</p>
              </div>

              <div className="px-6 py-5 space-y-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-stone-50 flex items-center justify-center shrink-0">
                    <PartyPopper className="w-4 h-4 text-[#1F4D3A]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-stone-400 uppercase tracking-wide font-semibold">Tipo de evento</p>
                    <p className="text-sm font-semibold text-stone-800">{eventType}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-stone-50 flex items-center justify-center shrink-0">
                    <Users className="w-4 h-4 text-[#1F4D3A]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-stone-400 uppercase tracking-wide font-semibold">Quantidade de pessoas</p>
                    <p className="text-sm font-semibold text-stone-800">{guestCount} pessoas</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-stone-50 flex items-center justify-center shrink-0">
                    <CalendarDays className="w-4 h-4 text-[#1F4D3A]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-stone-400 uppercase tracking-wide font-semibold">Data desejada</p>
                    <p className="text-sm font-semibold text-stone-800 capitalize">
                      {selectedDate && format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-stone-50 flex items-center justify-center shrink-0">
                    <Clock className="w-4 h-4 text-[#1F4D3A]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-stone-400 uppercase tracking-wide font-semibold">Horário</p>
                    <p className="text-sm font-semibold text-stone-800">{selectedTime}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="space-y-2.5">
              <Button
                onClick={handleScheduleVisit}
                className="w-full rounded-2xl h-14 bg-[#1F4D3A] hover:bg-[#1a4231] text-white shadow-lg shadow-emerald-900/15 text-sm font-bold flex items-center justify-center gap-2"
              >
                <CalendarHeart className="w-5 h-5" />
                Agendar visita ao espaço
              </Button>

              <Button
                onClick={() => setGalleryOpen(true)}
                variant="outline"
                className="w-full rounded-2xl h-14 border-2 border-stone-200 hover:border-[#1F4D3A]/30 hover:bg-emerald-50/40 text-stone-700 text-sm font-semibold flex items-center justify-center gap-2"
              >
                <ImageIcon className="w-5 h-5" />
                Ver mais fotos / consultar disponibilidade
              </Button>

              <button
                onClick={() => setStep("form")}
                className="w-full text-center text-xs text-stone-500 font-medium py-2 hover:underline"
              >
                ← Editar dados do evento
              </button>
            </div>
          </div>
        )}

        {/* Trust indicators */}
        <div className="flex items-center justify-center gap-4 pt-1 pb-4">
          <div className="flex items-center gap-1.5 text-[10px] text-stone-400">
            <CalendarDays className="w-3 h-3" /> Sex, Sáb e Dom
          </div>
          <div className="w-px h-3 bg-stone-200" />
          <div className="flex items-center gap-1.5 text-[10px] text-stone-400">
            <Clock className="w-3 h-3" /> 12 horas
          </div>
          <div className="w-px h-3 bg-stone-200" />
          <div className="flex items-center gap-1.5 text-[10px] text-stone-400">
            <MessageCircle className="w-3 h-3" /> Via WhatsApp
          </div>
        </div>
      </div>

      {/* Gallery Dialog */}
      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-stone-800 flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-[#1F4D3A]" />
              Fotos do espaço
            </DialogTitle>
            <DialogDescription className="text-stone-500">
              Veja nosso espaço por completo no Instagram ou fale conosco no WhatsApp para receber mais fotos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <a
              href="https://www.instagram.com/espacolamonie"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 w-full rounded-2xl border-2 border-stone-100 hover:border-pink-300 hover:bg-pink-50/30 px-4 py-3.5 transition-all"
            >
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center shrink-0">
                <Instagram className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-stone-800">Galeria no Instagram</p>
                <p className="text-[11px] text-stone-500">@espacolamonie · 120+ publicações</p>
              </div>
              <ExternalLink className="w-4 h-4 text-stone-400 shrink-0" />
            </a>

            <button
              onClick={() => { handleWhatsAppMoreInfo(); setGalleryOpen(false); }}
              className="flex items-center gap-3 w-full rounded-2xl border-2 border-stone-100 hover:border-[#25D366] hover:bg-emerald-50/30 px-4 py-3.5 transition-all"
            >
              <div className="w-11 h-11 rounded-xl bg-[#25D366] flex items-center justify-center shrink-0">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-bold text-stone-800">Pedir fotos no WhatsApp</p>
                <p className="text-[11px] text-stone-500">Enviaremos imagens e tiraremos suas dúvidas</p>
              </div>
              <ExternalLink className="w-4 h-4 text-stone-400 shrink-0" />
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Floating WhatsApp button */}
      <a
        href="https://wa.me/5531997111502?text=Ol%C3%A1!%20Gostaria%20de%20tirar%20uma%20d%C3%BAvida%20sobre%20o%20Espa%C3%A7o%20Lamoni%C3%AA."
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-5 right-5 z-30 flex items-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white px-4 py-3 rounded-full shadow-lg shadow-emerald-500/30 transition-all hover:scale-105 active:scale-95 text-sm font-semibold"
      >
        <MessageCircle className="w-5 h-5" />
        <span className="hidden sm:inline">Tirar dúvidas</span>
      </a>
    </div>
  );
}
