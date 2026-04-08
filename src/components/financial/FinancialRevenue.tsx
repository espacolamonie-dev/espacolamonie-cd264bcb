import { useState, useMemo } from "react";
import { todayLocalStr } from "@/lib/dateUtils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/CurrencyInput";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  CircleArrowUp as ArrowUpCircle, Plus, Trash2, Search, X, Upload, Receipt,
} from "lucide-react";
import ImportBankEntryModal from "@/components/ImportBankEntryModal";
import ImportReceiptModal from "@/components/ImportReceiptModal";
import { addManualEntry, deleteManualEntry } from "@/data/store";
import { toast } from "sonner";
import { getSafeErrorMessage } from "@/lib/errorSanitizer";
import type { FinancialData, FinancialTransaction } from "./types";
import type { ManualEntryCategory, PaymentMethod } from "@/types";

const ENTRY_CATEGORIES: ManualEntryCategory[] = ["Aluguel extra", "Taxa adicional", "Serviço avulso", "Outro"];
const PAYMENT_METHODS: PaymentMethod[] = ["Pix", "Dinheiro", "Cartão", "Transferência"];
const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Props {
  data: FinancialData;
  onReload: () => void;
}

export default function FinancialRevenue({ data, onReload }: Props) {
  const { allEntradas, monthLabel } = data;
  const [entryOpen, setEntryOpen] = useState(false);
  const [importEntryOpen, setImportEntryOpen] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const [entryFilter, setEntryFilter] = useState("all");
  const [entrySearch, setEntrySearch] = useState("");
  const [entryForm, setEntryForm] = useState({
    description: "", category: "Outro" as ManualEntryCategory, amount: 0,
    date: todayLocalStr(), paymentMethod: "Pix" as PaymentMethod, notes: "",
  });

  const filtered = useMemo(() => {
    let list = allEntradas;
    if (entryFilter !== "all") list = list.filter(i => i.source === entryFilter || i.category === entryFilter);
    if (entrySearch) list = list.filter(i => i.description.toLowerCase().includes(entrySearch.toLowerCase()));
    return list;
  }, [allEntradas, entryFilter, entrySearch]);

  const toggleSelection = (id: string) => {
    const next = new Set(selectedEntries);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedEntries(next);
  };

  const handleAddEntry = async () => {
    if (!entryForm.description.trim() || entryForm.amount <= 0) { toast.error("Preencha descrição e valor"); return; }
    try {
      await addManualEntry(entryForm);
      toast.success("Entrada registrada");
      setEntryOpen(false);
      setEntryForm({ description: "", category: "Outro", amount: 0, date: todayLocalStr(), paymentMethod: "Pix", notes: "" });
      onReload();
    } catch (e: any) { toast.error(getSafeErrorMessage(e)); }
  };

  const handleDeleteSelected = async () => {
    try {
      for (const id of selectedEntries) await deleteManualEntry(id);
      toast.success(`${selectedEntries.size} entrada(s) excluída(s)`);
      setSelectedEntries(new Set());
      onReload();
    } catch (e: any) { toast.error(getSafeErrorMessage(e)); }
  };

  const handleDeleteSingle = async (id: string) => {
    try { await deleteManualEntry(id); toast.success("Entrada removida"); onReload(); }
    catch (e: any) { toast.error(getSafeErrorMessage(e)); }
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-display font-semibold flex items-center gap-2">
              <ArrowUpCircle size={18} className="text-success" /> Receitas
            </h2>
            <p className="text-xs text-muted-foreground">Recebimentos de {monthLabel}</p>
          </div>
          <div className="flex gap-2">
            {selectedEntries.size > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="destructive" className="gap-1.5 h-8 text-xs rounded-lg">
                    <Trash2 size={12} /> ({selectedEntries.size})
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir {selectedEntries.size} entrada(s)?</AlertDialogTitle>
                    <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteSelected} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button onClick={() => setReceiptModalOpen(true)} size="sm" variant="outline" className="gap-1.5 h-8 text-xs rounded-lg">
              <Receipt size={12} /> Comprovante
            </Button>
            <Button onClick={() => setImportEntryOpen(true)} size="sm" variant="outline" className="gap-1.5 h-8 text-xs rounded-lg">
              <Upload size={12} /> Importar
            </Button>
            <Button onClick={() => setEntryOpen(true)} size="sm" variant="outline" className="gap-1.5 h-8 text-xs rounded-lg">
              <Plus size={12} /> Entrada
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-3 flex-wrap">
          <div className="relative flex-1 min-w-[140px]">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar..." className="pl-8 h-8 text-xs" value={entrySearch} onChange={(e) => setEntrySearch(e.target.value)} />
          </div>
          <Select value={entryFilter} onValueChange={setEntryFilter}>
            <SelectTrigger className="h-8 text-xs w-32"><SelectValue placeholder="Filtrar" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="payment">Contratos</SelectItem>
              <SelectItem value="manual_entry">Manuais</SelectItem>
              {ENTRY_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          {(entryFilter !== "all" || entrySearch) && (
            <Button variant="ghost" size="sm" className="h-8 text-xs px-2" onClick={() => { setEntryFilter("all"); setEntrySearch(""); }}>
              <X size={12} />
            </Button>
          )}
        </div>

        <div className="space-y-2 max-h-[55vh] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">Nenhuma entrada encontrada</div>
          ) : filtered.map(item => (
            <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors group">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {item.source !== "payment" && (
                  <Checkbox checked={selectedEntries.has(item.id)} onCheckedChange={() => toggleSelection(item.id)} className="shrink-0" />
                )}
                <div className="rounded-full p-2 shrink-0 bg-success/10">
                  <ArrowUpCircle size={16} className="text-success" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{item.description}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <p className="text-xs text-muted-foreground">{new Date(item.date + "T12:00:00").toLocaleDateString("pt-BR")}</p>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{item.category}</Badge>
                    {item.source === "payment" && <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-success/30 text-success">Contrato</Badge>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <p className="font-bold text-sm text-success">+ {fmt(item.amount)}</p>
                {item.source !== "payment" && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Trash2 size={14} /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Excluir entrada?</AlertDialogTitle></AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDeleteSingle(item.id)} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 pt-3 border-t flex justify-between items-center">
          <span className="text-xs text-muted-foreground font-medium">Total ({filtered.length})</span>
          <span className="font-display font-bold text-success">{fmt(filtered.reduce((s, i) => s + i.amount, 0))}</span>
        </div>
      </Card>

      {/* Entry Modal */}
      <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-display text-xl">Adicionar Entrada</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label className="text-sm font-medium">Descrição *</Label>
              <Input value={entryForm.description} onChange={(e) => setEntryForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: Aluguel extra" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-sm font-medium">Categoria</Label>
                <Select value={entryForm.category} onValueChange={(v) => setEntryForm(f => ({ ...f, category: v as ManualEntryCategory }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ENTRY_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label className="text-sm font-medium">Valor *</Label>
                <CurrencyInput value={entryForm.amount} onChange={(v) => setEntryForm(f => ({ ...f, amount: v }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label className="text-sm font-medium">Data</Label>
                <Input type="date" value={entryForm.date} onChange={(e) => setEntryForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label className="text-sm font-medium">Forma de pagamento</Label>
                <Select value={entryForm.paymentMethod} onValueChange={(v) => setEntryForm(f => ({ ...f, paymentMethod: v as PaymentMethod }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleAddEntry} className="mt-2">Registrar Entrada</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ImportBankEntryModal open={importEntryOpen} onOpenChange={setImportEntryOpen} onImported={onReload} />
      <ImportReceiptModal open={receiptModalOpen} onOpenChange={setReceiptModalOpen} mode="financial" onImported={onReload} />
    </div>
  );
}
