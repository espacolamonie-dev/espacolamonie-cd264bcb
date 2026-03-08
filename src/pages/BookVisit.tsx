import { useState, useEffect, useCallback } from "react";
import { format, startOfDay, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CalendarDays, Clock, CheckCircle2, Users, Phone, User, Loader2, MapPin, Sparkles, ChevronRight, CalendarHeart } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

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

function phoneMask(v: string): string {
  const digits = v.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

interface Slot {
  time: string;
  available: boolean;
}

const STEPS = ["date", "time", "form"] as const;
const STEP_LABELS = ["Data", "Horário", "Dados"];

export default function BookVisit() {
  const [step, setStep] = useState<"date" | "time" | "form" | "success">("date");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [interestDate, setInterestDate] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [confirmData, setConfirmData] = useState<{ clientName: string; visitDate: string; visitTime: string } | null>(null);

  const isDateDisabled = useCallback((date: Date) => {
    const today = startOfDay(new Date());
    if (isBefore(date, today)) return true;
    const day = date.getDay();
    return day !== 2 && day !== 4;
  }, []);

  const fetchSlots = useCallback(async (date: Date) => {
    setLoadingSlots(true);
    setSlots([]);
    setSelectedTime(null);
    try {
      const dateStr = format(date, "yyyy-MM-dd");
      const data = await callBooking("get-available-slots", { date: dateStr });
      setSlots(data.slots || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingSlots(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDate) {
      fetchSlots(selectedDate);
      setStep("time");
    }
  }, [selectedDate, fetchSlots]);

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim() || !selectedDate || !selectedTime) {
      setError("Preencha todos os campos obrigatórios");
      return;
    }
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 10) {
      setError("Telefone inválido");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const data = await callBooking("book-visit", {
        clientName: name.trim(),
        clientPhone: phone.trim(),
        interestEventDate: interestDate || null,
        guestCount: guestCount ? parseInt(guestCount) : 0,
        visitDate: format(selectedDate!, "yyyy-MM-dd"),
        visitTime: selectedTime,
        notes: notes.trim(),
      });
      setConfirmData(data.visit);
      setStep("success");
    } catch (e: any) {
      setError(e.message);
      if (e.message?.includes("indisponível")) {
        fetchSlots(selectedDate!);
        setSelectedTime(null);
        setStep("time");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const currentStepIdx = STEPS.indexOf(step as any);

  return (
    <div className="min-h-screen bg-[#FAF9F7]">
      {/* Decorative top gradient */}
      <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-[#1F4D3A]/5 to-transparent pointer-events-none" />

      {/* Header */}
      <header className="relative bg-white/90 backdrop-blur-md border-b border-stone-100 sticky top-0 z-20">
        <div className="max-w-md mx-auto px-5 py-4 flex items-center gap-3.5">
          <img src="/images/logo-lamonie.png" alt="Lamoniê" className="h-11 w-11 rounded-2xl object-cover shadow-sm ring-1 ring-stone-100" />
          <div>
            <h1 className="text-base font-bold tracking-tight text-[#1F4D3A]">Espaço Lamoniê</h1>
            <p className="text-[11px] text-stone-400 font-medium tracking-wide uppercase">Agende sua visita</p>
          </div>
        </div>
      </header>

      <div className="relative max-w-md mx-auto px-5 pt-6 pb-10 space-y-5">

        {/* Success */}
        {step === "success" && confirmData && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white rounded-3xl shadow-xl shadow-emerald-500/5 border border-emerald-100 overflow-hidden">
              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 px-6 pt-8 pb-6 text-center">
                <div className="mx-auto w-16 h-16 bg-white rounded-2xl shadow-lg shadow-emerald-200/50 flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                </div>
                <h2 className="text-xl font-bold text-stone-800">Visita confirmada!</h2>
                <p className="text-sm text-stone-500 mt-1">Tudo certo, esperamos você</p>
              </div>
              <div className="px-6 py-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-stone-50 flex items-center justify-center"><User className="w-4 h-4 text-[#1F4D3A]" /></div>
                  <span className="text-sm font-semibold text-stone-800">{confirmData.clientName}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-stone-50 flex items-center justify-center"><CalendarDays className="w-4 h-4 text-[#1F4D3A]" /></div>
                  <span className="text-sm text-stone-600 capitalize">{format(new Date(confirmData.visitDate + "T12:00:00"), "EEEE, dd 'de' MMMM", { locale: ptBR })}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-stone-50 flex items-center justify-center"><Clock className="w-4 h-4 text-[#1F4D3A]" /></div>
                  <span className="text-sm text-stone-600">{confirmData.visitTime}h</span>
                </div>
              </div>
            </div>
            <a
              href="https://wa.me/5500000000000"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full bg-[#25D366] text-white py-3.5 rounded-2xl font-semibold text-sm shadow-lg shadow-emerald-500/20 hover:brightness-105 transition-all active:scale-[0.98]"
            >
              Falar pelo WhatsApp
            </a>
          </div>
        )}

        {step !== "success" && (
          <>
            {/* Hero banner */}
            <div className="bg-gradient-to-br from-[#1F4D3A] to-[#2a6b50] rounded-3xl p-5 text-white relative overflow-hidden">
              <div className="absolute -right-6 -top-6 w-28 h-28 bg-white/5 rounded-full" />
              <div className="absolute -right-2 -bottom-8 w-20 h-20 bg-white/5 rounded-full" />
              <div className="relative">
                <div className="flex items-center gap-1.5 text-emerald-200 text-[11px] font-semibold uppercase tracking-wider mb-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  Agendamento online
                </div>
                <h2 className="text-lg font-bold leading-snug">Conheça nosso espaço pessoalmente</h2>
                <p className="text-emerald-100/80 text-xs mt-1.5 leading-relaxed">
                  Visitas às terças e quintas, das 9h às 20h. Escolha o melhor horário para você.
                </p>
              </div>
            </div>

            {/* Progress */}
            <div className="flex items-center gap-1 bg-white rounded-2xl p-2 shadow-sm border border-stone-100">
              {STEPS.map((s, i) => (
                <div key={s} className="flex-1 relative">
                  <button
                    onClick={() => {
                      if (i < currentStepIdx) {
                        if (i === 0) { setStep("date"); setSelectedDate(undefined); }
                        if (i === 1) setStep("time");
                      }
                    }}
                    className={cn(
                      "w-full py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5",
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
              <div className="bg-white rounded-3xl shadow-sm border border-stone-100 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="px-5 pt-5 pb-2 text-center">
                  <h2 className="text-base font-bold text-stone-800">Qual dia prefere visitar?</h2>
                  <p className="text-xs text-stone-400 mt-0.5">Selecione uma terça ou quinta-feira</p>
                </div>
                <div className="flex justify-center px-2 pb-4">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    disabled={isDateDisabled}
                    locale={ptBR}
                    className="p-3 pointer-events-auto"
                    fromDate={new Date()}
                  />
                </div>
              </div>
            )}

            {/* Step 2: Time */}
            {step === "time" && (
              <div className="bg-white rounded-3xl shadow-sm border border-stone-100 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="px-5 pt-5 pb-3">
                  <h2 className="text-base font-bold text-stone-800 text-center">Escolha o horário</h2>
                  {selectedDate && (
                    <p className="text-xs text-stone-400 mt-0.5 text-center capitalize">
                      {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                    </p>
                  )}
                </div>

                <div className="px-5 pb-5">
                  {loadingSlots ? (
                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-[#1F4D3A]" />
                      <span className="text-xs text-stone-400">Verificando disponibilidade...</span>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        {slots.map(slot => (
                          <button
                            key={slot.time}
                            disabled={!slot.available}
                            onClick={() => setSelectedTime(slot.time)}
                            className={cn(
                              "relative py-3 rounded-xl text-sm font-semibold transition-all border-2",
                              slot.available
                                ? selectedTime === slot.time
                                  ? "bg-[#1F4D3A] text-white border-[#1F4D3A] shadow-md shadow-emerald-900/10"
                                  : "bg-white text-stone-700 border-stone-100 hover:border-[#1F4D3A]/30 hover:bg-emerald-50/50 active:scale-[0.97]"
                                : "bg-stone-50 text-stone-300 border-transparent cursor-not-allowed"
                            )}
                          >
                            {slot.time}
                            {!slot.available && <span className="absolute inset-0 flex items-center justify-center"><span className="w-8 h-px bg-stone-300 rotate-[-20deg]" /></span>}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center gap-4 mt-3 px-1">
                        <div className="flex items-center gap-1.5 text-[10px] text-stone-400">
                          <span className="w-2.5 h-2.5 rounded-full bg-white border-2 border-stone-200" /> Disponível
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-stone-400">
                          <span className="w-2.5 h-2.5 rounded-full bg-stone-200" /> Ocupado
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-stone-400">
                          <span className="w-2.5 h-2.5 rounded-full bg-[#1F4D3A]" /> Selecionado
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex gap-2.5 px-5 pb-5">
                  <Button variant="outline" onClick={() => { setStep("date"); setSelectedDate(undefined); }} className="flex-1 rounded-xl h-11">
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

            {/* Step 3: Form */}
            {step === "form" && (
              <div className="bg-white rounded-3xl shadow-sm border border-stone-100 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
                {/* Summary badge */}
                <div className="mx-5 mt-5 mb-4 flex items-center gap-3 bg-emerald-50/70 rounded-xl px-4 py-2.5 border border-emerald-100">
                  <CalendarHeart className="w-5 h-5 text-[#1F4D3A] shrink-0" />
                  <div className="text-xs">
                    <span className="font-semibold text-stone-700 capitalize">
                      {selectedDate && format(selectedDate, "EEEE, dd/MM", { locale: ptBR })}
                    </span>
                    <span className="text-stone-400 mx-1.5">•</span>
                    <span className="font-semibold text-[#1F4D3A]">{selectedTime}h</span>
                  </div>
                </div>

                {error && (
                  <div className="mx-5 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5 text-sm text-red-600 font-medium">{error}</div>
                )}

                <div className="px-5 pb-5 space-y-3.5">
                  <div>
                    <Label htmlFor="name" className="text-xs font-semibold text-stone-600">Nome completo *</Label>
                    <div className="relative mt-1.5">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300" />
                      <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome completo" className="pl-10 h-11 rounded-xl bg-stone-50/50 border-stone-200 focus:bg-white" />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="phone" className="text-xs font-semibold text-stone-600">Telefone *</Label>
                    <div className="relative mt-1.5">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300" />
                      <Input id="phone" value={phone} onChange={e => setPhone(phoneMask(e.target.value))} placeholder="(00) 00000-0000" className="pl-10 h-11 rounded-xl bg-stone-50/50 border-stone-200 focus:bg-white" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="interestDate" className="text-xs font-semibold text-stone-600">Data do evento</Label>
                      <div className="relative mt-1.5">
                        <CalendarDays className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300" />
                        <Input id="interestDate" type="date" value={interestDate} onChange={e => setInterestDate(e.target.value)} className="pl-10 h-11 rounded-xl bg-stone-50/50 border-stone-200 focus:bg-white text-sm" />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="guests" className="text-xs font-semibold text-stone-600">Nº de pessoas</Label>
                      <div className="relative mt-1.5">
                        <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300" />
                        <Input id="guests" type="number" min="1" value={guestCount} onChange={e => setGuestCount(e.target.value)} placeholder="Ex: 100" className="pl-10 h-11 rounded-xl bg-stone-50/50 border-stone-200 focus:bg-white" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="notes" className="text-xs font-semibold text-stone-600">Observações</Label>
                    <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Tipo de evento, preferências..." className="mt-1.5 rounded-xl bg-stone-50/50 border-stone-200 focus:bg-white resize-none" rows={2} />
                  </div>
                </div>

                <div className="flex gap-2.5 px-5 pb-5">
                  <Button variant="outline" onClick={() => setStep("time")} className="flex-1 rounded-xl h-12">
                    Voltar
                  </Button>
                  <Button onClick={handleSubmit} disabled={submitting} className="flex-1 rounded-xl h-12 bg-[#1F4D3A] hover:bg-[#1a4231] text-white shadow-lg shadow-emerald-900/10 text-sm font-semibold">
                    {submitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Agendando...</> : "Confirmar agendamento"}
                  </Button>
                </div>
              </div>
            )}

            {/* Trust indicators */}
            <div className="flex items-center justify-center gap-4 pt-1 pb-4">
              <div className="flex items-center gap-1.5 text-[10px] text-stone-400">
                <MapPin className="w-3 h-3" /> Presencial
              </div>
              <div className="w-px h-3 bg-stone-200" />
              <div className="flex items-center gap-1.5 text-[10px] text-stone-400">
                <Clock className="w-3 h-3" /> ~1 hora
              </div>
              <div className="w-px h-3 bg-stone-200" />
              <div className="flex items-center gap-1.5 text-[10px] text-stone-400">
                <CheckCircle2 className="w-3 h-3" /> Gratuito
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
