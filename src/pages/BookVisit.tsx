import { useState, useEffect, useCallback } from "react";
import { format, addDays, startOfDay, isAfter, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CalendarDays, Clock, CheckCircle2, Users, Phone, User, Loader2 } from "lucide-react";

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

  // Only allow Tuesdays and Thursdays, future dates
  const isDateDisabled = useCallback((date: Date) => {
    const today = startOfDay(new Date());
    if (isBefore(date, today)) return true;
    const day = date.getDay();
    return day !== 2 && day !== 4; // Only Tue & Thu
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
      // If slot became unavailable, refresh slots
      if (e.message?.includes("indisponível")) {
        fetchSlots(selectedDate!);
        setSelectedTime(null);
        setStep("time");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-50 via-amber-50/30 to-stone-100">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center gap-3">
          <img src="/images/logo-lamonie.png" alt="Lamoniê" className="h-10 w-10 rounded-xl object-cover" />
          <div>
            <h1 className="text-lg font-bold text-stone-800">Espaço Lamoniê</h1>
            <p className="text-xs text-stone-500">Agende sua visita</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Success state */}
        {step === "success" && confirmData && (
          <div className="bg-white rounded-2xl shadow-lg border border-emerald-200 p-8 text-center space-y-4 animate-in fade-in duration-500">
            <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-bold text-stone-800">Visita agendada com sucesso!</h2>
            <div className="bg-stone-50 rounded-xl p-4 space-y-2 text-left">
              <div className="flex items-center gap-2 text-stone-700">
                <User className="w-4 h-4 text-stone-400" />
                <span className="font-medium">{confirmData.clientName}</span>
              </div>
              <div className="flex items-center gap-2 text-stone-700">
                <CalendarDays className="w-4 h-4 text-stone-400" />
                <span>{format(new Date(confirmData.visitDate + "T12:00:00"), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</span>
              </div>
              <div className="flex items-center gap-2 text-stone-700">
                <Clock className="w-4 h-4 text-stone-400" />
                <span>{confirmData.visitTime}h</span>
              </div>
            </div>
            <p className="text-sm text-stone-500">Aguardamos você! Em caso de dúvidas, entre em contato conosco.</p>
            <a
              href="https://wa.me/5500000000000"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-emerald-700 transition-colors"
            >
              Falar pelo WhatsApp
            </a>
          </div>
        )}

        {step !== "success" && (
          <>
            {/* Progress */}
            <div className="flex items-center gap-2 justify-center">
              {["date", "time", "form"].map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all",
                    step === s ? "bg-amber-600 text-white shadow-md" :
                    ["date", "time", "form"].indexOf(step) > i ? "bg-emerald-500 text-white" :
                    "bg-stone-200 text-stone-500"
                  )}>
                    {i + 1}
                  </div>
                  {i < 2 && <div className={cn("w-8 h-0.5", ["date", "time", "form"].indexOf(step) > i ? "bg-emerald-400" : "bg-stone-200")} />}
                </div>
              ))}
            </div>

            {/* Step 1: Date */}
            {step === "date" && (
              <div className="bg-white rounded-2xl shadow-lg border border-stone-200 p-6 space-y-4 animate-in fade-in duration-300">
                <div className="text-center">
                  <h2 className="text-xl font-bold text-stone-800">Escolha a data da visita</h2>
                  <p className="text-sm text-stone-500 mt-1">Visitas disponíveis às <strong>terças</strong> e <strong>quintas-feiras</strong></p>
                </div>
                <div className="flex justify-center">
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
              <div className="bg-white rounded-2xl shadow-lg border border-stone-200 p-6 space-y-4 animate-in fade-in duration-300">
                <div className="text-center">
                  <h2 className="text-xl font-bold text-stone-800">Escolha o horário</h2>
                  {selectedDate && (
                    <p className="text-sm text-stone-500 mt-1">
                      {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                    </p>
                  )}
                </div>

                {loadingSlots ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
                    <span className="ml-2 text-stone-500">Verificando disponibilidade...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {slots.map(slot => (
                      <button
                        key={slot.time}
                        disabled={!slot.available}
                        onClick={() => setSelectedTime(slot.time)}
                        className={cn(
                          "py-3 px-2 rounded-xl text-sm font-medium transition-all border",
                          slot.available
                            ? selectedTime === slot.time
                              ? "bg-amber-600 text-white border-amber-600 shadow-md"
                              : "bg-white text-stone-700 border-stone-200 hover:border-amber-400 hover:bg-amber-50"
                            : "bg-stone-100 text-stone-400 border-stone-100 cursor-not-allowed line-through"
                        )}
                      >
                        {slot.time}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={() => { setStep("date"); setSelectedDate(undefined); }} className="flex-1">
                    Voltar
                  </Button>
                  <Button
                    onClick={() => selectedTime && setStep("form")}
                    disabled={!selectedTime}
                    className="flex-1 bg-amber-600 hover:bg-amber-700"
                  >
                    Continuar
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Form */}
            {step === "form" && (
              <div className="bg-white rounded-2xl shadow-lg border border-stone-200 p-6 space-y-4 animate-in fade-in duration-300">
                <div className="text-center">
                  <h2 className="text-xl font-bold text-stone-800">Seus dados</h2>
                  <p className="text-sm text-stone-500 mt-1">
                    {selectedDate && format(selectedDate, "dd/MM/yyyy", { locale: ptBR })} às {selectedTime}h
                  </p>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>
                )}

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="name">Nome completo *</Label>
                    <div className="relative mt-1">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                      <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Seu nome completo" className="pl-10" />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="phone">Telefone *</Label>
                    <div className="relative mt-1">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                      <Input id="phone" value={phone} onChange={e => setPhone(phoneMask(e.target.value))} placeholder="(00) 00000-0000" className="pl-10" />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="interestDate">Data de interesse do evento</Label>
                    <Input id="interestDate" type="date" value={interestDate} onChange={e => setInterestDate(e.target.value)} className="mt-1" />
                  </div>

                  <div>
                    <Label htmlFor="guests">Quantidade de pessoas</Label>
                    <div className="relative mt-1">
                      <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                      <Input id="guests" type="number" min="1" value={guestCount} onChange={e => setGuestCount(e.target.value)} placeholder="Ex: 100" className="pl-10" />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="notes">Observações</Label>
                    <Textarea id="notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Alguma informação adicional?" className="mt-1" rows={3} />
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={() => setStep("time")} className="flex-1">
                    Voltar
                  </Button>
                  <Button onClick={handleSubmit} disabled={submitting} className="flex-1 bg-amber-600 hover:bg-amber-700">
                    {submitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Agendando...</> : "Confirmar agendamento"}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
