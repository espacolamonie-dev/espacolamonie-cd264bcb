import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle, FileText, Loader2, AlertTriangle, ShieldCheck,
  Users, Clock, Sparkles, Volume2, Car, PawPrint, Cigarette, Palette, Info
} from "lucide-react";
import { jsPDF } from "jspdf";
import SignBudget from "@/pages/SignBudget";
import SignContractPayment from "@/components/SignContractPayment";

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
  event_date_end: string | null;
  rental_type: string;
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
1.1. O presente contrato tem por objeto a locação do espaço físico do Espaço Lamoniê, exclusivamente para realização de evento privado, sem fins lucrativos, ${d.rental_type === "Locação (2 dias)" && d.event_date_end ? `na modalidade de Locação de 2 (dois) dias, compreendendo os dias ${formatDate(d.event_date)} e ${formatDate(d.event_date_end)}` : `na data ${formatDate(d.event_date)}`}, no horário de dia inteiro, com devolução das chaves dentro do horário acordado.

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
4.2. A capacidade máxima é de 150 pessoas, sendo o controle de público de responsabilidade do LOCATÁRIO.
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
  const dateClausePdf = d.rental_type === "Locação (2 dias)" && d.event_date_end
    ? `na modalidade de Locação de 2 (dois) dias, compreendendo os dias ${formatDate(d.event_date)} e ${formatDate(d.event_date_end)}`
    : `na data ${formatDate(d.event_date)}`;
  addText(`1.1. O presente contrato tem por objeto a locação do espaço físico do Espaço Lamoniê, exclusivamente para realização de evento privado, sem fins lucrativos, ${dateClausePdf}, no horário de dia inteiro, com devolução das chaves dentro do horário acordado.`);
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
  addText("4.2. A capacidade máxima é de 150 pessoas, sendo o controle de público de responsabilidade do LOCATÁRIO.");
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

  const sigBlockHeight = 70;
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
  addText("LOCATÁRIO");
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(100, 100, 100);
  doc.text(`Assinado digitalmente em ${sigDate} às ${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`, margin, y);
  doc.setTextColor(0, 0, 0);
  y += 12;

  doc.line(margin, y, margin + 70, y);
  y += 5;
  addText("LOCADOR – Espaço Lamoniê", { bold: true });
  y += 1;
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(100, 100, 100);
  doc.text(`Assinado digitalmente em ${sigDate}`, margin, y);
  doc.setTextColor(0, 0, 0);

  return doc.output("datauristring");
}

/* ─── Rules data ─── */
const RULES = [
  {
    icon: Users,
    title: "Capacidade máxima",
    description: "Nos finais de semana o espaço comporta até 150 pessoas. Durante a semana, o limite é de 100 pessoas. Esse número deve ser respeitado por segurança e conforto.",
  },
  {
    icon: Clock,
    title: "Horários",
    description: "Quinta e sexta: das 09h às 21h. Sábado e domingo: até 12 horas de evento dentro do horário permitido. O evento deve terminar dentro do horário combinado em contrato.",
  },
  {
    icon: Sparkles,
    title: "Entrega e limpeza",
    description: "O espaço deve ser devolvido organizado e limpo. Caso seja necessário realizar limpeza extra, será cobrada taxa de R$ 250,00.",
  },
  {
    icon: Volume2,
    title: "Som e ruído",
    description: "O volume deve ser mantido em nível moderado. É obrigatório respeitar a vizinhança e os horários legais da cidade.",
  },
  {
    icon: Car,
    title: "Estacionamento",
    description: "O estacionamento é realizado na rua, em frente ao local.",
  },
  {
    icon: PawPrint,
    title: "Animais",
    description: "Não é permitida a entrada de animais no espaço do evento.",
  },
  {
    icon: Cigarette,
    title: "Fumantes",
    description: "É proibido fumar em áreas cobertas. Utilize apenas as áreas externas permitidas.",
  },
  {
    icon: Palette,
    title: "Decoração",
    description: "A decoração é permitida desde que não danifique o espaço. Não é permitido usar pregos, parafusos ou fitas que prejudiquem paredes e estrutura.",
  },
];

