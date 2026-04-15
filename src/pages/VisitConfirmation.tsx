import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Check, MapPin, CalendarPlus, Navigation, ExternalLink, CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import RescheduleVisitModal from "@/components/RescheduleVisitModal";

interface VisitData {
  id: string;
  client_name: string;
  visit_date: string;
  visit_time: string;
  interest_event_date: string | null;
  event_type_desired: string;
  event_value: number;
  deposit_percent: number;
  guest_count: number;
  status: string;
  confirmation_token: string;
  confirmed_at: string | null;
  confirmation_slug: string;
  user_id: string;
}

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function VisitConfirmation() {
  const { slug } = useParams<{ slug: string }>();
  const [visit, setVisit] = useState<VisitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [showReschedule, setShowReschedule] = useState(false);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const { data, error: err } = await (supabase.from("visits" as any) as any)
          .select("*")
          .eq("confirmation_slug", slug)
          .single();
        if (err || !data) {
          setError("Visita não encontrada.");
          return;
        }
        setVisit(data);
        setConfirmed(!!data.confirmed_at || data.status === "Confirmada");

        // Fetch company address
        const { data: settings } = await supabase
          .from("company_settings")
          .select("address")
          .eq("user_id", data.user_id)
          .maybeSingle();
        if (settings?.address) setAddress(settings.address);
      } catch {
        setError("Erro ao carregar dados.");
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const handleConfirm = async () => {
    if (!visit) return;
    setConfirming(true);
    try {
      await (supabase.from("visits" as any) as any)
        .update({
          status: "Confirmada",
          confirmed_at: new Date().toISOString(),
        })
        .eq("id", visit.id)
        .eq("confirmation_token", visit.confirmation_token);
      setConfirmed(true);

      // Send push notification to admin
      const timeFmt = visit.visit_time.slice(0, 5);
      const dateFmt = visit.visit_date.split("-").reverse().join("/");
      try {
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-push`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            action: "send-notification",
            title: "✅ Visita Confirmada!",
            body: `${visit.client_name} confirmou a visita para ${dateFmt} às ${timeFmt}h.`,
            url: "/visits",
            tag: `visit-confirmed-${visit.id}`,
          }),
        });
      } catch {}
    } catch {
      // silent
    } finally {
      setConfirming(false);
    }
  };

  const generateICS = () => {
    if (!visit) return;
    const dtStart = `${visit.visit_date.replace(/-/g, "")}T${visit.visit_time.replace(/:/g, "").slice(0, 4)}00`;
    // Assume 1h duration
    const startH = parseInt(visit.visit_time.slice(0, 2));
    const endH = String(startH + 1).padStart(2, "0");
    const dtEnd = `${visit.visit_date.replace(/-/g, "")}T${endH}${visit.visit_time.slice(3, 5)}00`;

    let description = `Visita ao Espaço Lamoniê`;
    if (visit.event_type_desired) description += `\\nEvento: ${visit.event_type_desired}`;
    if (visit.event_value > 0) description += `\\nValor: ${formatCurrency(visit.event_value)}`;
    if (visit.deposit_percent > 0) description += `\\nSinal: ${visit.deposit_percent}%`;

    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Espaço Lamoniê//CRM//PT",
      "BEGIN:VEVENT",
      `DTSTART;TZID=America/Sao_Paulo:${dtStart}`,
      `DTEND;TZID=America/Sao_Paulo:${dtEnd}`,
      `SUMMARY:Visita Espaço Lamoniê`,
      `DESCRIPTION:${description}`,
      address ? `LOCATION:${address}` : "",
      `STATUS:CONFIRMED`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].filter(Boolean).join("\r\n");

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "visita-espaco-lamonie.ics";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !visit) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-3">
          <p className="text-lg font-semibold text-destructive">{error || "Visita não encontrada"}</p>
          <p className="text-sm text-muted-foreground">Verifique o link e tente novamente.</p>
        </div>
      </div>
    );
  }

  const visitDateFmt = format(new Date(visit.visit_date + "T12:00:00"), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const timeFmt = visit.visit_time.slice(0, 5);
  const depositValue = visit.event_value > 0 && visit.deposit_percent > 0
    ? visit.event_value * visit.deposit_percent / 100
    : 0;

  const mapsUrl = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : "";
  const wazeUrl = address
    ? `https://waze.com/ul?q=${encodeURIComponent(address)}`
    : "";

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-start justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Espaço Lamoniê</h1>
          <p className="text-muted-foreground text-sm">Confirmação de Visita</p>
        </div>

        {/* Client Info */}
        <div className="rounded-2xl border bg-card p-5 space-y-4 shadow-sm">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Cliente</p>
            <p className="text-lg font-semibold">{visit.client_name}</p>
          </div>

          <div className="h-px bg-border" />

          <div className="space-y-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Detalhes da Visita</p>

            {visit.event_type_desired && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Tipo de evento</span>
                <span className="text-sm font-medium">{visit.event_type_desired}</span>
              </div>
            )}

            {visit.interest_event_date && (
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Data de interesse</span>
                <span className="text-sm font-medium">
                  {format(new Date(visit.interest_event_date + "T12:00:00"), "dd/MM/yyyy")}
                </span>
              </div>
            )}

            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Data da visita</span>
              <span className="text-sm font-semibold">{visitDateFmt}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Horário</span>
              <span className="text-sm font-semibold">{timeFmt}</span>
            </div>
          </div>

          {(visit.event_value > 0 || depositValue > 0) && (
            <>
              <div className="h-px bg-border" />
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Valores</p>
                {visit.event_value > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Valor do espaço</span>
                    <span className="text-sm font-bold">{formatCurrency(visit.event_value)}</span>
                  </div>
                )}
                {depositValue > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Valor do sinal ({visit.deposit_percent}%)</span>
                    <span className="text-sm font-bold text-primary">{formatCurrency(depositValue)}</span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Confirm / Confirmed */}
        {!confirmed ? (
          <div className="space-y-3">
            <Button
              onClick={handleConfirm}
              disabled={confirming}
              className="w-full h-14 text-base font-bold rounded-2xl gap-2"
              size="lg"
            >
              <Check size={20} />
              {confirming ? "Confirmando..." : "Confirmar visita"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowReschedule(true)}
              className="w-full h-14 text-base font-semibold rounded-2xl gap-2"
              size="lg"
            >
              <CalendarDays size={20} />
              Reagendar visita
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-5 text-center space-y-2">
              <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <Check size={24} className="text-green-600" />
              </div>
              <p className="text-lg font-bold text-green-700 dark:text-green-400">Visita Confirmada!</p>
              <p className="text-sm text-green-600 dark:text-green-500">Obrigado pela confirmação. Nos vemos em breve!</p>
            </div>

            {/* Address */}
            {address && (
              <div className="rounded-2xl border bg-card p-5 space-y-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <MapPin size={16} className="text-primary" />
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Endereço</p>
                </div>
                <p className="text-sm font-medium">{address}</p>
                <div className="grid grid-cols-2 gap-2">
                  {mapsUrl && (
                    <Button
                      variant="outline"
                      className="h-12 gap-2 rounded-xl"
                      onClick={() => window.open(mapsUrl, "_blank")}
                    >
                      <Navigation size={16} />
                      Google Maps
                    </Button>
                  )}
                  {wazeUrl && (
                    <Button
                      variant="outline"
                      className="h-12 gap-2 rounded-xl"
                      onClick={() => window.open(wazeUrl, "_blank")}
                    >
                      <ExternalLink size={16} />
                      Waze
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Add to Calendar */}
            <Button
              variant="outline"
              className="w-full h-14 text-base font-semibold rounded-2xl gap-2"
              onClick={generateICS}
            >
              <CalendarPlus size={20} />
              Adicionar à agenda
            </Button>
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground pt-4">
          Espaço Lamoniê © {new Date().getFullYear()}
        </p>
      </div>

      {visit && (
        <RescheduleVisitModal
          open={showReschedule}
          onClose={() => setShowReschedule(false)}
          visitId={visit.id}
          confirmationToken={visit.confirmation_token}
          clientName={visit.client_name}
          onSuccess={(newDate, newTime) => {
            setVisit({ ...visit, visit_date: newDate, visit_time: newTime, confirmed_at: null, status: "Agendada" });
            setConfirmed(false);
            setShowReschedule(false);
          }}
        />
      )}
    </div>
  );
}
