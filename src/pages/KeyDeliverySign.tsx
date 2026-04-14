import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle, Key, AlertTriangle } from "lucide-react";

export default function KeyDeliverySign() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [term, setTerm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [error, setError] = useState("");

  // Signature canvases
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const rubCanvasRef = useRef<HTMLCanvasElement>(null);
  const [sigDrawing, setSigDrawing] = useState(false);
  const [rubDrawing, setRubDrawing] = useState(false);
  const [hasSig, setHasSig] = useState(false);
  const [hasRub, setHasRub] = useState(false);

  useEffect(() => {
    if (!token) { setError("Token inválido"); setLoading(false); return; }
    supabase.from("key_delivery_terms").select("*").eq("token", token).single()
      .then(({ data, error: e }) => {
        if (e || !data) { setError("Termo não encontrado"); setLoading(false); return; }
        if (data.status === "signed") { setSigned(true); }
        setTerm(data);
        setLoading(false);
      });
  }, [token]);

  // Canvas drawing helpers
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
    if (term && !signed) {
      setTimeout(() => {
        initCanvas(sigCanvasRef.current);
        initCanvas(rubCanvasRef.current);
      }, 100);
    }
  }, [term, signed]);

  const handleSign = async () => {
    if (!hasSig || !hasRub) return;
    setSigning(true);
    try {
      const sigData = sigCanvasRef.current!.toDataURL("image/png");
      const rubData = rubCanvasRef.current!.toDataURL("image/png");

      const { error: e } = await supabase.from("key_delivery_terms").update({
        signature_image: sigData,
        rubric_image: rubData,
        status: "signed",
        signed_at: new Date().toISOString(),
        signed_ip: "",
        user_agent: navigator.userAgent,
      }).eq("token", token);

      if (e) throw e;
      setSigned(true);
    } catch (e: any) {
      setError(e.message || "Erro ao assinar");
    } finally {
      setSigning(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center gap-4">
      <AlertTriangle size={48} className="text-destructive" />
      <p className="text-lg font-semibold">{error}</p>
    </div>
  );

  if (signed) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6 text-center gap-4">
      <div className="w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
        <CheckCircle size={40} className="text-emerald-600" />
      </div>
      <h1 className="text-2xl font-bold">Termo Assinado!</h1>
      <p className="text-muted-foreground max-w-sm">
        O Termo de Entrega de Chaves foi assinado com sucesso. Tenha um ótimo evento!
      </p>
    </div>
  );

  const formatDate = (d: string) => {
    try { return new Date(d + "T12:00:00").toLocaleDateString("pt-BR"); } catch { return d; }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-6 py-8 text-center">
        <Key size={32} className="mx-auto mb-3 opacity-90" />
        <h1 className="text-xl font-bold">Termo de Entrega de Chaves</h1>
        <p className="text-sm opacity-80 mt-1">Espaço Lamoniê</p>
      </div>

      <div className="max-w-lg mx-auto p-5 space-y-6">
        {/* Term content */}
        <div className="rounded-xl border bg-card p-5 space-y-4 text-sm leading-relaxed">
          <p className="font-semibold text-center uppercase text-xs tracking-widest text-muted-foreground">
            Termo de Entrega de Chaves e Responsabilidade
          </p>

          <p>
            Eu, <strong>{term.client_name}</strong>
            {term.client_cpf && <>, CPF <strong>{term.client_cpf}</strong></>}
            , declaro que recebi as chaves do <strong>Espaço Lamoniê</strong> referente ao evento do dia{" "}
            <strong>{formatDate(term.event_date)}</strong>, com horário contratado de{" "}
            <strong>{term.event_time || "conforme contrato"}</strong>.
          </p>

          <p>Declaro estar ciente e de acordo com as seguintes regras:</p>

          <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
            <li>O horário contratado deve ser respeitado rigorosamente.</li>
            <li>O uso do espaço está autorizado apenas dentro do horário acordado.</li>
            <li>Em caso de ultrapassar o horário, poderão ser aplicadas penalidades.</li>
            <li>O descumprimento das regras poderá resultar no encerramento imediato do evento.</li>
            <li>O cliente é responsável pela conservação do espaço durante o período de uso.</li>
            <li>Qualquer dano causado será de responsabilidade do contratante.</li>
          </ol>

          <p>
            Declaro que recebi o espaço em perfeitas condições e me comprometo a devolvê-lo da mesma forma.
          </p>

          <div className="border-t pt-3 mt-4">
            <p className="text-xs text-muted-foreground">
              📍 Data e horário da entrega:{" "}
              <strong className="text-foreground">
                {new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </strong>
            </p>
          </div>
        </div>

        {/* Signature */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold">✍️ Assinatura do Cliente</label>
            {hasSig && (
              <button onClick={() => clearCanvas(sigCanvasRef.current!, setHasSig)} className="text-xs text-destructive hover:underline">
                Limpar
              </button>
            )}
          </div>
          <div className="rounded-xl border-2 border-dashed border-muted-foreground/30 bg-card overflow-hidden" style={{ touchAction: "none" }}>
            <canvas
              ref={sigCanvasRef}
              className="w-full cursor-crosshair"
              style={{ height: 150 }}
              onMouseDown={(e) => startDraw(e, sigCanvasRef.current!, setSigDrawing)}
              onMouseMove={(e) => draw(e, sigCanvasRef.current!, sigDrawing)}
              onMouseUp={() => endDraw(setSigDrawing, setHasSig)}
              onMouseLeave={() => endDraw(setSigDrawing, setHasSig)}
              onTouchStart={(e) => startDraw(e, sigCanvasRef.current!, setSigDrawing)}
              onTouchMove={(e) => draw(e, sigCanvasRef.current!, sigDrawing)}
              onTouchEnd={() => endDraw(setSigDrawing, setHasSig)}
            />
          </div>
          {!hasSig && <p className="text-xs text-muted-foreground text-center">Desenhe sua assinatura acima</p>}
        </div>

        {/* Rubric */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold">📝 Rubrica</label>
            {hasRub && (
              <button onClick={() => clearCanvas(rubCanvasRef.current!, setHasRub)} className="text-xs text-destructive hover:underline">
                Limpar
              </button>
            )}
          </div>
          <div className="rounded-xl border-2 border-dashed border-muted-foreground/30 bg-card overflow-hidden" style={{ touchAction: "none" }}>
            <canvas
              ref={rubCanvasRef}
              className="w-full cursor-crosshair"
              style={{ height: 100 }}
              onMouseDown={(e) => startDraw(e, rubCanvasRef.current!, setRubDrawing)}
              onMouseMove={(e) => draw(e, rubCanvasRef.current!, rubDrawing)}
              onMouseUp={() => endDraw(setRubDrawing, setHasRub)}
              onMouseLeave={() => endDraw(setRubDrawing, setHasRub)}
              onTouchStart={(e) => startDraw(e, rubCanvasRef.current!, setRubDrawing)}
              onTouchMove={(e) => draw(e, rubCanvasRef.current!, rubDrawing)}
              onTouchEnd={() => endDraw(setRubDrawing, setHasRub)}
            />
          </div>
          {!hasRub && <p className="text-xs text-muted-foreground text-center">Desenhe sua rubrica acima</p>}
        </div>

        {/* Submit */}
        <Button
          onClick={handleSign}
          disabled={!hasSig || !hasRub || signing}
          className="w-full h-14 text-base font-semibold gap-2"
          size="lg"
        >
          {signing ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
          ) : (
            <CheckCircle size={20} />
          )}
          {signing ? "Assinando..." : "Confirmar Assinatura"}
        </Button>

        <p className="text-[10px] text-center text-muted-foreground pb-8">
          Ao assinar, você confirma estar de acordo com todos os termos acima.
        </p>
      </div>
    </div>
  );
}
