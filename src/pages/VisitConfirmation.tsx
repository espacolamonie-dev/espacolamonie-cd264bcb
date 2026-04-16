import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Check, MapPin, CalendarPlus, Navigation, ExternalLink, CalendarDays, Clock, Route } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import RescheduleVisitModal from "@/components/RescheduleVisitModal";

// Espaço Lamoniê coordinates - R. Cascadura, 380 - Botafogo (Justinópolis), Ribeirão das Neves - MG
const DEST_LAT = -19.7925565;
const DEST_LNG = -44.0099977;

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimateTime(distKm: number) {
  const mins = Math.round(distKm / 0.6); // ~36km/h avg urban
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

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
  const [justConfirmed, setJustConfirmed] = useState(false);
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [showReschedule, setShowReschedule] = useState(false);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [travelTime, setTravelTime] = useState<string>("");
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "done" | "denied">("idle");

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

  // Geolocation for travel time
  useEffect(() => {
    if (!confirmed) return;
    setGeoStatus("loading");
    if (!navigator.geolocation) {
      setGeoStatus("denied");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const km = haversineDistance(pos.coords.latitude, pos.coords.longitude, DEST_LAT, DEST_LNG);
        setDistanceKm(Math.round(km * 10) / 10);
        setTravelTime(estimateTime(km));
        setGeoStatus("done");
      },
      () => setGeoStatus("denied"),
      { timeout: 10000 }
    );
  }, [confirmed]);

  const handleConfirm = async () => {
    if (!visit || confirming) return;
    setConfirming(true);
    setActionError("");
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        keepalive: true,
        body: JSON.stringify({
          action: "confirm-visit-public",
          visit_id: visit.id,
          confirmation_token: visit.confirmation_token,
        }),
      });

      const result = await res.json().catch(() => ({}));

      if (!res.ok || result?.ok === false) {
        throw new Error(result?.error || "Não foi possível confirmar a visita.");
      }

      const confirmedAt = result?.confirmed_at || new Date().toISOString();
      setVisit((current) => current ? { ...current, status: "Confirmada", confirmed_at: confirmedAt } : current);

      setJustConfirmed(true);

      // Show celebration then transition
      setTimeout(() => {
        setConfirmed(true);
        setTimeout(() => setJustConfirmed(false), 600);
      }, 2000);
    } catch (err) {
      console.error("visit confirmation failed:", err);
      setActionError("Não foi possível confirmar agora. Tente novamente.");
    } finally {
      setConfirming(false);
    }
  };

  const generateICS = () => {
    if (!visit) return;
    const dtStart = `${visit.visit_date.replace(/-/g, "")}T${visit.visit_time.replace(/:/g, "").slice(0, 4)}00`;
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
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !visit) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4 animate-fade-in">
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

  // Celebration overlay
  if (justConfirmed && !confirmed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center space-y-4 animate-scale-in">
          <div
            className="mx-auto w-20 h-20 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center"
            style={{ animation: "pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards" }}
          >
            <Check size={40} className="text-green-600" />
          </div>
          <p className="text-xl font-bold text-green-700 dark:text-green-400 animate-fade-in" style={{ animationDelay: "0.3s", animationFillMode: "both" }}>
            Visita confirmada com sucesso! 🎉
          </p>
          <p className="text-sm text-muted-foreground animate-fade-in" style={{ animationDelay: "0.6s", animationFillMode: "both" }}>
            Preparando detalhes...
          </p>
        </div>
        <style>{`
          @keyframes pop {
            0% { transform: scale(0); opacity: 0; }
            50% { transform: scale(1.15); }
            100% { transform: scale(1); opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-start justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2 animate-fade-in">
          <h1 className="text-2xl font-bold tracking-tight">Espaço Lamoniê</h1>
          <p className="text-muted-foreground text-sm">Confirmação de Visita</p>
        </div>

        {/* Client Info */}
        <div
          className="rounded-2xl border bg-card p-5 space-y-4 shadow-sm animate-fade-in"
          style={{ animationDelay: "100ms", animationFillMode: "both" }}
        >
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

            {confirmed && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Status</span>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-600 dark:text-green-400">
                  <Check size={14} />
                  Confirmada
                </span>
              </div>
            )}
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

        {/* Actions */}
        {!confirmed ? (
          <div
            className="space-y-3 animate-fade-in"
            style={{ animationDelay: "200ms", animationFillMode: "both" }}
          >
            <Button
              onClick={handleConfirm}
              disabled={confirming}
              className="w-full h-14 text-base font-bold rounded-2xl gap-2 shadow-lg shadow-primary/20 transition-all duration-150 active:scale-[0.97] hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/30"
              size="lg"
            >
              <Check size={20} />
              {confirming ? "Confirmando..." : "Confirmar visita"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowReschedule(true)}
              className="w-full h-14 text-base font-semibold rounded-2xl gap-2 transition-all duration-150 active:scale-[0.97] hover:scale-[1.02]"
              size="lg"
            >
              <CalendarDays size={20} />
              Reagendar visita
            </Button>
            {actionError && (
              <p className="text-sm text-center text-destructive" role="alert">
                {actionError}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Success banner */}
            <div
              className="rounded-2xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-5 text-center space-y-2 animate-fade-in"
              style={{ animationDelay: "0ms", animationFillMode: "both" }}
            >
              <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <Check size={24} className="text-green-600" />
              </div>
              <p className="text-lg font-bold text-green-700 dark:text-green-400">Visita Confirmada!</p>
              <p className="text-sm text-green-600 dark:text-green-500">Obrigado pela confirmação. Nos vemos em breve!</p>
            </div>

            {/* Map Section — Airbnb style */}
            <div
              className="rounded-2xl border bg-card shadow-sm animate-fade-in overflow-hidden"
              style={{ animationDelay: "100ms", animationFillMode: "both" }}
            >
              {/* Title */}
              <div className="px-5 pt-5 pb-2">
                <h2 className="text-base font-bold">Onde você estará</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Espaço Lamoniê — Ribeirão das Neves, MG</p>
              </div>

              {/* Map iframe - usando o embed oficial do Espaço Lamoniê */}
              <div className="relative w-full h-[240px]">
                <iframe
                  title="Mapa Espaço Lamoniê"
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3749.5!2d-44.01!3d-19.7926!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xa68f59ef5f5b1d%3A0x4d97bdc51aceaa15!2sEspa%C3%A7o%20Lamoni%C3%AA!5e0!3m2!1spt-BR!2sbr!4v1"
                  className="w-full h-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
                {/* Sem ícone customizado - usando o pin padrão do Google Maps */}
              </div>

              {/* Address + travel info */}
              <div className="px-5 py-4 space-y-3">
                <p className="text-sm font-medium">R. Cascadura, 380 - Botafogo (Justinópolis), Ribeirão das Neves - MG, 33933-440</p>

                {/* Travel time */}
                <div className="rounded-xl bg-muted/50 p-3 flex items-center gap-3">
                  {geoStatus === "loading" && (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      <span className="text-sm text-muted-foreground">Calculando distância...</span>
                    </>
                  )}
                  {geoStatus === "done" && distanceKm !== null && (
                    <>
                      <Route size={16} className="text-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{distanceKm} km — ~{travelTime}</p>
                        <p className="text-xs text-muted-foreground">
                          {distanceKm <= 5 ? "Você está pertinho! 🎉" : "Tempo estimado de carro"}
                        </p>
                      </div>
                      <Clock size={14} className="text-muted-foreground flex-shrink-0" />
                    </>
                  )}
                  {geoStatus === "denied" && (
                    <>
                      <MapPin size={16} className="text-muted-foreground flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">📍 Veja a rota no mapa acima</span>
                    </>
                  )}
                </div>

                {/* Nav buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    className="h-12 gap-2 rounded-xl text-sm font-semibold bg-[#34A853] hover:bg-[#2d9249] text-white transition-all duration-150 active:scale-[0.97]"
                    onClick={() => window.open(mapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Espaço Lamoniê Rua Cascadura 380 Ribeirão das Neves MG")}`, "_blank")}
                  >
                    <Navigation size={18} />
                    Google Maps
                  </Button>
                  <Button
                    className="h-12 gap-2 rounded-xl text-sm font-semibold bg-[#33CCFF] hover:bg-[#2bb8e8] text-white transition-all duration-150 active:scale-[0.97]"
                    onClick={() => window.open(wazeUrl || `https://waze.com/ul?q=${encodeURIComponent("Espaço Lamoniê Rua Cascadura 380 Ribeirão das Neves MG")}`, "_blank")}
                  >
                    <ExternalLink size={18} />
                    Waze
                  </Button>
                </div>
              </div>
            </div>

            {/* Calendar button */}
            <Button
              variant="outline"
              className="w-full h-14 text-base font-semibold rounded-2xl gap-2 animate-fade-in transition-all duration-150 active:scale-[0.97] hover:scale-[1.02]"
              style={{ animationDelay: "200ms", animationFillMode: "both" }}
              onClick={generateICS}
            >
              <CalendarPlus size={20} />
              Adicionar à agenda
            </Button>

            {/* Reschedule button */}
            <Button
              variant="outline"
              onClick={() => setShowReschedule(true)}
              className="w-full h-14 text-base font-semibold rounded-2xl gap-2 animate-fade-in transition-all duration-150 active:scale-[0.97] hover:scale-[1.02]"
              style={{ animationDelay: "300ms", animationFillMode: "both" }}
              size="lg"
            >
              <CalendarDays size={20} />
              Reagendar visita
            </Button>
          </div>
        )}

        <p
          className="text-center text-xs text-muted-foreground pt-4 animate-fade-in"
          style={{ animationDelay: "400ms", animationFillMode: "both" }}
        >
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
