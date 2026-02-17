import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { FileText, Send, CheckCircle, Phone, Download, Link } from "lucide-react";
import { jsPDF } from "jspdf";
import { addDocumentFromBlob, updateContract } from "@/data/store";
import { supabase } from "@/integrations/supabase/client";
import { formatFullAddress } from "@/types";
import type { Contract, Client } from "@/types";

interface Props {
  contract: Contract;
  client: Client;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated: () => void;
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("pt-BR");
}

function formatDateFull(dateStr: string) {
  const d = new Date(dateStr + "T12:00:00");
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
}

function buildContractText(contract: Contract, client: Client): string {
  const clientAddress = client.addressStreet ? formatFullAddress(client).replace(/\n/g, ", ") : client.address || "Não informado";
  const depositValue = (contract.totalValue * contract.depositPercent) / 100;
  const remainingPercent = 100 - contract.depositPercent;
  const remainingValue = contract.totalValue - depositValue;
  const today = new Date();
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  const sigDate = `${today.getDate()} de ${months[today.getMonth()]} de ${today.getFullYear()}`;

  return `CONTRATO DE LOCAÇÃO DE ESPAÇO PARA EVENTO

Pelo presente instrumento particular, as partes abaixo identificadas:

LOCADOR:
Nome: Espaço Lamoniê
CNPJ: 61.075.137/0001-08
Endereço: Rua Cascadura, nº 380, Botafogo (Justinópolis), Ribeirão das Neves – MG
Telefone: (31) 99711-1502

LOCATÁRIO:
Nome: ${client.name}
CPF: ${client.cpf || "Não informado"}
Endereço: ${clientAddress}
Telefone: ${client.phone || "Não informado"}

Têm entre si justo e contratado o seguinte:

CLÁUSULA 1 – DO OBJETO
1.1. O presente contrato tem por objeto a locação do espaço físico do Espaço Lamoniê, exclusivamente para realização de evento privado, sem fins lucrativos, na data ${formatDate(contract.eventDate)}, no horário de dia inteiro, com devolução das chaves dentro do horário acordado.

CLÁUSULA 2 – DO VALOR E FORMA DE PAGAMENTO
2.1. O valor total da locação é de ${fmt(contract.totalValue)}.
2.2. Será pago:
• Cliente optou em dar um sinal de ${contract.depositPercent}% (${fmt(depositValue)}) no ato da assinatura deste contrato, a título de sinal;
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
10.2. As partes declaram ter lido, compreendido e aceito todas as cláusulas.

Ribeirão das Neves – MG, ${sigDate}.


__________________________________
LOCATÁRIO


__________________________________
LOCADOR – Espaço Lamoniê (Assinado digitalmente)`;
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

async function generatePDF(contract: Contract, client: Client): Promise<Blob> {
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
    const size = opts?.size || 10;
    const style = opts?.bold ? "bold" : "normal";
    doc.setFontSize(size);
    doc.setFont("helvetica", style);
    const x = margin + (opts?.indent || 0);
    const maxWidth = usableWidth - (opts?.indent || 0);
    if (opts?.center) {
      const lines = doc.splitTextToSize(text, maxWidth);
      for (const line of lines) {
        if (y > 280) { doc.addPage(); addWatermark(); y = 20; }
        const lineWidth = doc.getTextWidth(line);
        doc.text(line, (pageWidth - lineWidth) / 2, y);
        y += size * 0.42;
      }
    } else {
      const lines = doc.splitTextToSize(text, maxWidth);
      for (const line of lines) {
        if (y > 280) { doc.addPage(); addWatermark(); y = 20; }
        doc.text(line, x, y);
        y += size * 0.42;
      }
    }
  };

  const addSpace = (h = 3) => { y += h; };
  const checkPage = () => { if (y > 275) { doc.addPage(); addWatermark(); y = 20; } };

  const depositValue = (contract.totalValue * contract.depositPercent) / 100;
  const remainingPercent = 100 - contract.depositPercent;
  const remainingValue = contract.totalValue - depositValue;
  const today = new Date();
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];
  const sigDate = `${today.getDate()} de ${months[today.getMonth()]} de ${today.getFullYear()}`;

  addText("CONTRATO DE LOCAÇÃO DE ESPAÇO PARA EVENTO", { bold: true, size: 13, center: true });
  addSpace(4);
  addText("Pelo presente instrumento particular, as partes abaixo identificadas:");
  addSpace(3);

  addText("LOCADOR:", { bold: true, size: 11 });
  addSpace(1);
  addText("Nome: Espaço Lamoniê");
  addText("CNPJ: 61.075.137/0001-08");
  addText("Endereço: Rua Cascadura, nº 380, Botafogo (Justinópolis), Ribeirão das Neves – MG");
  addText("Telefone: (31) 99711-1502");
  addSpace(3);

  addText("LOCATÁRIO:", { bold: true, size: 11 });
  addSpace(1);
  addText(`Nome: ${client.name}`);
  addText(`CPF: ${client.cpf || "Não informado"}`);
  const clientAddressPdf = client.addressStreet ? formatFullAddress(client).replace(/\n/g, ", ") : client.address || "Não informado";
  addText(`Endereço: ${clientAddressPdf}`);
  addText(`Telefone: ${client.phone || "Não informado"}`);
  addSpace(3);

  addText("Têm entre si justo e contratado o seguinte:");
  addSpace(3);

  checkPage();
  addText("CLÁUSULA 1 – DO OBJETO", { bold: true, size: 11 });
  addSpace(1);
  addText(`1.1. O presente contrato tem por objeto a locação do espaço físico do Espaço Lamoniê, exclusivamente para realização de evento privado, sem fins lucrativos, na data ${formatDate(contract.eventDate)}, no horário de dia inteiro, com devolução das chaves dentro do horário acordado.`);
  addSpace(3);

  checkPage();
  addText("CLÁUSULA 2 – DO VALOR E FORMA DE PAGAMENTO", { bold: true, size: 11 });
  addSpace(1);
  addText(`2.1. O valor total da locação é de ${fmt(contract.totalValue)}.`);
  addText("2.2. Será pago:");
  addText(`• Cliente optou em dar um sinal de ${contract.depositPercent}% (${fmt(depositValue)}) no ato da assinatura deste contrato, a título de sinal;`, { indent: 5 });
  addText(`• ${remainingPercent}% (${fmt(remainingValue)}) até 7 dias antes da data do evento.`, { indent: 5 });
  addText("2.3. O pagamento será realizado via Pix ou depósito bancário.");
  addText("2.4. O sinal pago não será devolvido, exceto nas hipóteses previstas neste contrato.");
  addSpace(3);

  checkPage();
  addText("CLÁUSULA 3 – DO CANCELAMENTO", { bold: true, size: 11 });
  addSpace(1);
  addText("3.1. Em caso de cancelamento pelo LOCATÁRIO:");
  addText("• Com até 15 dias de antecedência, será permitido remarcar o evento, sujeito à disponibilidade;", { indent: 5 });
  addText("• Com prazo inferior a 15 dias, não haverá devolução de valores.", { indent: 5 });
  addText("3.2. Em caso de cancelamento pelo LOCADOR por motivo de força maior, todos os valores pagos serão integralmente devolvidos.");
  addSpace(3);

  checkPage();
  addText("CLÁUSULA 4 – DO USO DO ESPAÇO", { bold: true, size: 11 });
  addSpace(1);
  addText("4.1. O espaço destina-se exclusivamente a eventos privados, sendo vedada qualquer atividade comercial, cobrança de ingressos ou divulgação pública.");
  addText("4.2. A capacidade máxima é de 120 pessoas, sendo o controle de público de responsabilidade do LOCATÁRIO.");
  addText("4.3. O uso de som será restrito a som ambiente já instalado no espaço para utilização, sendo proibidos DJs, bandas ou equipamentos profissionais.");
  addSpace(3);

  checkPage();
  addText("CLÁUSULA 5 – DA RESPONSABILIDADE", { bold: true, size: 11 });
  addSpace(1);
  addText("5.1. O LOCATÁRIO se responsabiliza integralmente por:");
  addText("• Danos causados ao espaço, mobiliário ou equipamentos;", { indent: 5 });
  addText("• Conduta de convidados;", { indent: 5 });
  addText("• Cumprimento das normas de segurança.", { indent: 5 });
  addText("5.2. Fica expressamente proibido:");
  addText("• Uso de garrafas de vidro;", { indent: 5 });
  addText("• Drogas ilícitas;", { indent: 5 });
  addText("• Brigas, excessos ou comportamento ofensivo;", { indent: 5 });
  addText("• Fogos, narguilé, cigarro comum ou eletrônico em área interna.", { indent: 5 });
  addSpace(3);

  checkPage();
  addText("CLÁUSULA 6 – DA LIMPEZA", { bold: true, size: 11 });
  addSpace(1);
  addText("6.1. O espaço será entregue limpo e deverá ser devolvido nas mesmas condições.");
  addText("6.2. A não realização da limpeza implicará cobrança de R$ 250,00.");
  addSpace(3);

  checkPage();
  addText("CLÁUSULA 7 – DAS PENALIDADES", { bold: true, size: 11 });
  addSpace(1);
  addText("7.1. O descumprimento de qualquer cláusula autoriza:");
  addText("• Encerramento imediato do evento;", { indent: 5 });
  addText("• Aplicação de multa equivalente a 20% do valor total do contrato;", { indent: 5 });
  addText("• Cobrança integral de danos apurados.", { indent: 5 });
  addSpace(3);

  checkPage();
  addText("CLÁUSULA 8 – CASO FORTUITO E FORÇA MAIOR", { bold: true, size: 11 });
  addSpace(1);
  addText("8.1. Nenhuma das partes será responsabilizada por eventos imprevisíveis ou inevitáveis, como queda de energia, fenômenos naturais ou atos de autoridade pública.");
  addSpace(3);

  checkPage();
  addText("CLÁUSULA 9 – DO FORO", { bold: true, size: 11 });
  addSpace(1);
  addText("9.1. Fica eleito o foro da Comarca de Ribeirão das Neves – MG, renunciando a qualquer outro, por mais privilegiado que seja.");
  addSpace(3);

  checkPage();
  addText("CLÁUSULA 10 – DISPOSIÇÕES FINAIS", { bold: true, size: 11 });
  addSpace(1);
  addText("10.1. Este contrato é celebrado em caráter irrevogável e irretratável.");
  addText("10.2. As partes declaram ter lido, compreendido e aceito todas as cláusulas.");
  addSpace(4);

  // === SIGNATURE BLOCK — keep together, avoid page break inside ===
  const signatureBlockHeight = 50; // approximate height needed for date + 2 signatures
  if (y + signatureBlockHeight > pageHeight - 15) {
    doc.addPage(); addWatermark(); y = 20;
  }

  addText(`Ribeirão das Neves – MG, ${sigDate}.`);
  addSpace(8);

  doc.setDrawColor(0);
  doc.line(margin, y, margin + 70, y);
  y += 4;
  addText("LOCATÁRIO");
  addSpace(8);

  doc.line(margin, y, margin + 70, y);
  y += 4;
  addText("LOCADOR – Espaço Lamoniê", { bold: true });

  // Auto-signature for Locador
  doc.setFontSize(9);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(100, 100, 100);
  doc.text(`Assinado digitalmente em ${sigDate} às ${today.getHours().toString().padStart(2, "0")}:${today.getMinutes().toString().padStart(2, "0")}`, margin, y);
  doc.setTextColor(0, 0, 0);

  return doc.output("blob");
}

