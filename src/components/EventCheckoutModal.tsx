import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getSafeErrorMessage } from "@/lib/errorSanitizer";
import { Clock, AlertTriangle, CheckCircle, DollarSign, ClipboardCheck, Send } from "lucide-react";
import type { Contract, Client } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: Contract;
  client: Client;
  onCompleted?: () => void;
}

// Fine calculation logic
function calculateFine(delayMinutes: number): number {
  if (delayMinutes <= 15) return 0; // tolerance
  if (delayMinutes <= 30) return 75;
  if (delayMinutes <= 60) return 150;
  // Above 60 min: R$150/hour proportional
  return Math.ceil(delayMinutes / 60) * 150;
}

function parseEndTime(eventTime: string): { hours: number; minutes: number } | null {
  // Formats: "08:00 às 20:00", "08h-20h", "08:00-20:00", "08:00 - 20:00"
  const match = eventTime.match(/(\d{1,2})[h:]?(\d{0,2})\s*(?:às|-|–)\s*(\d{1,2})[h:]?(\d{0,2})/);
  if (!match) return null;
  return { hours: parseInt(match[3], 10), minutes: parseInt(match[4] || "0", 10) };
}

function getDelayMinutes(eventTime: string, checkoutTime: Date, eventDate: string): number {
  const end = parseEndTime(eventTime);
  if (!end) return 0;
  
  const [year, month, day] = eventDate.split("-").map(Number);
  const endDate = new Date(year, month - 1, day, end.hours, end.minutes, 0);
  
  const diff = Math.floor((checkoutTime.getTime() - endDate.getTime()) / (1000 * 60));
  return Math.max(0, diff);
}

