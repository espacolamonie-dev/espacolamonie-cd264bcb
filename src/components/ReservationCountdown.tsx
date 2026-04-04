import { useState, useEffect } from "react";
import { Clock, AlertTriangle, ShieldCheck } from "lucide-react";

interface Props {
  reservedUntil?: string;
  isGuaranteed?: boolean; // signed + deposit paid
  variant?: "banner" | "compact";
  onExpired?: () => void;
}

export default function ReservationCountdown({ reservedUntil, isGuaranteed, variant = "banner", onExpired }: Props) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [expiredNotified, setExpiredNotified] = useState(false);

  useEffect(() => {
    if (!reservedUntil || isGuaranteed) return;
    const target = new Date(reservedUntil).getTime();

    const tick = () => {
      const diff = target - Date.now();
      const val = diff > 0 ? diff : 0;
      setRemaining(val);
      if (val <= 0 && !expiredNotified && onExpired) {
        setExpiredNotified(true);
        onExpired();
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [reservedUntil, isGuaranteed, expiredNotified, onExpired]);

  if (isGuaranteed) {
    if (variant === "compact") {
      return (
        <div className="flex items-center gap-1.5 text-xs text-success font-medium">
          <ShieldCheck size={14} />
          <span>Data garantida</span>
        </div>
      );
    }
    return (
      <div className="rounded-xl border border-success/30 bg-success/5 p-4 flex items-start gap-3">
        <ShieldCheck size={20} className="text-success shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-success">Data garantida ✓</p>
          <p className="text-xs text-muted-foreground mt-1">
            O contrato foi assinado e o sinal foi pago. Sua reserva está confirmada.
          </p>
        </div>
      </div>
    );
  }

  if (!reservedUntil || remaining === null) return null;

  const expired = remaining <= 0;
  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
  const timeStr = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  const isUrgent = remaining < 4 * 60 * 60 * 1000; // < 4 hours

  if (expired) {
    if (variant === "compact") {
      return (
        <div className="flex items-center gap-1.5 text-xs text-danger font-medium">
          <AlertTriangle size={14} />
          <span>Reserva expirada</span>
        </div>
      );
    }
    return (
      <div className="rounded-xl border border-danger/30 bg-danger/5 p-4 flex items-start gap-3">
        <AlertTriangle size={20} className="text-danger shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-danger">Reserva expirada</p>
          <p className="text-xs text-muted-foreground mt-1">
            O prazo de 24 horas para assinatura e pagamento do sinal expirou.
            A data pode ser liberada para outros interessados.
          </p>
        </div>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={`flex items-center gap-1.5 text-xs font-medium ${isUrgent ? "text-danger" : "text-warning"}`}>
        <Clock size={14} />
        <span className="tabular-nums">{timeStr}</span>
        <span className="text-muted-foreground font-normal">para reserva</span>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-4 flex items-start gap-3 ${isUrgent ? "border-danger/30 bg-danger/5" : "border-warning/30 bg-warning/5"}`}>
      <Clock size={20} className={`shrink-0 mt-0.5 ${isUrgent ? "text-danger" : "text-warning"}`} />
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <p className={`text-sm font-semibold ${isUrgent ? "text-danger" : "text-warning"}`}>
            Reserva temporária
          </p>
          <span className={`font-mono text-lg font-bold tabular-nums ${isUrgent ? "text-danger" : "text-warning"}`}>
            {timeStr}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Esta data está reservada temporariamente para você.
          Finalize a assinatura e o pagamento do sinal em até 24 horas para garantir sua reserva.
          Após esse prazo, a data poderá ser liberada automaticamente para outros interessados.
        </p>
      </div>
    </div>
  );
}
