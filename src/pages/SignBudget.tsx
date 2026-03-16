import { useEffect, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  CheckCircle, Loader2, AlertTriangle, ShieldCheck, Sparkles,
  PartyPopper, Calendar, Users, FileCheck, PenTool
} from "lucide-react";
import { jsPDF } from "jspdf";
import { supabase } from "@/integrations/supabase/client";

const fmt = (v: number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string | null) => {
  if (!d) return "—";
  const date = new Date(d + "T12:00:00");
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
};

interface SignatureData {
  id: string;
  token: string;
  budget_id: string;
  client_name: string;
  client_phone: string;
  event_date: string;
  event_type: string;
  total_value: number;
  deposit_percent: number;
  status: string;
  signed_at: string | null;
  user_id: string;
}

interface BudgetItemRow {
  id: string;
  name: string;
  quantity: number;
  unit_label: string;
  final_value: number;
  category: string;
}

async function loadLogoBase64(): Promise<string> {
  const res = await fetch("/images/logo-lamonie.png");
  const blob = await res.blob();
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
}

async function generateBudgetSignedPDF(
  d: SignatureData & { depositValue?: number },
  items: BudgetItemRow[],
  signatureDataUrl: string
): Promise<string> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const usableWidth = pageWidth - margin * 2;
  let y = 25;

  const logoBase64 = await loadLogoBase64();
  const addWatermark = () => {
    const logoSize = 100;
    const cx = (pageWidth - logoSize) / 2;
    const cy = (pageHeight - logoSize) / 2;
    doc.saveGraphicsState();
    // @ts-ignore
    doc.setGState(new doc.GState({ opacity: 0.06 }));
    doc.addImage(logoBase64, "PNG", cx, cy, logoSize, logoSize);
    doc.restoreGraphicsState();
  };
  addWatermark();

  const addText = (text: string, opts?: { bold?: boolean; size?: number; center?: boolean; indent?: number }) => {
    const size = opts?.size || 11;
    const style = opts?.bold ? "bold" : "normal";
    doc.setFontSize(size);
    doc.setFont("helvetica", style);
    const x = margin + (opts?.indent || 0);
    const maxWidth = usableWidth - (opts?.indent || 0);
    const lines = doc.splitTextToSize(text, maxWidth);
    for (const line of lines) {
      if (y > 275) { doc.addPage(); addWatermark(); y = 20; }
      if (opts?.center) {
        const lw = doc.getTextWidth(line);
        doc.text(line, (pageWidth - lw) / 2, y);
      } else {
        doc.text(line, x, y);
      }
      y += size * 0.45;
    }
  };
  const addSpace = (h = 4) => { y += h; };

  const now = new Date();
  const months = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const sigDate = `${now.getDate()} de ${months[now.getMonth()]} de ${now.getFullYear()}`;

  // Header
  addText("PROPOSTA COMERCIAL — ACEITE DO CLIENTE", { bold: true, size: 14, center: true });
  addSpace(3);
  addText("Espaço Lamoniê", { bold: true, size: 11, center: true });
  addSpace(8);

  // Client info
  addText("DADOS DO CLIENTE", { bold: true, size: 12 }); addSpace(2);
  addText(`Nome: ${d.client_name}`);
  if (d.client_phone) addText(`Telefone: ${d.client_phone}`);
  addText(`Evento: ${d.event_type}`);
  addText(`Data do evento: ${fmtDate(d.event_date)}`);
  addSpace(6);

  // Items table
  addText("ITENS DO ORÇAMENTO", { bold: true, size: 12 }); addSpace(3);

  for (const item of items) {
    if (y > 265) { doc.addPage(); addWatermark(); y = 20; }
    const itemText = `• ${item.name} — ${item.quantity} ${item.unit_label}`;
    const valueText = fmt(item.final_value);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(itemText, margin + 2, y);
    doc.setFont("helvetica", "bold");
    const vw = doc.getTextWidth(valueText);
    doc.text(valueText, pageWidth - margin - vw, y);
    doc.setFont("helvetica", "normal");
    y += 5;
  }

  addSpace(4);
  // Total
  doc.setDrawColor(31, 77, 58);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;
  addText(`VALOR TOTAL: ${fmt(d.total_value)}`, { bold: true, size: 13 });
  if ((d as any).depositValue && (d as any).depositValue > 0) {
    addSpace(2);
    addText(`Sinal pago (reserva): ${fmt((d as any).depositValue)}`, { size: 11 });
    addText(`Restante: ${fmt(d.total_value - (d as any).depositValue)}`, { bold: true, size: 11 });
  }
  addSpace(8);

  // Declaration
  addText("DECLARAÇÃO DE ACEITE", { bold: true, size: 12 }); addSpace(2);
  addText("O(a) cliente declara que visualizou todos os itens e valores apresentados nesta proposta comercial e concorda integralmente com os termos, valores e condições estabelecidos.");
  addSpace(4);
  addText(`Aceito registrado em ${sigDate} às ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}.`);
  addSpace(12);

  // Signature
  const sigBlockHeight = 50;
  if (y + sigBlockHeight > pageHeight - margin) {
    doc.addPage(); addWatermark(); y = 20;
  }

  try {
    doc.addImage(signatureDataUrl, "PNG", margin, y, 60, 25);
  } catch {}
  y += 28;
  doc.setDrawColor(0);
  doc.line(margin, y, margin + 70, y);
  y += 5;
  addText(d.client_name, { bold: true });
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(100, 100, 100);
  doc.text(`Assinado digitalmente em ${sigDate}`, margin, y);
  doc.setTextColor(0, 0, 0);

  return doc.output("datauristring");
}

