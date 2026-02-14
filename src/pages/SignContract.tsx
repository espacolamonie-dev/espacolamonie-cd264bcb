import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle, FileText, Loader2, AlertTriangle, ShieldCheck, ChevronDown } from "lucide-react";
import { jsPDF } from "jspdf";

const fmt = (v: number) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("pt-BR");
}

function formatDateFull(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  const months = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
}

interface SignatureData {
  id: string;
  contract_id: string;
  token: string;
  client_name: string;
  client_cpf: string;
  client_phone: string;
  client_address: string;
  event_date: string;
  event_type: string;
  total_value: number;
  deposit_percent: number;
  status: string;
  signed_at: string | null;
  user_id: string;
}

function buildContractText(d: SignatureData): string {
  const depositValue = (d.total_value * d.deposit_percent) / 100;
  const remainingPercent = 100 - d.deposit_percent;
  const remainingValue = d.total_value - depositValue;

  return `CONTRATO DE LOCAÇÃO DE ESPAÇO PARA EVENTO

Pelo presente instrumento particular, as partes abaixo identificadas:

LOCADOR:
Nome: Espaço Lamoniê
CNPJ: 61.075.137/0001-08
Endereço: Rua Cascadura, nº 380, Botafogo (Justinópolis), Ribeirão das Neves – MG
Telefone: (31) 99711-1502

LOCATÁRIO:
Nome: ${d.client_name}
CPF: ${d.client_cpf || "Não informado"}
Endereço: ${d.client_address || "Não informado"}
Telefone: ${d.client_phone || "Não informado"}

Têm entre si justo e contratado o seguinte:

CLÁUSULA 1 – DO OBJETO
1.1. O presente contrato tem por objeto a locação do espaço físico do Espaço Lamoniê, exclusivamente para realização de evento privado, sem fins lucrativos, na data ${formatDate(d.event_date)}, no horário de dia inteiro, com devolução das chaves dentro do horário acordado.

CLÁUSULA 2 – DO VALOR E FORMA DE PAGAMENTO
2.1. O valor total da locação é de ${fmt(d.total_value)}.
2.2. Será pago:
• Cliente optou em dar um sinal de ${d.deposit_percent}% (${fmt(depositValue)}) no ato da assinatura deste contrato, a título de sinal;
• ${remainingPercent}% (${fmt(remainingValue)}) até 7 dias antes da data do evento.
2.3. O pagamento será realizado via Pix ou depósito bancário.
2.4. O sinal pago não será devolvido, exceto nas hipóteses previstas neste contrato.

CLÁUSULA 3 – DO CANCELAMENTO
3.1. Em caso de cancelamento pelo LOCATÁRIO:
• Com até 15 dias de antecedência, será permitido remarcar o evento, sujeito à disponibilidade;
• Com prazo inferior a 15 dias, não haverá devolução de valores.
3.2. Em caso de cancelamento pelo LOCADOR por motivo de força maior, todos os valores pagos serão integralmente devolvidos.

CLÁUSULA 4 – DO USO DO ESPAÇO
4.1. O espaço destina-se exclusivamente a eventos privados, sendo vedada qualquer atividade comercial, cobrança de ingressos ou divulgação pública.
4.2. A capacidade máxima é de 120 pessoas, sendo o controle de público de responsabilidade do LOCATÁRIO.
4.3. O uso de som será restrito a som ambiente já instalado no espaço para utilização, sendo proibidos DJs, bandas ou equipamentos profissionais.

CLÁUSULA 5 – DA RESPONSABILIDADE
5.1. O LOCATÁRIO se responsabiliza integralmente por:
• Danos causados ao espaço, mobiliário ou equipamentos;
• Conduta de convidados;
• Cumprimento das normas de segurança.
5.2. Fica expressamente proibido:
• Uso de garrafas de vidro;
• Drogas ilícitas;
• Brigas, excessos ou comportamento ofensivo;
• Fogos, narguilé, cigarro comum ou eletrônico em área interna.

CLÁUSULA 6 – DA LIMPEZA
6.1. O espaço será entregue limpo e deverá ser devolvido nas mesmas condições.
6.2. A não realização da limpeza implicará cobrança de R$ 250,00.

CLÁUSULA 7 – DAS PENALIDADES
7.1. O descumprimento de qualquer cláusula autoriza:
• Encerramento imediato do evento;
• Aplicação de multa equivalente a 20% do valor total do contrato;
• Cobrança integral de danos apurados.

CLÁUSULA 8 – CASO FORTUITO E FORÇA MAIOR
8.1. Nenhuma das partes será responsabilizada por eventos imprevisíveis ou inevitáveis, como queda de energia, fenômenos naturais ou atos de autoridade pública.

CLÁUSULA 9 – DO FORO
9.1. Fica eleito o foro da Comarca de Ribeirão das Neves – MG, renunciando a qualquer outro, por mais privilegiado que seja.

CLÁUSULA 10 – DISPOSIÇÕES FINAIS
10.1. Este contrato é celebrado em caráter irrevogável e irretratável.
10.2. As partes declaram ter lido, compreendido e aceito todas as cláusulas.`;
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

async function generateSignedPDF(d: SignatureData, signatureDataUrl: string): Promise<string> {
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
    if (opts?.center) {
      const lines = doc.splitTextToSize(text, maxWidth);
      for (const line of lines) {
        if (y > 275) { doc.addPage(); addWatermark(); y = 20; }
        const lineWidth = doc.getTextWidth(line);
        doc.text(line, (pageWidth - lineWidth) / 2, y);
        y += size * 0.45;
      }
    } else {
      const lines = doc.splitTextToSize(text, maxWidth);
      for (const line of lines) {
        if (y > 275) { doc.addPage(); addWatermark(); y = 20; }
        doc.text(line, x, y);
        y += size * 0.45;
      }
    }
  };
  const addSpace = (h = 4) => { y += h; };
  const checkPage = () => { if (y > 270) { doc.addPage(); addWatermark(); y = 20; } };

  const depositValue = (d.total_value * d.deposit_percent) / 100;
  const remainingPercent = 100 - d.deposit_percent;
  const remainingValue = d.total_value - depositValue;
  const now = new Date();
  const months = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const sigDate = `${now.getDate()} de ${months[now.getMonth()]} de ${now.getFullYear()}`;

  addText("CONTRATO DE LOCAÇÃO DE ESPAÇO PARA EVENTO", { bold: true, size: 14, center: true });
  addSpace(6);
  addText("Pelo presente instrumento particular, as partes abaixo identificadas:");
  addSpace(5);
  addText("LOCADOR:", { bold: true, size: 12 }); addSpace(2);
  addText("Nome: Espaço Lamoniê");
  addText("CNPJ: 61.075.137/0001-08");
  addText("Endereço: Rua Cascadura, nº 380, Botafogo (Justinópolis), Ribeirão das Neves – MG");
  addText("Telefone: (31) 99711-1502");
  addSpace(5);
  addText("LOCATÁRIO:", { bold: true, size: 12 }); addSpace(2);
  addText(`Nome: ${d.client_name}`);
  addText(`CPF: ${d.client_cpf || "Não informado"}`);
  addText(`Endereço: ${d.client_address || "Não informado"}`);
  addText(`Telefone: ${d.client_phone || "Não informado"}`);
  addSpace(5);
  addText("Têm entre si justo e contratado o seguinte:");
  addSpace(5);

  checkPage();
  addText("CLÁUSULA 1 – DO OBJETO", { bold: true, size: 12 }); addSpace(2);
  addText(`1.1. O presente contrato tem por objeto a locação do espaço físico do Espaço Lamoniê, exclusivamente para realização de evento privado, sem fins lucrativos, na data ${formatDate(d.event_date)}, no horário de dia inteiro, com devolução das chaves dentro do horário acordado.`);
  addSpace(5);

  checkPage();
  addText("CLÁUSULA 2 – DO VALOR E FORMA DE PAGAMENTO", { bold: true, size: 12 }); addSpace(2);
  addText(`2.1. O valor total da locação é de ${fmt(d.total_value)}.`);
  addText("2.2. Será pago:");
  addText(`• Cliente optou em dar um sinal de ${d.deposit_percent}% (${fmt(depositValue)}) no ato da assinatura deste contrato, a título de sinal;`, { indent: 5 });
  addText(`• ${remainingPercent}% (${fmt(remainingValue)}) até 7 dias antes da data do evento.`, { indent: 5 });
  addText("2.3. O pagamento será realizado via Pix ou depósito bancário.");
  addText("2.4. O sinal pago não será devolvido, exceto nas hipóteses previstas neste contrato.");
  addSpace(5);

  checkPage();
  addText("CLÁUSULA 3 – DO CANCELAMENTO", { bold: true, size: 12 }); addSpace(2);
  addText("3.1. Em caso de cancelamento pelo LOCATÁRIO:");
  addText("• Com até 15 dias de antecedência, será permitido remarcar o evento, sujeito à disponibilidade;", { indent: 5 });
  addText("• Com prazo inferior a 15 dias, não haverá devolução de valores.", { indent: 5 });
  addText("3.2. Em caso de cancelamento pelo LOCADOR por motivo de força maior, todos os valores pagos serão integralmente devolvidos.");
  addSpace(5);

  checkPage();
  addText("CLÁUSULA 4 – DO USO DO ESPAÇO", { bold: true, size: 12 }); addSpace(2);
  addText("4.1. O espaço destina-se exclusivamente a eventos privados, sendo vedada qualquer atividade comercial, cobrança de ingressos ou divulgação pública.");
  addText("4.2. A capacidade máxima é de 120 pessoas, sendo o controle de público de responsabilidade do LOCATÁRIO.");
  addText("4.3. O uso de som será restrito a som ambiente já instalado no espaço para utilização, sendo proibidos DJs, bandas ou equipamentos profissionais.");
  addSpace(5);

  checkPage();
  addText("CLÁUSULA 5 – DA RESPONSABILIDADE", { bold: true, size: 12 }); addSpace(2);
  addText("5.1. O LOCATÁRIO se responsabiliza integralmente por:");
  addText("• Danos causados ao espaço, mobiliário ou equipamentos;", { indent: 5 });
  addText("• Conduta de convidados;", { indent: 5 });
  addText("• Cumprimento das normas de segurança.", { indent: 5 });
  addText("5.2. Fica expressamente proibido:");
  addText("• Uso de garrafas de vidro;", { indent: 5 });
  addText("• Drogas ilícitas;", { indent: 5 });
  addText("• Brigas, excessos ou comportamento ofensivo;", { indent: 5 });
  addText("• Fogos, narguilé, cigarro comum ou eletrônico em área interna.", { indent: 5 });
  addSpace(5);

  checkPage();
  addText("CLÁUSULA 6 – DA LIMPEZA", { bold: true, size: 12 }); addSpace(2);
  addText("6.1. O espaço será entregue limpo e deverá ser devolvido nas mesmas condições.");
  addText("6.2. A não realização da limpeza implicará cobrança de R$ 250,00.");
  addSpace(5);

  checkPage();
  addText("CLÁUSULA 7 – DAS PENALIDADES", { bold: true, size: 12 }); addSpace(2);
  addText("7.1. O descumprimento de qualquer cláusula autoriza:");
  addText("• Encerramento imediato do evento;", { indent: 5 });
  addText("• Aplicação de multa equivalente a 20% do valor total do contrato;", { indent: 5 });
  addText("• Cobrança integral de danos apurados.", { indent: 5 });
  addSpace(5);

  checkPage();
  addText("CLÁUSULA 8 – CASO FORTUITO E FORÇA MAIOR", { bold: true, size: 12 }); addSpace(2);
  addText("8.1. Nenhuma das partes será responsabilizada por eventos imprevisíveis ou inevitáveis, como queda de energia, fenômenos naturais ou atos de autoridade pública.");
  addSpace(5);

  checkPage();
  addText("CLÁUSULA 9 – DO FORO", { bold: true, size: 12 }); addSpace(2);
  addText("9.1. Fica eleito o foro da Comarca de Ribeirão das Neves – MG, renunciando a qualquer outro, por mais privilegiado que seja.");
  addSpace(5);

  checkPage();
  addText("CLÁUSULA 10 – DISPOSIÇÕES FINAIS", { bold: true, size: 12 }); addSpace(2);
  addText("10.1. Este contrato é celebrado em caráter irrevogável e irretratável.");
  addText("10.2. As partes declaram ter lido, compreendido e aceito todas as cláusulas.");
  addSpace(8);

  addText(`Ribeirão das Neves – MG, ${sigDate}.`);
  addSpace(15);

  // Client signature with drawn rubric
  checkPage();
  if (y + 40 > 275) { doc.addPage(); addWatermark(); y = 20; }

  // Add the drawn signature image
  try {
    doc.addImage(signatureDataUrl, "PNG", margin, y, 60, 25);
  } catch {
    // fallback if image fails
  }
  y += 28;
  doc.setDrawColor(0);
  doc.line(margin, y, margin + 70, y);
  y += 5;
  addText("LOCATÁRIO");
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(100, 100, 100);
  doc.text(`Assinado digitalmente em ${sigDate} às ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`, margin, y);
  doc.setTextColor(0, 0, 0);
  addSpace(12);

  // Locador signature
  checkPage();
  doc.line(margin, y, margin + 70, y);
  y += 5;
  addText("LOCADOR – Espaço Lamoniê", { bold: true });
  addSpace(1);
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(100, 100, 100);
  doc.text(`Assinado digitalmente em ${sigDate}`, margin, y);
  doc.setTextColor(0, 0, 0);

  // Return as base64
  return doc.output("datauristring");
}