/* ─── Component ─── */
export default function SignContract() {
  const [searchParams] = useSearchParams();
  const { slug } = useParams();
  const token = searchParams.get("token");
  const [data, setData] = useState<SignatureData | null>(null);
  const [budgetData, setBudgetData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const [error, setError] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // Rule checkboxes
  const [checkedRules, setCheckedRules] = useState<boolean[]>(new Array(RULES.length).fill(false));
  const allRulesChecked = checkedRules.every(Boolean);

  // Step: 1=Leitura, 2=Aceite, 3=Assinatura, 4=Pagamento, 5=Conclusão
  const [showSignature, setShowSignature] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  const currentStep = signed ? 5 : showPayment ? 4 : showSignature ? 3 : allRulesChecked ? 2 : 1;
  const stepProgress = signed ? 100 : showPayment ? 80 : showSignature ? 60 : allRulesChecked ? 40 : (checkedRules.filter(Boolean).length / RULES.length) * 20;

  const FUNC_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sign-contract`;

  useEffect(() => {
    const queryParam = slug ? `slug=${encodeURIComponent(slug)}` : token ? `token=${token}` : "";
    if (!queryParam) { setError("Link inválido"); setLoading(false); return; }
    fetch(`${FUNC_URL}?${queryParam}`, {
      headers: { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); }
        else {
          // If this is a budget signature (has budget_id, no contract_id), use budget flow
          if (d.budget_id && !d.contract_id) {
            setBudgetData(d);
          } else {
            setData(d);
          }
          if (d.status === "signed") setSigned(true);
        }
      })
      .catch(() => setError("Erro ao carregar contrato"))
      .finally(() => setLoading(false));
  }, [token, slug]);

  // If it's a budget signature, render SignBudget component
  if (budgetData && !loading) {
    return <SignBudget data={budgetData} />;
  }

  const toggleRule = (index: number) => {
    setCheckedRules(prev => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  /* ─── Canvas drawing ─── */
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
    const sigToken = data.token;
    if (!sigToken) { setError("Token de assinatura não encontrado"); return; }
    if (isCanvasEmpty()) { setError("Desenhe sua assinatura/rubrica antes de assinar"); return; }
    setSigning(true);
    setError("");
    try {
      const sigDataUrl = canvasRef.current!.toDataURL("image/png");
      const pdfDataUri = await generateSignedPDF(data, sigDataUrl);
      const rawBase64 = pdfDataUri.split(",")[1];

      const res = await fetch(FUNC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ token: sigToken, pdf_base64: rawBase64, user_agent: navigator.userAgent }),
      });
      const result = await res.json();
      if (result.error) { setError(result.error); }
      else { setShowPayment(true); }
    } catch { setError("Erro ao assinar contrato"); }
    finally { setSigning(false); }
  };

  const depositValue = data ? (Number(data.total_value) * Number(data.deposit_percent)) / 100 : 0;
  const canSign = showSignature && signatureDataUrl && !isCanvasEmpty();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="text-center pt-8 pb-4 px-4">
        <img src="/images/logo-lamonie.png" alt="Espaço Lamoniê" className="h-14 mx-auto mb-4 drop-shadow-sm" />
        <h1 className="text-2xl font-display font-semibold text-foreground tracking-tight">Assinatura de Contrato</h1>
        <p className="text-sm text-muted-foreground mt-1">Espaço Lamoniê — Contrato de Locação</p>
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-10">
        {/* Progress bar */}
        {data && !loading && !error && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <StepDot step={1} current={currentStep} label="Leitura" />
              <div className="flex-1 h-px bg-border" />
              <StepDot step={2} current={currentStep} label="Aceite" />
              <div className="flex-1 h-px bg-border" />
              <StepDot step={3} current={currentStep} label="Assinatura" />
              <div className="flex-1 h-px bg-border" />
              <StepDot step={4} current={currentStep} label="Conclusão" />
            </div>
            <Progress value={stepProgress} className="h-1.5" />
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {error && !data && !loading && (
          <div className="bg-card rounded-2xl shadow-lg border border-border p-10 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-3" />
            <p className="text-destructive font-medium">{error}</p>
          </div>
        )}

        {/* ═══ SIGNED STATE ═══ */}
        {signed && data && (
          <div className="bg-card rounded-2xl shadow-lg border border-border p-10 text-center">
            <div className="bg-success/10 rounded-full h-20 w-20 flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="h-10 w-10 text-success" />
            </div>
            <h2 className="text-2xl font-display font-semibold text-foreground mb-2">Contrato assinado com sucesso</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Sua assinatura foi registrada. O Espaço Lamoniê entrará em contato para confirmar os detalhes do seu evento.
            </p>
            <div className="bg-secondary rounded-xl p-5 text-left space-y-2 text-sm max-w-sm mx-auto">
              <Row label="Evento" value={data.event_type} />
              <Row label="Data" value={
                data.rental_type === "Locação (2 dias)" && data.event_date_end
                  ? `${formatDate(data.event_date)} – ${formatDate(data.event_date_end)}`
                  : formatDate(data.event_date)
              } />
            </div>
          </div>
        )}

        {/* ═══ MAIN FLOW ═══ */}
        {data && !signed && !loading && (
          <div className="space-y-5">
            {/* 1 — Contract summary card */}
            <div className="bg-card rounded-2xl shadow-lg border border-border overflow-hidden">
              <div className="flex items-center gap-2 text-primary bg-secondary px-5 py-3 text-sm border-b border-border">
                <FileText size={16} />
                <span className="font-medium">Contrato de Locação — Espaço Lamoniê</span>
              </div>
              <div className="p-5 space-y-2 text-sm">
                <Row label="Cliente" value={data.client_name} />
                {data.client_cpf && <Row label="CPF" value={data.client_cpf} />}
                <Row label="Evento" value={data.event_type} />
                <Row label="Modalidade" value={data.rental_type || "Locação (1 dia)"} />
                <Row label="Data" value={
                  data.rental_type === "Locação (2 dias)" && data.event_date_end
                    ? `${formatDate(data.event_date)} – ${formatDate(data.event_date_end)}`
                    : formatDate(data.event_date)
                } />
                <div className="border-t border-border my-2" />
                <Row label="Valor Total" value={fmt(data.total_value)} bold />
                <Row label={`Sinal (${data.deposit_percent}%)`} value={fmt(depositValue)} />
                <Row label="Restante" value={fmt(Number(data.total_value) - depositValue)} />
              </div>
            </div>

            {/* 2 — Rules section */}
            <div>
              <h2 className="text-lg font-display font-semibold text-foreground mb-1">📋 Como funciona o Espaço Lamoniê</h2>
              <p className="text-xs text-muted-foreground mb-4">Leia cada regra e marque a caixa de concordância para continuar.</p>

              <div className="grid gap-3">
                {RULES.map((rule, i) => {
                  const Icon = rule.icon;
                  return (
                    <div
                      key={i}
                      className={`bg-card rounded-xl border transition-all ${
                        checkedRules[i] ? "border-primary/40 shadow-sm" : "border-border"
                      } p-4`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="shrink-0 h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center mt-0.5">
                          <Icon size={18} className="text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm text-foreground mb-1">{rule.title}</h3>
                          <p className="text-xs text-muted-foreground leading-relaxed">{rule.description}</p>
                        </div>
                      </div>
                      <label className="flex items-center gap-2 mt-3 ml-12 cursor-pointer group">
                        <Checkbox
                          checked={checkedRules[i]}
                          onCheckedChange={() => toggleRule(i)}
                        />
                        <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                          Li e concordo com esta regra
                        </span>
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3 — Important info card */}
            <div className="bg-card rounded-xl border-2 border-warning/30 p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 rounded-lg bg-warning/15 flex items-center justify-center">
                  <Info size={16} className="text-warning" />
                </div>
                <h3 className="font-display font-semibold text-sm text-foreground">Informações Importantes</h3>
              </div>
              <ul className="space-y-2 text-xs text-muted-foreground leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="text-warning mt-0.5">•</span>
                  O sinal ({data.deposit_percent}%) garante a reserva da data e não é reembolsável, salvo condições previstas em contrato
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-warning mt-0.5">•</span>
                  Cancelamentos devem ser comunicados com no mínimo 15 dias de antecedência
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-warning mt-0.5">•</span>
                  O contratante é responsável por quaisquer danos causados ao espaço
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-warning mt-0.5">•</span>
                  Taxa de limpeza: R$ 250,00 se o local não for devolvido conforme entregue
                </li>
              </ul>
            </div>

            {/* 4 — Continue / Signature area */}
            {!showSignature ? (
              <div className="text-center">
                <Button
                  onClick={() => setShowSignature(true)}
                  disabled={!allRulesChecked}
                  className="w-full h-12 text-base font-semibold rounded-xl gap-2 disabled:opacity-40"
                >
                  Continuar para assinatura
                </Button>
                {!allRulesChecked && (
                  <p className="text-xs text-muted-foreground mt-3">
                    Marque todas as regras acima para continuar ({checkedRules.filter(Boolean).length}/{RULES.length})
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-card rounded-2xl shadow-lg border border-border overflow-hidden">
                <div className="p-5">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                    Assine abaixo
                  </p>
                  <div className="relative rounded-xl border-2 border-dashed border-primary/40 bg-card">
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
                    {!signatureDataUrl && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-muted-foreground/40 text-sm">
                        Desenhe sua rubrica aqui
                      </div>
                    )}
                  </div>
                  {signatureDataUrl && (
                    <button
                      onClick={clearCanvas}
                      className="mt-2 text-xs text-primary hover:text-primary/80 underline underline-offset-2 transition-colors"
                    >
                      Limpar assinatura
                    </button>
                  )}
                </div>

                <div className="px-5 pb-5">
                  <div className="bg-primary/5 rounded-xl p-4 text-xs text-foreground/70 flex items-start gap-2.5 mb-4 border border-primary/10">
                    <ShieldCheck size={16} className="shrink-0 mt-0.5 text-primary" />
                    <span>
                      Ao assinar, você declara que leu, compreendeu e aceita todas as cláusulas do contrato de locação do Espaço Lamoniê.
                    </span>
                  </div>

                  {error && <p className="text-sm text-destructive mb-3 font-medium">{error}</p>}

                  <Button
                    onClick={handleSign}
                    disabled={signing || !canSign}
                    className="w-full h-12 text-base font-semibold rounded-xl gap-2 disabled:opacity-40"
                  >
                    {signing ? (
                      <><Loader2 className="h-5 w-5 animate-spin" /> Assinando...</>
                    ) : (
                      <><CheckCircle size={18} /> Assinar contrato</>
                    )}
                  </Button>
                  {!canSign && !signing && (
                    <p className="text-xs text-muted-foreground text-center mt-3">
                      Desenhe sua rubrica acima para continuar
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <p className="text-center text-[11px] text-muted-foreground mt-8 tracking-wide">
          Espaço Lamoniê • Rua Cascadura, 380 • Ribeirão das Neves – MG
        </p>
      </div>
    </div>
  );
}

function StepDot({ step, current, label }: { step: number; current: number; label: string }) {
  const done = current >= step;
  return (
    <div className="flex items-center gap-1.5">
      <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-semibold transition-colors ${
        done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
      }`}>
        {done && current > step ? "✓" : step}
      </div>
      <span className={`hidden sm:inline text-xs ${done ? "text-foreground font-medium" : "text-muted-foreground"}`}>{label}</span>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? "font-bold text-foreground" : "font-medium text-foreground"}>{value}</span>
    </div>
  );
}