function formatDelay(minutes: number): string {
  if (minutes === 0) return "Sem atraso";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m.toString().padStart(2, "0")}`;
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function EventCheckoutModal({ open, onOpenChange, contract, client, onCompleted }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [checkoutTime] = useState(new Date());
  const [checklist, setChecklist] = useState({ clean: false, noDamage: false, trash: false, equipment: false });
  const [observations, setObservations] = useState("");

  // Signatures
  const clientSigRef = useRef<HTMLCanvasElement>(null);
  const staffSigRef = useRef<HTMLCanvasElement>(null);
  const [clientDrawing, setClientDrawing] = useState(false);
  const [staffDrawing, setStaffDrawing] = useState(false);
  const [hasClientSig, setHasClientSig] = useState(false);
  const [hasStaffSig, setHasStaffSig] = useState(false);

  // Calculate delay and fine
  const delayMinutes = getDelayMinutes(contract.eventTime || "", checkoutTime, contract.eventDate);
  const fineAmount = calculateFine(delayMinutes);

  // Canvas helpers
  const getPos = (e: React.TouchEvent | React.MouseEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if ("touches" in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent, canvas: HTMLCanvasElement, setDrawing: (b: boolean) => void) => {
    e.preventDefault();
    setDrawing(true);
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent, canvas: HTMLCanvasElement, drawing: boolean) => {
    if (!drawing) return;
    e.preventDefault();
    const ctx = canvas.getContext("2d")!;
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  };

  const endDraw = (setDrawing: (b: boolean) => void, setHas: (b: boolean) => void) => {
    setDrawing(false);
    setHas(true);
  };

  const clearCanvas = (canvas: HTMLCanvasElement, setHas: (b: boolean) => void) => {
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHas(false);
  };

  const initCanvas = (canvas: HTMLCanvasElement | null) => {
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
  };

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        initCanvas(clientSigRef.current);
        initCanvas(staffSigRef.current);
      }, 200);
    }
  }, [open]);

  const allChecklistDone = checklist.clean && checklist.noDamage && checklist.trash && checklist.equipment;

  const handleFinalize = async () => {
    if (!hasClientSig || !hasStaffSig) {
      toast.error("Ambas assinaturas são obrigatórias");
      return;
    }
    if (!user) return;
    setSaving(true);
    try {
      const clientSigData = clientSigRef.current!.toDataURL("image/png");
      const staffSigData = staffSigRef.current!.toDataURL("image/png");

      const { error } = await supabase.from("event_checkouts").insert({
        user_id: user.id,
        contract_id: contract.id,
        client_name: client.name,
        event_date: contract.eventDate,
        event_time_contracted: contract.eventTime || "",
        checkout_time: checkoutTime.toISOString(),
        delay_minutes: delayMinutes,
        fine_amount: fineAmount,
        fine_status: fineAmount > 0 ? "pending" : "exempt",
        checklist_clean: checklist.clean,
        checklist_no_damage: checklist.noDamage,
        checklist_trash: checklist.trash,
        checklist_equipment: checklist.equipment,
        observations,
        client_signature: clientSigData,
        staff_signature: staffSigData,
      });

      if (error) throw error;

      // Update contract event_status
      await supabase.from("contracts").update({ event_status: "finalizado" }).eq("id", contract.id);

      toast.success("Evento finalizado com sucesso!");
      onCompleted?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(getSafeErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  // Charge fine via WhatsApp
  const handleChargeFineWhatsApp = () => {
    if (!client.phone) return;
    const phone = client.phone.replace(/\D/g, "");
    const fullPhone = phone.startsWith("55") ? phone : `55${phone}`;
    const text = encodeURIComponent(
      `Olá ${client.name}!\n\n⏱️ Identificamos um atraso de ${formatDelay(delayMinutes)} no evento do dia ${new Date(contract.eventDate + "T12:00:00").toLocaleDateString("pt-BR")}.\n\n💰 Multa aplicada: ${fmt(fineAmount)}\n\nPor favor, efetue o pagamento via PIX ou entre em contato para mais informações.\n\nEspaço Lamoniê`
    );
    window.open(`https://wa.me/${fullPhone}?text=${text}`, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ClipboardCheck size={18} /> Finalizar Evento / Devolução
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Event info */}
          <div className="rounded-xl border bg-muted/30 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cliente:</span>
              <span className="font-medium">{client.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Data do evento:</span>
              <span className="font-medium">{new Date(contract.eventDate + "T12:00:00").toLocaleDateString("pt-BR")}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Horário contratado:</span>
              <span className="font-medium">{contract.eventTime || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Horário de saída:</span>
              <span className="font-semibold">{checkoutTime.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          </div>

          {/* Delay & Fine */}
          {delayMinutes > 0 ? (
            <div className={`rounded-xl border p-4 space-y-2 ${fineAmount > 0 ? "border-destructive/30 bg-destructive/5" : "border-warning/30 bg-warning/5"}`}>
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className={fineAmount > 0 ? "text-destructive" : "text-warning"} />
                <span className="font-semibold text-sm">
                  {fineAmount > 0 ? "Atraso identificado" : "Dentro da tolerância"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock size={14} /> Atraso:
                </span>
                <span className="font-semibold">{formatDelay(delayMinutes)}</span>
              </div>
              {fineAmount > 0 && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <DollarSign size={14} /> Multa:
                    </span>
                    <span className="font-bold text-destructive text-lg">{fmt(fineAmount)}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Regra: até 15 min = tolerância | 16-30 min = R$ 75 | 31-60 min = R$ 150 | acima = R$ 150/hora
                  </p>
                  {client.phone && (
                    <Button variant="outline" size="sm" className="w-full gap-1.5 mt-2" onClick={handleChargeFineWhatsApp}>
                      <Send size={14} /> Cobrar multa via WhatsApp
                    </Button>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 p-3 flex items-center gap-2">
              <CheckCircle size={16} className="text-emerald-600" />
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Evento encerrado no horário ✓</span>
            </div>
          )}

          {/* Checklist */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Checklist de Devolução</p>
            {[
              { key: "clean" as const, label: "Espaço limpo" },
              { key: "noDamage" as const, label: "Sem danos ao espaço/equipamentos" },
              { key: "trash" as const, label: "Lixo recolhido" },
              { key: "equipment" as const, label: "Equipamentos preservados" },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center gap-3 rounded-lg border p-3">
                <Checkbox
                  id={key}
                  checked={checklist[key]}
                  onCheckedChange={(v) => setChecklist((prev) => ({ ...prev, [key]: !!v }))}
                />
                <Label htmlFor={key} className="text-sm cursor-pointer flex-1">{label}</Label>
              </div>
            ))}
          </div>

          {/* Observations */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Observações</Label>
            <Textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Observações sobre o estado do espaço, ocorrências, etc."
              rows={3}
            />
          </div>

          {/* Client signature */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold">✍️ Assinatura do Cliente</label>
              {hasClientSig && (
                <button onClick={() => clearCanvas(clientSigRef.current!, setHasClientSig)} className="text-xs text-destructive hover:underline">
                  Limpar
                </button>
              )}
            </div>
            <div className="rounded-xl border-2 border-dashed border-muted-foreground/30 bg-card overflow-hidden" style={{ touchAction: "none" }}>
              <canvas
                ref={clientSigRef}
                className="w-full cursor-crosshair"
                style={{ height: 120 }}
                onMouseDown={(e) => startDraw(e, clientSigRef.current!, setClientDrawing)}
                onMouseMove={(e) => draw(e, clientSigRef.current!, clientDrawing)}
                onMouseUp={() => endDraw(setClientDrawing, setHasClientSig)}
                onMouseLeave={() => endDraw(setClientDrawing, setHasClientSig)}
                onTouchStart={(e) => startDraw(e, clientSigRef.current!, setClientDrawing)}
                onTouchMove={(e) => draw(e, clientSigRef.current!, clientDrawing)}
                onTouchEnd={() => endDraw(setClientDrawing, setHasClientSig)}
              />
            </div>
          </div>

          {/* Staff signature */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold">👤 Assinatura do Responsável</label>
              {hasStaffSig && (
                <button onClick={() => clearCanvas(staffSigRef.current!, setHasStaffSig)} className="text-xs text-destructive hover:underline">
                  Limpar
                </button>
              )}
            </div>
            <div className="rounded-xl border-2 border-dashed border-muted-foreground/30 bg-card overflow-hidden" style={{ touchAction: "none" }}>
              <canvas
                ref={staffSigRef}
                className="w-full cursor-crosshair"
                style={{ height: 120 }}
                onMouseDown={(e) => startDraw(e, staffSigRef.current!, setStaffDrawing)}
                onMouseMove={(e) => draw(e, staffSigRef.current!, staffDrawing)}
                onMouseUp={() => endDraw(setStaffDrawing, setHasStaffSig)}
                onMouseLeave={() => endDraw(setStaffDrawing, setHasStaffSig)}
                onTouchStart={(e) => startDraw(e, staffSigRef.current!, setStaffDrawing)}
                onTouchMove={(e) => draw(e, staffSigRef.current!, staffDrawing)}
                onTouchEnd={() => endDraw(setStaffDrawing, setHasStaffSig)}
              />
            </div>
          </div>

          {/* Submit */}
          <Button
            onClick={handleFinalize}
            disabled={!hasClientSig || !hasStaffSig || saving}
            className="w-full h-14 text-base font-semibold gap-2"
            size="lg"
          >
            {saving ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            ) : (
              <CheckCircle size={20} />
            )}
            {saving ? "Salvando..." : "Finalizar Evento"}
          </Button>

          {!allChecklistDone && (
            <p className="text-[10px] text-center text-warning">
              ⚠️ Nem todos os itens do checklist foram marcados
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
