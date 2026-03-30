import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getSafeErrorMessage } from "@/lib/errorSanitizer";
import { Upload, FileText, Check, X, Loader2 } from "lucide-react";
import { addExpense } from "@/data/store";

const PARSE_PDF_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-statement-pdf`;

interface ParsedExpense {
  date: string;
  description: string;
  amount: number;
  selected: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function parseCSV(text: string): ParsedExpense[] {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const expenses: ParsedExpense[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Try common CSV formats: date;description;value or date,description,value
    const sep = line.includes(";") ? ";" : ",";
    const parts = line.split(sep).map((p) => p.trim().replace(/^"|"$/g, ""));
    if (parts.length < 3) continue;

    // Try to find date, description, amount
    const dateStr = parts[0];
    const description = parts[1];
    const amountStr = parts[parts.length - 1] || parts[2];

    // Parse date (DD/MM/YYYY or YYYY-MM-DD)
    let date = "";
    const dateParts = dateStr.split("/");
    if (dateParts.length === 3) {
      const [d, m, y] = dateParts;
      const year = y.length === 2 ? `20${y}` : y;
      date = `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      date = dateStr;
    }
    if (!date) continue;

    // Parse amount
    const cleanAmount = amountStr.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
    const amount = Math.abs(parseFloat(cleanAmount));
    if (isNaN(amount) || amount <= 0) continue;

    // Check if it's a debit (negative or marked as such)
    const rawAmount = parseFloat(cleanAmount);
    // Only include debits (negative values or if all values are positive, include all)
    const isDebit = rawAmount < 0 || amountStr.includes("-");

    // Skip credits/refunds
    if (rawAmount > 0 && !amountStr.includes("-")) {
      // Check description for credit keywords
      const lowerDesc = description.toLowerCase();
      if (lowerDesc.includes("estorno") || lowerDesc.includes("devolução") || lowerDesc.includes("credito") || lowerDesc.includes("crédito")) continue;
    }

    expenses.push({ date, description, amount, selected: true });
  }
  return expenses;
}

function parseOFX(text: string): ParsedExpense[] {
  const expenses: ParsedExpense[] = [];
  const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;

  while ((match = stmtTrnRegex.exec(text)) !== null) {
    const block = match[1];
    const getTag = (tag: string) => {
      const m = new RegExp(`<${tag}>([^<\\n]+)`, "i").exec(block);
      return m ? m[1].trim() : "";
    };

    const trnType = getTag("TRNTYPE");
    const dateStr = getTag("DTPOSTED");
    const amountStr = getTag("TRNAMT");
    const memo = getTag("MEMO") || getTag("NAME");

    const amount = parseFloat(amountStr);
    if (isNaN(amount)) continue;

    // Only debits (negative amounts)
    if (amount >= 0) continue;

    // Parse date YYYYMMDD
    let date = "";
    if (dateStr.length >= 8) {
      date = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
    }
    if (!date) continue;

    expenses.push({ date, description: memo, amount: Math.abs(amount), selected: true });
  }
  return expenses;
}

export default function ImportStatementModal({ open, onOpenChange, onImported }: Props) {
  const [step, setStep] = useState<"upload" | "preview" | "importing">("upload");
  const [expenses, setExpenses] = useState<ParsedExpense[]>([]);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const text = await file.text();
    let parsed: ParsedExpense[] = [];

    const ext = file.name.toLowerCase().split(".").pop();
    if (ext === "csv" || ext === "txt") {
      parsed = parseCSV(text);
    } else if (ext === "ofx" || ext === "qfx") {
      parsed = parseOFX(text);
    } else if (ext === "pdf") {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        const res = await fetch(PARSE_PDF_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ pdf_base64: base64, type: "expenses" }),
        });
        const result = await res.json();
        if (result.error) { toast.error(result.error); return; }
        parsed = (result.transactions || []).map((t: any) => ({
          date: t.date, description: t.description, amount: Math.abs(t.amount), selected: true,
        }));
      } catch {
        toast.error("Erro ao processar PDF");
        return;
      }
    } else {
      toast.error("Formato não suportado. Use CSV, OFX ou PDF.");
      return;
    }

    if (parsed.length === 0) {
      toast.error("Nenhuma despesa encontrada no arquivo");
      return;
    }

    setExpenses(parsed);
    setStep("preview");
  };

  const toggleExpense = (idx: number) => {
    setExpenses((prev) => prev.map((e, i) => i === idx ? { ...e, selected: !e.selected } : e));
  };

  const handleImport = async () => {
    const selected = expenses.filter((e) => e.selected);
    if (selected.length === 0) { toast.error("Selecione pelo menos uma despesa"); return; }

    setStep("importing");
    try {
      for (const exp of selected) {
        await addExpense({
          description: exp.description,
          category: "Compras",
          amount: exp.amount,
          date: exp.date,
        });
      }
      toast.success(`${selected.length} despesas importadas com sucesso!`);
      onImported();
      handleClose();
    } catch (err: any) {
      toast.error(getSafeErrorMessage(err));
      setStep("preview");
    }
  };

  const handleClose = () => {
    setStep("upload");
    setExpenses([]);
    setFileName("");
    onOpenChange(false);
  };

  const selectedCount = expenses.filter((e) => e.selected).length;
  const selectedTotal = expenses.filter((e) => e.selected).reduce((s, e) => s + e.amount, 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl flex items-center gap-2">
            <FileText size={18} /> Importar Extrato do Cartão
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Importe o extrato do cartão do Espaço Lamoniê para registrar despesas automaticamente.
            </p>
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center space-y-3">
              <Upload size={32} className="mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Formatos aceitos: CSV, OFX, PDF</p>
              <input ref={fileRef} type="file" className="hidden" accept=".csv,.ofx,.qfx,.txt,.pdf" onChange={handleFile} />
              <Button onClick={() => fileRef.current?.click()} variant="outline" className="gap-2">
                <Upload size={14} /> Selecionar arquivo
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                <strong>{fileName}</strong> — {expenses.length} lançamentos encontrados
              </p>
              <p className="text-xs text-muted-foreground">
                {selectedCount} selecionados • {fmt(selectedTotal)}
              </p>
            </div>

            <div className="rounded-md border border-border/60 max-h-[45vh] overflow-y-auto divide-y divide-border/40">
              {expenses.map((exp, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors ${!exp.selected ? "opacity-40" : ""}`}
                  onClick={() => toggleExpense(idx)}
                >
                  <div className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 ${exp.selected ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}>
                    {exp.selected && <Check size={12} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{exp.description}</p>
                    <p className="text-xs text-muted-foreground">{new Date(exp.date + "T12:00:00").toLocaleDateString("pt-BR")}</p>
                  </div>
                  <span className="font-medium text-sm text-danger tabular-nums shrink-0">{fmt(exp.amount)}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handleImport} className="gap-2">
                <Check size={14} /> Importar {selectedCount} despesas
              </Button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-sm text-muted-foreground">Importando despesas...</span>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}