export default function SignContract() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [data, setData] = useState<SignatureData | null>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [error, setError] = useState("");
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contractScrollRef = useRef<HTMLDivElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const FUNC_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sign-contract`;

  useEffect(() => {
    if (!token) { setError("Link inválido"); setLoading(false); return; }
    fetch(`${FUNC_URL}?token=${token}`, {
      headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); }
        else {
          setData(d);
          if (d.status === "signed") setSigned(true);
        }
      })
      .catch(() => setError("Erro ao carregar contrato"))
      .finally(() => setLoading(false));
  }, [token]);

  // Scroll tracking
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 30) {
      setHasScrolledToBottom(true);
    }
  }, []);

  // Canvas drawing
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
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getCanvasPos(e);
    ctx.strokeStyle = "#1a1a2e";
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
      if (canvas) {
        setSignatureDataUrl(canvas.toDataURL("image/png"));
      }
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
    if (!token || !data) return;
    if (isCanvasEmpty()) {
      setError("Desenhe sua assinatura/rubrica antes de assinar");
      return;
    }
    setSigning(true);
    setError("");
    try {
      // Generate signed PDF with client signature
      const sigDataUrl = canvasRef.current!.toDataURL("image/png");
      const pdfDataUri = await generateSignedPDF(data, sigDataUrl);
      // Extract raw base64 from data URI (jsPDF includes filename= in the URI)
      const rawBase64 = pdfDataUri.split(",")[1];

      const res = await fetch(FUNC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ token, pdf_base64: rawBase64, user_agent: navigator.userAgent }),
      });
      const result = await res.json();
      if (result.error) { setError(result.error); }
      else { setSigned(true); }
    } catch { setError("Erro ao assinar contrato"); }
    finally { setSigning(false); }
  };

  const depositValue = data ? (Number(data.total_value) * Number(data.deposit_percent)) / 100 : 0;
  const canSign = hasScrolledToBottom && signatureDataUrl && !isCanvasEmpty();

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <img src="/images/logo-lamonie.png" alt="Espaço Lamoniê" className="h-16 mx-auto mb-3" />
          <h1 className="text-xl font-bold text-gray-800">Assinatura de Contrato</h1>
          <p className="text-sm text-gray-500">Espaço Lamoniê</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-amber-600" />
            </div>
          )}

          {error && !data && !loading && (
            <div className="p-8 text-center">
              <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-3" />
              <p className="text-red-600 font-medium">{error}</p>
            </div>
          )}

          {signed && (
            <div className="p-8 text-center">
              <div className="bg-green-50 rounded-full h-20 w-20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-10 w-10 text-green-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Contrato Assinado!</h2>
              <p className="text-sm text-gray-500 mb-4">
                Sua assinatura foi registrada com sucesso. O Espaço Lamoniê entrará em contato para confirmar os detalhes do seu evento.
              </p>
              {data && (
                <div className="bg-gray-50 rounded-xl p-4 text-left space-y-1 text-sm">
                  <p><span className="text-gray-500">Evento:</span> <span className="font-medium">{data.event_type}</span></p>
                  <p><span className="text-gray-500">Data:</span> <span className="font-medium">{formatDate(data.event_date)}</span></p>
                </div>
              )}
            </div>
          )}

          {data && !signed && !loading && (
            <div>
              {/* Contract summary header */}
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center gap-2 text-amber-700 bg-amber-50 rounded-lg px-3 py-2 text-sm">
                  <FileText size={16} />
                  <span className="font-medium">Contrato de Locação – Espaço Lamoniê</span>
                </div>
                <div className="mt-3 bg-gray-50 rounded-xl p-3 space-y-1.5 text-sm">
                  <Row label="Cliente" value={data.client_name} />
                  {data.client_cpf && <Row label="CPF" value={data.client_cpf} />}
                  <Row label="Evento" value={data.event_type} />
                  <Row label="Data" value={formatDate(data.event_date)} />
                  <hr className="border-gray-200" />
                  <Row label="Valor Total" value={fmt(data.total_value)} bold />
                  <Row label={`Sinal (${data.deposit_percent}%)`} value={fmt(depositValue)} />
                  <Row label="Restante" value={fmt(Number(data.total_value) - depositValue)} />
                </div>
              </div>

              {/* Full contract text - must scroll to bottom */}
              <div className="p-4 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                  📄 Leia o contrato completo abaixo
                </p>
                <div
                  ref={contractScrollRef}
                  onScroll={handleScroll}
                  className="bg-gray-50 rounded-xl p-4 max-h-[40vh] overflow-y-auto border border-gray-200 text-sm leading-relaxed whitespace-pre-wrap font-sans text-gray-700"
                >
                  {buildContractText(data)}
                </div>
                {!hasScrolledToBottom && (
                  <div className="flex items-center justify-center gap-1.5 mt-2 text-amber-600 text-xs animate-bounce">
                    <ChevronDown size={14} />
                    <span>Role até o final para liberar a assinatura</span>
                    <ChevronDown size={14} />
                  </div>
                )}
                {hasScrolledToBottom && (
                  <div className="flex items-center gap-1.5 mt-2 text-green-600 text-xs">
                    <CheckCircle size={14} />
                    <span>Contrato lido ✓</span>
                  </div>
                )}
              </div>

              {/* Signature canvas */}
              <div className="p-4 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                  ✍️ Assine abaixo (desenhe sua rubrica)
                </p>
                <div className={`relative rounded-xl border-2 border-dashed ${hasScrolledToBottom ? "border-amber-300 bg-white" : "border-gray-200 bg-gray-50 opacity-50 pointer-events-none"}`}>
                  <canvas
                    ref={canvasRef}
                    width={600}
                    height={200}
                    className="w-full h-[120px] sm:h-[150px] cursor-crosshair touch-none"
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                  />
                  {!signatureDataUrl && hasScrolledToBottom && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-gray-300 text-sm">
                      Desenhe sua assinatura aqui
                    </div>
                  )}
                </div>
                {signatureDataUrl && (
                  <button
                    onClick={clearCanvas}
                    className="mt-1.5 text-xs text-amber-600 hover:text-amber-700 underline"
                  >
                    Limpar assinatura
                  </button>
                )}
              </div>

              {/* Legal notice + sign button */}
              <div className="p-4">
                <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700 flex items-start gap-2 mb-4">
                  <ShieldCheck size={16} className="shrink-0 mt-0.5" />
                  <span>
                    Ao assinar, você declara que leu, compreendeu e aceita todas as 10 cláusulas do contrato de locação do Espaço Lamoniê conforme apresentado.
                  </span>
                </div>

                {error && (
                  <p className="text-sm text-red-600 mb-3">{error}</p>
                )}

                <Button
                  onClick={handleSign}
                  disabled={signing || !canSign}
                  className="w-full h-12 text-base font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-xl gap-2 disabled:opacity-50"
                >
                  {signing ? (
                    <><Loader2 className="h-5 w-5 animate-spin" /> Assinando...</>
                  ) : (
                    <><CheckCircle size={18} /> Assinar Contrato</>
                  )}
                </Button>
                {!canSign && !signing && (
                  <p className="text-xs text-gray-400 text-center mt-2">
                    {!hasScrolledToBottom ? "Leia o contrato completo para liberar a assinatura" : "Desenhe sua assinatura/rubrica acima"}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Espaço Lamoniê • Rua Cascadura, 380 • Ribeirão das Neves – MG
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={bold ? "font-bold text-gray-800" : "font-medium text-gray-700"}>{value}</span>
    </div>
  );
}