export default function GenerateContractModal({ contract, client, open, onOpenChange, onGenerated }: Props) {
  const [step, setStep] = useState<"preview" | "generated">("preview");
  const [generating, setGenerating] = useState(false);
  const [phone, setPhone] = useState(client.phone || "");
  const [signingLink, setSigningLink] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);

  const contractText = buildContractText(contract, client);
  const fileName = `Contrato Lamoniê – ${client.name}.pdf`;

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const blob = await generatePDF(contract, client);
      const file = new File([blob], fileName, { type: "application/pdf" });

      await addDocumentFromBlob({
        contractId: contract.id,
        name: fileName,
        type: "contrato",
        file,
      });

      await updateContract(contract.id, { status: "awaiting_signature" });

      // Create signing token
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: sigData } = await supabase.from("contract_signatures").insert({
          contract_id: contract.id,
          client_name: client.name,
          client_cpf: client.cpf || null,
          client_phone: client.phone || null,
          client_address: client.addressStreet ? formatFullAddress(client).replace(/\n/g, ", ") : client.address || "",
          event_date: contract.eventDate,
          event_type: contract.eventType,
          total_value: contract.totalValue,
          deposit_percent: contract.depositPercent,
          user_id: user.id,
        } as any).select().single();

        if (sigData) {
          const baseUrl = window.location.origin;
          const clientSlug = client.name
            .toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9\s-]/g, "")
            .trim()
            .replace(/\s+/g, "-");
          
          // Save slug to signature record
          await supabase.from("contract_signatures")
            .update({ slug: clientSlug } as any)
            .eq("id", (sigData as any).id);
          
          setSigningLink(`${baseUrl}/assinar/${clientSlug}`);
        }
      }

      toast.success("Contrato gerado e assinado pelo locador!");
      setStep("generated");
      onGenerated();
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar contrato");
    } finally {
      setGenerating(false);
    }
  };

  const handleSendWhatsApp = async () => {
    const cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length < 10) {
      toast.error("Informe um número de telefone válido com DDD");
      return;
    }

    const phoneWithCountry = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

    // Update sent_at and sent_to_phone
    if (signingLink) {
      const token = new URL(signingLink).searchParams.get("token");
      if (token) {
        await supabase.from("contract_signatures")
          .update({ sent_at: new Date().toISOString(), sent_to_phone: phoneWithCountry } as any)
          .eq("token", token);
      }
    }

    const message = encodeURIComponent(
      `Olá ${client.name}! 😊\n\nSegue o contrato do seu evento no *Espaço Lamoniê* para a data *${formatDate(contract.eventDate)}*.\n\n📄 Assine o contrato em 1 clique:\n${signingLink}\n\nQualquer dúvida, estamos à disposição!`
    );
    window.open(`https://wa.me/${phoneWithCountry}?text=${message}`, "_blank");
    toast.success("WhatsApp aberto com link de assinatura!");
  };

  const handleDownload = async () => {
    try {
      const blob = await generatePDF(contract, client);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Download iniciado!");
    } catch {
      toast.error("Erro ao baixar o contrato");
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(signingLink);
    setLinkCopied(true);
    toast.success("Link copiado!");
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleClose = () => {
    setStep("preview");
    setSigningLink("");
    setLinkCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <FileText size={18} />
            {step === "preview" ? "Pré-visualização do Contrato" : "Contrato Gerado e Assinado"}
          </DialogTitle>
        </DialogHeader>

        {step === "preview" && (
          <div className="space-y-4">
            <div className="rounded-md border border-border/60 bg-muted/10 p-5 max-h-[55vh] overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm font-sans leading-relaxed text-foreground">
                {contractText}
              </pre>
            </div>
            <div className="flex items-center gap-3 justify-end">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button onClick={handleGenerate} disabled={generating} className="gap-2">
                <CheckCircle size={15} />
                {generating ? "Gerando..." : "Confirmar e gerar"}
              </Button>
            </div>
          </div>
        )}

        {step === "generated" && (
          <div className="space-y-5">
            <div className="rounded-md border border-success/30 bg-success/5 p-4 text-sm">
              <div className="flex items-center gap-2 text-success font-medium mb-1">
                <CheckCircle size={15} />
                Contrato gerado e assinado pelo Espaço Lamoniê!
              </div>
              <p className="text-muted-foreground text-xs">
                O PDF já está assinado pelo locador. O status foi alterado para <strong>Aguardando Assinatura</strong> do cliente.
              </p>
            </div>

            {/* Signing Link */}
            {signingLink && (
              <div className="rounded-md border border-primary/30 bg-primary/5 p-4 space-y-3">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Link size={12} /> Link de assinatura do cliente
                </p>
                <div className="flex gap-2">
                  <Input value={signingLink} readOnly className="text-xs font-mono" />
                  <Button variant="outline" size="sm" onClick={handleCopyLink} className="shrink-0">
                    {linkCopied ? "Copiado!" : "Copiar"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  O cliente pode assinar em 1 clique, sem cadastro ou app.
                </p>
              </div>
            )}

            {/* WhatsApp Send */}
            <div className="rounded-md border border-border/60 bg-muted/20 p-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Send size={12} /> Enviar link de assinatura via WhatsApp
              </p>
              <div className="grid gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Número de telefone (com DDD)</Label>
                  <div className="flex gap-2 mt-1">
                    <div className="relative flex-1">
                      <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="(31) 99999-9999"
                        className="pl-9"
                      />
                    </div>
                    <Button onClick={handleSendWhatsApp} className="gap-2" variant="outline">
                      <Send size={14} />
                      Enviar via WhatsApp
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button onClick={handleDownload} variant="outline" className="gap-2">
                <Download size={14} />
                Baixar PDF
              </Button>
              <Button onClick={handleClose}>Fechar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