interface Props {
  data: SignatureData;
}

export default function SignBudget({ data: initialData }: Props) {
  const [data] = useState<SignatureData>(initialData);
  const [items, setItems] = useState<BudgetItemRow[]>([]);
  const [depositValue, setDepositValue] = useState(0);
  const [loadingItems, setLoadingItems] = useState(true);
  const [step, setStep] = useState<"review" | "sign" | "done">(initialData.status === "signed" ? "done" : "review");
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const FUNC_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sign-contract`;

  useEffect(() => {
    const loadItems = async () => {
      if (!data.budget_id) return;
      const [itemsRes, budgetRes] = await Promise.all([
        supabase.from("budget_items").select("id, name, quantity, unit_label, final_value, category").eq("budget_id", data.budget_id).order("sort_order"),
        supabase.from("budgets").select("deposit_value").eq("id", data.budget_id).single(),
      ]);
      setItems((itemsRes.data || []) as BudgetItemRow[]);
      if (budgetRes.data) setDepositValue(Number((budgetRes.data as any).deposit_value || 0));
      setLoadingItems(false);
    };
    loadItems();
  }, [data.budget_id]);

  // Canvas helpers
  const getCanvasPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const touch = e.touches[0];
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isDrawing.current = true;
    const pos = getCanvasPos(e);
    lastPos.current = pos;
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) { ctx.beginPath(); ctx.moveTo(pos.x, pos.y); }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getCanvasPos(e);
    ctx.strokeStyle = "#1F3D2B";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  };

  const stopDrawing = () => {
    if (isDrawing.current) {
      isDrawing.current = false;
      const canvas = canvasRef.current;
      if (canvas) setSignatureDataUrl(canvas.toDataURL("image/png"));
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      setSignatureDataUrl(null);
    }
  };

  const isCanvasEmpty = () => {
    const canvas = canvasRef.current;
    if (!canvas) return true;
    const ctx = canvas.getContext("2d");
    if (!ctx) return true;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return !imageData.data.some((channel, i) => i % 4 === 3 && channel !== 0);
  };

  const handleSign = async () => {
    if (!data) return;
    if (isCanvasEmpty()) { setError("Desenhe sua assinatura antes de confirmar"); return; }
    setSigning(true);
    setError("");
    try {
      const sigDataUrl = canvasRef.current!.toDataURL("image/png");
      const pdfDataUri = await generateBudgetSignedPDF(data, items, sigDataUrl);
      const rawBase64 = pdfDataUri.split(",")[1];

      const res = await fetch(FUNC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ token: data.token, pdf_base64: rawBase64, user_agent: navigator.userAgent }),
      });
      const result = await res.json();
      if (result.error) { setError(result.error); }
      else { setStep("done"); }
    } catch { setError("Erro ao registrar aceite"); }
    finally { setSigning(false); }
  };

  const canSign = signatureDataUrl && !isCanvasEmpty();

  // ── DONE ──
  if (step === "done") {
    return (
      <div className="min-h-screen" style={{ background: "linear-gradient(180deg, #F6F7FB 0%, #EEF0F4 100%)" }}>
        <div style={{ height: "4px", background: "linear-gradient(90deg, #1F4D3A 0%, #2D7A50 50%, #1F4D3A 100%)" }} />
        <div className="max-w-lg mx-auto px-5 py-16 text-center">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full mb-6" style={{ background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)", boxShadow: "0 8px 32px rgba(34, 197, 94, 0.3)" }}>
            <CheckCircle size={48} style={{ color: "#fff" }} />
          </div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "28px", fontWeight: 700, color: "#111827" }}>
            Orçamento aceito com sucesso!
          </h1>
          <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "14px", color: "#6B7280", marginTop: "12px", lineHeight: 1.7 }}>
            Sua assinatura de aceite foi registrada. O Espaço Lamoniê entrará em contato para dar continuidade ao seu evento.
          </p>
          <div className="rounded-2xl mt-8 p-6 text-left" style={{ background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}>
            <div className="space-y-3">
              <InfoRow icon={<PartyPopper size={16} style={{ color: "#1F4D3A" }} />} label="Evento" value={data.event_type} />
              <InfoRow icon={<Calendar size={16} style={{ color: "#1F4D3A" }} />} label="Data" value={fmtDate(data.event_date)} />
              <InfoRow icon={<Sparkles size={16} style={{ color: "#1F4D3A" }} />} label="Valor" value={fmt(data.total_value)} />
            </div>
          </div>
          <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "10px", color: "#9CA3AF", marginTop: "32px", letterSpacing: "0.1em" }}>
            Espaço Lamoniê © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    );
  }

  // ── REVIEW + SIGN ──
  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(180deg, #F6F7FB 0%, #EEF0F4 50%, #F6F7FB 100%)" }}>
      {/* Top accent */}
      <div style={{ height: "4px", background: "linear-gradient(90deg, #1F4D3A 0%, #2D7A50 50%, #1F4D3A 100%)" }} />

      <div className="max-w-2xl mx-auto px-5 py-8 sm:py-12">

        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ background: "linear-gradient(135deg, #1F4D3A 0%, #2D7A50 100%)", boxShadow: "0 8px 32px rgba(31, 77, 58, 0.25)" }}>
            <img src="/images/logo-lamonie.png" alt="Lamoniê" className="h-10 w-10 object-contain" style={{ filter: "brightness(10)" }} />
          </div>
          <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.2em", textTransform: "uppercase", color: "#1F4D3A", marginBottom: "4px" }}>
            Espaço Lamoniê
          </p>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "26px", fontWeight: 700, color: "#111827", lineHeight: 1.2 }}>
            {step === "review" ? "Revisão do Orçamento" : "Assinatura de Aceite"}
          </h1>
          <div className="flex items-center justify-center gap-2 mt-3">
            <div style={{ width: "30px", height: "1px", background: "#1F4D3A", opacity: 0.3 }} />
            <Sparkles size={12} style={{ color: "#1F4D3A", opacity: 0.5 }} />
            <div style={{ width: "30px", height: "1px", background: "#1F4D3A", opacity: 0.3 }} />
          </div>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-3 mt-5">
            <StepPill active={step === "review"} done={step === "sign"} number={1} label="Revisão" />
            <div style={{ width: "24px", height: "2px", background: step === "sign" ? "#1F4D3A" : "#D1D5DB", borderRadius: "2px" }} />
            <StepPill active={step === "sign"} done={false} number={2} label="Assinatura" />
          </div>
        </div>

        {step === "review" && (
          <>
            {/* Client card */}
            <div className="rounded-2xl overflow-hidden mb-5" style={{ background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}>
              <div style={{ padding: "18px 24px 14px", borderBottom: "1px solid #F0F0F0" }}>
                <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#9CA3AF", marginBottom: "4px" }}>
                  Preparado para
                </p>
                <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "20px", fontWeight: 600, color: "#111827" }}>
                  {data.client_name}
                </p>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
                <div style={{ padding: "14px 24px", borderRight: "1px solid #F0F0F0" }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <PartyPopper size={12} style={{ color: "#1F4D3A" }} />
                    <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "9px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9CA3AF" }}>Evento</p>
                  </div>
                  <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "13px", fontWeight: 600, color: "#111827" }}>{data.event_type || "—"}</p>
                </div>
                <div style={{ padding: "14px 24px" }}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Calendar size={12} style={{ color: "#1F4D3A" }} />
                    <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "9px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9CA3AF" }}>Data</p>
                  </div>
                  <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "13px", fontWeight: 600, color: "#111827" }}>{fmtDate(data.event_date)}</p>
                </div>
              </div>
            </div>

            {/* Items list */}
            <div className="rounded-2xl overflow-hidden mb-5" style={{ background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}>
              <div style={{ padding: "16px 24px", borderBottom: "1px solid #F0F0F0" }}>
                <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.15em", textTransform: "uppercase", color: "#9CA3AF" }}>
                  Itens inclusos
                </p>
              </div>
              {loadingItems ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 size={20} className="animate-spin" style={{ color: "#1F4D3A" }} />
                </div>
              ) : (
                <div>
                  {items.map((item, idx) => (
                    <div
                      key={item.id}
                      style={{
                        padding: "14px 24px",
                        borderBottom: idx < items.length - 1 ? "1px solid #F8F8F8" : "none",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "14px", fontWeight: 500, color: "#111827" }}>
                          {item.name}
                        </p>
                        <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "11px", color: "#9CA3AF", marginTop: "2px" }}>
                          {item.quantity} {item.unit_label}
                        </p>
                      </div>
                      <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "14px", fontWeight: 600, color: "#1F4D3A", marginLeft: "16px", whiteSpace: "nowrap" }}>
                        {fmt(item.final_value)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Total */}
            <div className="rounded-2xl overflow-hidden mb-8" style={{ background: "linear-gradient(135deg, #1F4D3A 0%, #2A6B4A 100%)", boxShadow: "0 8px 32px rgba(31, 77, 58, 0.2)" }}>
              <div style={{ padding: "20px 24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "16px", fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>
                    Valor Total
                  </p>
                  <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "28px", fontWeight: 700, color: "#FFFFFF" }}>
                    {fmt(data.total_value)}
                  </p>
                </div>
                {depositValue > 0 && (
                  <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.2)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "13px", fontWeight: 500, color: "rgba(255,255,255,0.8)" }}>
                      Sinal pago (reserva)
                    </p>
                    <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "16px", fontWeight: 600, color: "#86EFAC" }}>
                      {fmt(depositValue)}
                    </p>
                  </div>
                )}
                {depositValue > 0 && (
                  <div style={{ marginTop: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "13px", fontWeight: 500, color: "rgba(255,255,255,0.7)" }}>
                      Restante
                    </p>
                    <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "16px", fontWeight: 600, color: "#FFFFFF" }}>
                      {fmt(data.total_value - depositValue)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Accept button */}
            <div className="text-center">
              <button
                onClick={() => setStep("sign")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  width: "100%",
                  maxWidth: "420px",
                  padding: "18px 32px",
                  borderRadius: "16px",
                  border: "none",
                  cursor: "pointer",
                  background: "linear-gradient(135deg, #1F4D3A 0%, #2D7A50 100%)",
                  color: "#FFFFFF",
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: "15px",
                  fontWeight: 600,
                  letterSpacing: "0.02em",
                  boxShadow: "0 4px 20px rgba(31, 77, 58, 0.35), 0 2px 8px rgba(0,0,0,0.1)",
                  transition: "transform 0.2s, box-shadow 0.2s",
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
              >
                <FileCheck size={20} />
                Eu aceito este orçamento
              </button>
              <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "11px", color: "#9CA3AF", marginTop: "12px" }}>
                Ao clicar, você será direcionado para assinar digitalmente
              </p>
            </div>
          </>
        )}

        {step === "sign" && (
          <div className="space-y-5">
            {/* Summary reminder */}
            <div className="rounded-2xl overflow-hidden" style={{ background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}>
              <div style={{ padding: "16px 24px", borderBottom: "1px solid #F0F0F0", display: "flex", alignItems: "center", gap: "8px" }}>
                <FileCheck size={16} style={{ color: "#1F4D3A" }} />
                <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "12px", fontWeight: 600, color: "#1F4D3A" }}>
                  Orçamento aceito
                </p>
              </div>
              <div style={{ padding: "14px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "13px", fontWeight: 500, color: "#111827" }}>
                    {data.client_name}
                  </p>
                  <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "11px", color: "#9CA3AF" }}>
                    {data.event_type} • {fmtDate(data.event_date)}
                  </p>
                </div>
                <p style={{ fontFamily: "'Playfair Display', serif", fontSize: "18px", fontWeight: 700, color: "#1F4D3A" }}>
                  {fmt(data.total_value)}
                </p>
              </div>
            </div>

            {/* Signature area */}
            <div className="rounded-2xl overflow-hidden" style={{ background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid #F0F0F0" }}>
                <div className="flex items-center gap-2 mb-1">
                  <PenTool size={16} style={{ color: "#1F4D3A" }} />
                  <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "14px", fontWeight: 600, color: "#111827" }}>
                    Assine abaixo para confirmar
                  </p>
                </div>
                <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "12px", color: "#9CA3AF" }}>
                  Desenhe sua rubrica no campo abaixo
                </p>
              </div>
              <div style={{ padding: "20px 24px" }}>
                <div style={{
                  position: "relative",
                  borderRadius: "12px",
                  border: "2px dashed rgba(31, 77, 58, 0.3)",
                  background: "#FAFBFC",
                }}>
                  <canvas
                    ref={canvasRef}
                    width={600}
                    height={200}
                    className="w-full cursor-crosshair touch-none"
                    style={{ height: "140px" }}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                  {!signatureDataUrl && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "13px", color: "#D1D5DB" }}>
                        Desenhe sua rubrica aqui
                      </p>
                    </div>
                  )}
                </div>
                {signatureDataUrl && (
                  <button
                    onClick={clearCanvas}
                    style={{
                      marginTop: "8px",
                      fontFamily: "'Poppins', sans-serif",
                      fontSize: "12px",
                      color: "#1F4D3A",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      textDecoration: "underline",
                      textUnderlineOffset: "3px",
                    }}
                  >
                    Limpar assinatura
                  </button>
                )}
              </div>

              <div style={{ padding: "0 24px 24px" }}>
                <div style={{
                  background: "rgba(31, 77, 58, 0.05)",
                  borderRadius: "12px",
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  marginBottom: "16px",
                  border: "1px solid rgba(31, 77, 58, 0.1)",
                }}>
                  <ShieldCheck size={16} style={{ color: "#1F4D3A", flexShrink: 0, marginTop: "2px" }} />
                  <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "11px", color: "#4B5563", lineHeight: 1.6 }}>
                    Ao assinar, você declara que revisou todos os itens e valores e concorda com esta proposta comercial do Espaço Lamoniê.
                  </p>
                </div>

                {error && (
                  <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "13px", color: "#DC2626", fontWeight: 500, marginBottom: "12px" }}>{error}</p>
                )}

                <button
                  onClick={handleSign}
                  disabled={signing || !canSign}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "10px",
                    width: "100%",
                    padding: "16px",
                    borderRadius: "14px",
                    border: "none",
                    cursor: signing || !canSign ? "not-allowed" : "pointer",
                    background: signing || !canSign ? "#D1D5DB" : "linear-gradient(135deg, #1F4D3A 0%, #2D7A50 100%)",
                    color: "#FFFFFF",
                    fontFamily: "'Poppins', sans-serif",
                    fontSize: "15px",
                    fontWeight: 600,
                    boxShadow: signing || !canSign ? "none" : "0 4px 20px rgba(31, 77, 58, 0.35)",
                    transition: "all 0.2s",
                    opacity: signing || !canSign ? 0.6 : 1,
                  }}
                >
                  {signing ? (
                    <><Loader2 size={18} className="animate-spin" /> Registrando aceite...</>
                  ) : (
                    <><CheckCircle size={18} /> Confirmar e assinar</>
                  )}
                </button>

                {!canSign && !signing && (
                  <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "11px", color: "#9CA3AF", textAlign: "center", marginTop: "10px" }}>
                    Desenhe sua rubrica acima para continuar
                  </p>
                )}

                <button
                  onClick={() => setStep("review")}
                  style={{
                    display: "block",
                    width: "100%",
                    marginTop: "12px",
                    padding: "10px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "'Poppins', sans-serif",
                    fontSize: "13px",
                    color: "#6B7280",
                    textDecoration: "underline",
                    textUnderlineOffset: "3px",
                  }}
                >
                  ← Voltar para revisão
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-10">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div style={{ width: "30px", height: "1px", background: "#D1D5DB" }} />
            <img src="/images/logo-lamonie.png" alt="Lamoniê" className="h-5 w-5 object-contain" style={{ opacity: 0.4 }} />
            <div style={{ width: "30px", height: "1px", background: "#D1D5DB" }} />
          </div>
          <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "10px", color: "#9CA3AF", letterSpacing: "0.1em" }}>
            Espaço Lamoniê © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}

function StepPill({ active, done, number, label }: { active: boolean; done: boolean; number: number; label: string }) {
  const bg = active ? "#1F4D3A" : done ? "#1F4D3A" : "#E5E7EB";
  const color = active || done ? "#fff" : "#9CA3AF";
  const labelColor = active ? "#111827" : done ? "#1F4D3A" : "#9CA3AF";
  return (
    <div className="flex items-center gap-2">
      <div style={{
        width: "28px", height: "28px", borderRadius: "50%", background: bg,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Poppins', sans-serif", fontSize: "11px", fontWeight: 700, color,
        transition: "all 0.3s",
      }}>
        {done ? "✓" : number}
      </div>
      <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: "12px", fontWeight: active ? 600 : 400, color: labelColor }}>
        {label}
      </span>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div style={{ flexShrink: 0 }}>{icon}</div>
      <div className="flex-1">
        <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "10px", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#9CA3AF" }}>{label}</p>
        <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: "14px", fontWeight: 500, color: "#111827" }}>{value}</p>
      </div>
    </div>
  );
}
