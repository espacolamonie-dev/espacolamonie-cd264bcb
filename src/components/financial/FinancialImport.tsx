import { useState, useRef, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { getSafeErrorMessage } from "@/lib/errorSanitizer";
import { Upload, FileText, Check, Loader2, Landmark, AlertTriangle, X } from "lucide-react";
import { addManualEntry, addExpense } from "@/data/store";
import type { Contract, Client } from "@/types";

const PARSE_PDF_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-statement-pdf`;
const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type EntryClassification = "receita" | "despesa" | "comissao" | "marketing" | "investimento" | "ignorar";

interface ParsedEntry {
  date: string;
  description: string;
  amount: number;
  selected: boolean;
  classification: EntryClassification;
  linkedContractId?: string;
}

interface Props {
  contracts: Contract[];
  clients: Client[];
  payments: any[];
  manualEntries: any[];
  expenses: any[];
  onReload: () => void;
}

const CLASSIFICATION_LABELS: Record<EntryClassification, string> = {
  receita: "Receita",
  despesa: "Despesa",
  comissao: "Comissão Func.",
  marketing: "Marketing",
  investimento: "Investimento",
  ignorar: "Ignorar",
};

const CLASSIFICATION_COLORS: Record<EntryClassification, string> = {
  receita: "bg-success/10 text-success border-success/20",
  despesa: "bg-danger/10 text-danger border-danger/20",
  comissao: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  marketing: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  investimento: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  ignorar: "bg-muted text-muted-foreground border-border",
};

function parseCSV(text: string): ParsedEntry[] {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  const entries: ParsedEntry[] = [];
  for (const line of lines) {
    const sep = line.includes(";") ? ";" : ",";
    const parts = line.split(sep).map(p => p.trim().replace(/^"|"$/g, ""));
    if (parts.length < 3) continue;
    const dateStr = parts[0];
    const description = parts[1];
    const amountStr = parts[parts.length - 1] || parts[2];
    let date = "";
    const dateParts = dateStr.split("/");
    if (dateParts.length === 3) {
      const [d, m, y] = dateParts;
      date = `${y.length === 2 ? `20${y}` : y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) date = dateStr;
    if (!date) continue;
    const cleanAmount = amountStr.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
    const rawAmount = parseFloat(cleanAmount);
    if (isNaN(rawAmount)) continue;
    entries.push({ date, description, amount: Math.abs(rawAmount), selected: true, classification: rawAmount > 0 ? "receita" : "despesa" });
  }
  return entries;
}

function parseOFX(text: string): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  const regex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const block = match[1];
    const getTag = (tag: string) => { const m = new RegExp(`<${tag}>([^<\\n]+)`, "i").exec(block); return m ? m[1].trim() : ""; };
    const dateStr = getTag("DTPOSTED");
    const amountStr = getTag("TRNAMT");
    const memo = getTag("MEMO") || getTag("NAME");
    const amount = parseFloat(amountStr);
    if (isNaN(amount)) continue;
    let date = "";
    if (dateStr.length >= 8) date = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
    if (!date) continue;
    entries.push({ date, description: memo, amount: Math.abs(amount), selected: true, classification: amount > 0 ? "receita" : "despesa" });
  }
  return entries;
}

