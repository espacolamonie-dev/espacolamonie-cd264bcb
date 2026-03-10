import jsPDF from "jspdf";
import type { Budget, BudgetItem } from "@/data/budgetStore";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string | null) => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "—";

export function generateBudgetPdf(budget: Budget, items: BudgetItem[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 20;

  // Header bar
  doc.setFillColor(45, 87, 64); // primary green
  doc.rect(0, 0, w, 40, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("ORÇAMENTO", margin, 18);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Espaço Lamoniê", margin, 28);
  doc.setFontSize(9);
  doc.text(`Emitido em: ${new Date().toLocaleDateString("pt-BR")}`, w - margin, 28, { align: "right" });

  y = 50;
  doc.setTextColor(60, 60, 60);

  // Client info
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("DADOS DO CLIENTE", margin, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const clientInfo = [
    `Cliente: ${budget.clientName}`,
    `Telefone: ${budget.clientPhone || "—"}`,
    `Evento: ${budget.eventType || "—"}`,
    `Data: ${fmtDate(budget.eventDate)}`,
    `Pessoas: ${budget.guestCount}`,
  ];
  for (const line of clientInfo) {
    doc.text(line, margin, y);
    y += 5;
  }

  y += 5;

  // Items table header
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y - 4, w - margin * 2, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text("ITEM", margin + 2, y);
  doc.text("QTD", margin + 80, y, { align: "right" });
  doc.text("UNITÁRIO", margin + 105, y, { align: "right" });
  doc.text("%", margin + 120, y, { align: "right" });
  doc.text("TOTAL", w - margin - 2, y, { align: "right" });
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);

  for (const item of items) {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.setFontSize(9);
    doc.text(item.name || "(sem nome)", margin + 2, y, { maxWidth: 70 });
    doc.text(`${item.quantity}`, margin + 80, y, { align: "right" });
    doc.text(fmt(item.unitPrice), margin + 105, y, { align: "right" });
    doc.text(`${item.percentageApplied}%`, margin + 120, y, { align: "right" });
    doc.setFont("helvetica", "bold");
    doc.text(fmt(item.finalValue), w - margin - 2, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    y += 6;
    // Separator
    doc.setDrawColor(230, 230, 230);
    doc.line(margin, y - 2, w - margin, y - 2);
  }

  y += 5;

  // Totals
  const totalsX = w - margin - 2;
  doc.setFontSize(9);
  doc.text("Subtotal:", totalsX - 40, y);
  doc.text(fmt(budget.subtotal), totalsX, y, { align: "right" });
  y += 5;
  doc.text("Adicional:", totalsX - 40, y);
  doc.text(fmt(budget.additionalTotal), totalsX, y, { align: "right" });
  y += 6;
  doc.setDrawColor(45, 87, 64);
  doc.line(totalsX - 60, y - 2, totalsX, y - 2);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(45, 87, 64);
  doc.text("TOTAL FINAL:", totalsX - 50, y + 2);
  doc.text(fmt(budget.finalTotal), totalsX, y + 2, { align: "right" });

  y += 12;
  if (budget.notes) {
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("Observações:", margin, y);
    y += 4;
    const lines = doc.splitTextToSize(budget.notes, w - margin * 2);
    doc.text(lines, margin, y);
  }

  doc.save(`Orçamento Lamoniê - ${budget.clientName}.pdf`);
}
