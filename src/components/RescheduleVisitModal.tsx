import { useState, useEffect, useCallback } from "react";
import { format, startOfDay, isBefore } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { CalendarDays, Clock, Loader2, Check } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface Slot {
  time: string;
  available: boolean;
}

interface RescheduleVisitModalProps {
  open: boolean;
  onClose: () => void;
  visitId: string;
  confirmationToken: string;
  clientName: string;
  onSuccess: (newDate: string, newTime: string) => void;
}

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

export default function RescheduleVisitModal({
  open, onClose, visitId, confirmationToken, clientName, onSuccess,
}: RescheduleVisitModalProps) {
  const [step, setStep] = useState<"date" | "time" | "confirming" | "done">("date");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allowedDays, setAllowedDays] = useState<number[]>([2, 4]);

  // Reset when opening
  useEffect(() => {
    if (open) {
      setStep("date");
      setSelectedDate(undefined);
      setSlots([]);
      setSelectedTime(null);
      setError(null);
    }
  }, [open]);

  // Fetch schedule settings
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/booking_schedule_settings?select=allowed_days&limit=1`, {
          headers: { apikey: SUPABASE_KEY },
        });
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0 && data[0].allowed_days) {
          setAllowedDays(data[0].allowed_days);
        }
      } catch {}
    })();
  }, [open]);

  const isDateDisabled = useCallback((date: Date) => {
    const today = startOfDay(new Date());
    if (isBefore(date, today)) return true;
    return !allowedDays.includes(date.getDay());
  }, [allowedDays]);

  const fetchSlots = useCallback(async (date: Date) => {
    setLoadingSlots(true);
    setSlots([]);
    setSelectedTime(null);
    setError(null);
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

  const handleConfirm = async () => {
    if (!selectedDate || !selectedTime) return;
    setSubmitting(true);
    setError(null);
    try {
      await callBooking("reschedule-visit", {
        visitId,
        confirmationToken,
        newDate: format(selectedDate, "yyyy-MM-dd"),
        newTime: selectedTime,
      });
      setStep("done");
      onSuccess(format(selectedDate, "yyyy-MM-dd"), selectedTime);
    } catch (e: any) {
      setError(e.message);
      if (e.message?.includes("indisponível")) {
        fetchSlots(selectedDate);
        setSelectedTime(null);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const availableSlots = slots.filter(s => s.available);
  const unavailableSlots = slots.filter(s => !s.available);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays size={20} className="text-primary" />
            Reagendar Visita
          </DialogTitle>
          <DialogDescription>
            Escolha uma nova data e horário para sua visita.
          </DialogDescription>
        </DialogHeader>

        {step === "done" ? (
          <div className="text-center space-y-4 py-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <Check size={32} className="text-green-600" />
            </div>
            <p className="text-xl font-bold text-green-700 dark:text-green-400">
              Visita reagendada com sucesso! 🎉
            </p>
            <p className="text-sm text-muted-foreground">
              {clientName}, sua visita foi atualizada.
            </p>
            <Button onClick={onClose} className="w-full h-12 rounded-xl">
              Fechar
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Calendar */}
            <div>
              <p className="text-sm font-medium mb-2 flex items-center gap-2">
                <CalendarDays size={16} className="text-primary" />
                Selecione a nova data
              </p>
              <div className="flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={isDateDisabled}
                  locale={ptBR}
                  className={cn("p-3 pointer-events-auto rounded-xl border")}
                />
              </div>
            </div>

            {/* Time slots */}
            {step === "time" && selectedDate && (
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Clock size={16} className="text-primary" />
                  Horários disponíveis — {format(selectedDate, "dd/MM/yyyy")}
                </p>

                {loadingSlots ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="animate-spin text-primary" size={24} />
                  </div>
                ) : availableSlots.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhum horário disponível nesta data.
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {slots.map(slot => (
                      <Button
                        key={slot.time}
                        variant={selectedTime === slot.time ? "default" : "outline"}
                        disabled={!slot.available}
                        onClick={() => setSelectedTime(slot.time)}
                        className={cn(
                          "h-12 rounded-xl text-sm font-semibold",
                          !slot.available && "opacity-40 line-through"
                        )}
                      >
                        {slot.time}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            {/* Confirm button */}
            {selectedTime && (
              <Button
                onClick={handleConfirm}
                disabled={submitting}
                className="w-full h-14 text-base font-bold rounded-2xl gap-2"
                size="lg"
              >
                {submitting ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <Check size={20} />
                )}
                {submitting ? "Reagendando..." : "Confirmar novo horário"}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