export default function FinancialImport({ contracts, clients, payments, manualEntries, expenses, onReload }: Props) {
  const [step, setStep] = useState<"upload" | "preview" | "importing">("upload");
  const [entries, setEntries] = useState<ParsedEntry[]>([]);
  const [fileName, setFileName] = useState("");
  const [duplicates, setDuplicates] = useState<Set<number>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  const activeContracts = contracts.filter(c => c.status !== "cancelled");

  // Detect duplicates
  const detectDuplicates = (parsed: ParsedEntry[]) => {
    const dupes = new Set<number>();
    const existingAmounts = new Map<string, string[]>();
    
    // Index existing entries
    [...payments, ...manualEntries].forEach(p => {
      const key = `${p.amount || 0}`;
      if (!existingAmounts.has(key)) existingAmounts.set(key, []);
      existingAmounts.get(key)!.push(p.date);
    });
    expenses.forEach(e => {
      const key = `${e.amount}`;
      if (!existingAmounts.has(key)) existingAmounts.set(key, []);
      existingAmounts.get(key)!.push(e.date);
    });

    parsed.forEach((entry, idx) => {
      const key = `${entry.amount}`;
      const dates = existingAmounts.get(key);
      if (dates && dates.some(d => d === entry.date)) dupes.add(idx);
    });
    return dupes;
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    let parsed: ParsedEntry[] = [];
    const ext = file.name.toLowerCase().split(".").pop();

    if (ext === "csv" || ext === "txt") parsed = parseCSV(text);
    else if (ext === "ofx" || ext === "qfx") parsed = parseOFX(text);
    else if (ext === "pdf") {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        const res = await fetch(PARSE_PDF_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
          body: JSON.stringify({ pdf_base64: base64, type: "entries" }),
        });
        const result = await res.json();
        if (result.error) { toast.error(result.error); return; }
        parsed = (result.transactions || []).map((t: any) => ({
          date: t.date, description: t.description, amount: Math.abs(t.amount), selected: true,
          classification: t.amount > 0 ? "receita" as EntryClassification : "despesa" as EntryClassification,
        }));
      } catch { toast.error("Erro ao processar PDF"); return; }
    } else { toast.error("Formato não suportado. Use CSV, OFX ou PDF."); return; }

    if (parsed.length === 0) { toast.error("Nenhuma transação encontrada"); return; }

    const dupes = detectDuplicates(parsed);
    // Auto-deselect duplicates
    parsed = parsed.map((p, i) => dupes.has(i) ? { ...p, selected: false } : p);
    setDuplicates(dupes);
    setEntries(parsed);
    setStep("preview");
  };

  const toggleEntry = (idx: number) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, selected: !e.selected } : e));
  };

  const updateClassification = (idx: number, classification: EntryClassification) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, classification } : e));
  };

  const handleImport = async () => {
    const selected = entries.filter(e => e.selected && e.classification !== "ignorar");
    if (selected.length === 0) { toast.error("Selecione pelo menos uma transação"); return; }

    setStep("importing");
    try {
      for (const entry of selected) {
        if (entry.classification === "receita" || entry.classification === "comissao") {
          await addManualEntry({
            description: entry.description,
            category: entry.classification === "comissao" ? "Serviço avulso" : "Outro",
            amount: entry.amount,
            date: entry.date,
            paymentMethod: "Transferência",
            notes: `Importado via extrato (${entry.classification})`,
          });
        } else {
          const categoryMap: Record<string, string> = {
            despesa: "Outros",
            marketing: "Marketing",
            investimento: "Outros",
          };
          await addExpense({
            description: entry.description,
            category: categoryMap[entry.classification] || "Outros",
            amount: entry.amount,
            date: entry.date,
          });
        }
      }
      toast.success(`${selected.length} transações importadas com sucesso!`);
      onReload();
      handleClose();
    } catch (err: any) {
      toast.error(getSafeErrorMessage(err));
      setStep("preview");
    }
  };

  const handleClose = () => {
    setStep("upload");
    setEntries([]);
    setFileName("");
    setDuplicates(new Set());
  };

  const selectedCount = entries.filter(e => e.selected && e.classification !== "ignorar").length;
  const selectedTotal = entries.filter(e => e.selected && e.classification !== "ignorar").reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="font-display font-semibold text-lg flex items-center gap-2 mb-4">
          <Landmark size={20} /> Importar Extrato Bancário
        </h2>
        <p className="text-sm text-muted-foreground mb-6">
          Importe transações do banco e classifique cada uma como receita, despesa, comissão ou marketing.
          O sistema detecta automaticamente possíveis duplicatas.
        </p>

        {step === "upload" && (
          <div className="border-2 border-dashed border-border rounded-lg p-12 text-center space-y-4">
            <Upload size={40} className="mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Formatos aceitos: CSV, OFX, PDF</p>
            <input ref={fileRef} type="file" className="hidden" accept=".csv,.ofx,.qfx,.txt,.pdf" onChange={handleFile} />
            <Button onClick={() => fileRef.current?.click()} variant="outline" className="gap-2" size="lg">
              <Upload size={16} /> Selecionar arquivo
            </Button>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-muted-foreground" />
                <p className="text-sm"><strong>{fileName}</strong> — {entries.length} transações</p>
              </div>
              <div className="flex items-center gap-3">
                {duplicates.size > 0 && (
                  <Badge variant="outline" className="gap-1 border-amber-500/30 text-amber-600">
                    <AlertTriangle size={12} /> {duplicates.size} possível(is) duplicata(s)
                  </Badge>
                )}
                <p className="text-xs text-muted-foreground">{selectedCount} selecionadas • {fmt(selectedTotal)}</p>
              </div>
            </div>

            <div className="rounded-md border max-h-[50vh] overflow-y-auto divide-y divide-border/40">
              {entries.map((entry, idx) => (
                <div
                  key={idx}
                  className={`flex items-center gap-3 px-4 py-3 transition-colors ${!entry.selected ? "opacity-40 bg-muted/20" : ""} ${duplicates.has(idx) ? "bg-amber-500/5" : ""}`}
                >
                  <div
                    className={`h-5 w-5 rounded border flex items-center justify-center shrink-0 cursor-pointer ${entry.selected ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}
                    onClick={() => toggleEntry(idx)}
                  >
                    {entry.selected && <Check size={12} />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{entry.description}</p>
                      {duplicates.has(idx) && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-500/30 text-amber-600 shrink-0">Duplicata?</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{new Date(entry.date + "T12:00:00").toLocaleDateString("pt-BR")}</p>
                  </div>

                  <Select value={entry.classification} onValueChange={(v) => updateClassification(idx, v as EntryClassification)}>
                    <SelectTrigger className="h-7 text-xs w-32 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(CLASSIFICATION_LABELS) as EntryClassification[]).map(c => (
                        <SelectItem key={c} value={c}>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${CLASSIFICATION_COLORS[c]}`}>{CLASSIFICATION_LABELS[c]}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <span className={`font-medium text-sm tabular-nums shrink-0 ${entry.classification === "receita" || entry.classification === "comissao" ? "text-success" : "text-danger"}`}>
                    {fmt(entry.amount)}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center">
              <Button variant="outline" onClick={handleClose}>
                <X size={14} className="mr-1" /> Cancelar
              </Button>
              <Button onClick={handleImport} className="gap-2">
                <Check size={14} /> Importar {selectedCount} transações
              </Button>
            </div>
          </div>
        )}

        {step === "importing" && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-sm text-muted-foreground">Importando transações...</span>
          </div>
        )}
      </Card>
    </div>
  );
}
