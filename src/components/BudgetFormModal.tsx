import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Search, ChevronRight, ChevronLeft, Package } from "lucide-react";
import { toast } from "sonner";
import { getClients } from "@/data/store";
import { supabase } from "@/integrations/supabase/client";
import {
  addBudget, updateBudget, getBudgetById, getBudgetItems, addBudgetItem,
  updateBudgetItem, deleteBudgetItem, getCatalogItems,
  Budget, BudgetItem, CatalogItem, recalcBudgetTotals,
} from "@/data/budgetStore";
import { CurrencyInput } from "@/components/CurrencyInput";
import { NumericInput } from "@/components/NumericInput";

const EVENT_TYPES = [
  "Aniversário 15 anos", "Aniversário Adulto", "Aniversário Infantil", "Casamento",
  "Chá de bebê", "Chá de fraldas", "Chá de panela", "Chá de revelação",
  "Confraternização", "Evento Corporativo", "Recepção de casamento",
];

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface ItemLocal {
  id?: string;
  catalogItemId?: string | null;
  name: string;
  category: string;
  supplier: string;
  unitPrice: number;
  quantity: number;
  unitLabel: string;
  percentageApplied: number;
  lineTotal: number;
  additionalValue: number;
  finalValue: number;
}

function calcItem(item: Omit<ItemLocal, "lineTotal" | "additionalValue" | "finalValue">): ItemLocal {
  const lineTotal = item.unitPrice * item.quantity;
  const additionalValue = lineTotal * (item.percentageApplied / 100);
  return { ...item, lineTotal, additionalValue, finalValue: lineTotal + additionalValue };
}

interface Props {
  budgetId: string | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function BudgetFormModal({ budgetId, open, onClose, onSaved }: Props) {
  const isEdit = !!budgetId;
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [eventType, setEventType] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [guestCount, setGuestCount] = useState(0);
  const [notes, setNotes] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [clientResults, setClientResults] = useState<any[]>([]);
  const [allClients, setAllClients] = useState<any[]>([]);
  const [globalPercentage, setGlobalPercentage] = useState(0);
  const [depositValue, setDepositValue] = useState(0);

  // Step 2
  const [items, setItems] = useState<ItemLocal[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [showCatalog, setShowCatalog] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");

  useEffect(() => {
    const init = async () => {
      const [clients, catalogItems] = await Promise.all([getClients(), getCatalogItems()]);
      setAllClients(clients);
      setCatalog(catalogItems);
      if (isEdit) {
        const b = await getBudgetById(budgetId!);
        setClientName(b.clientName);
        setClientPhone(b.clientPhone);
        setEventType(b.eventType);
        setEventDate(b.eventDate || "");
        setGuestCount(b.guestCount);
        setNotes(b.notes);
        setClientId(b.clientId);
        setGlobalPercentage(b.globalPercentage);
        setDepositValue(b.depositValue || 0);
        const bItems = await getBudgetItems(budgetId!);
        setItems(bItems.map(i => ({
          id: i.id,
          catalogItemId: i.catalogItemId,
          name: i.name,
          category: i.category,
          supplier: i.supplier,
          unitPrice: i.unitPrice,
          quantity: i.quantity,
          unitLabel: i.unitLabel,
          percentageApplied: i.percentageApplied,
          lineTotal: i.lineTotal,
          additionalValue: i.additionalValue,
          finalValue: i.finalValue,
        })));
      }
    };
    if (open) init();
  }, [open, budgetId, isEdit]);

  // Client search
  useEffect(() => {
    if (!clientSearch.trim()) { setClientResults([]); return; }
    const q = clientSearch.toLowerCase();
    setClientResults(allClients.filter(c => c.name.toLowerCase().includes(q)).slice(0, 5));
  }, [clientSearch, allClients]);

  const selectClient = async (c: any) => {
    setClientId(c.id);
    setClientName(c.name);
    setClientPhone(c.phone);
    setClientSearch("");
    setClientResults([]);

    try {
      // Fetch latest visit for this client
      const { data: visits } = await supabase
        .from("visits")
        .select("*")
        .eq("client_id", c.id)
        .order("created_at", { ascending: false })
        .limit(1);

      const visit = visits && visits.length > 0 ? visits[0] : null;

      // Fetch latest contract for this client
      const { data: contracts } = await supabase
        .from("contracts")
        .select("*")
        .eq("client_id", c.id)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(1);

      const contract = contracts && contracts.length > 0 ? contracts[0] : null;

      // Auto-fill from contract first (most complete), then visit, then client
      if (contract) {
        if (contract.event_type) setEventType(contract.event_type);
        if (contract.event_date) setEventDate(contract.event_date);
        if (contract.guest_count) setGuestCount(contract.guest_count);
        if (contract.total_value) setDepositValue(contract.deposit_value || 0);
      } else if (visit) {
        if (visit.event_type_desired) setEventType(visit.event_type_desired);
        if (visit.interest_event_date) setEventDate(visit.interest_event_date);
        if (visit.guest_count) setGuestCount(visit.guest_count);
        if (visit.event_value) setDepositValue(visit.event_value * (visit.deposit_percent / 100));
      }
    } catch (err) {
      // Silent fail - fields just won't auto-fill
      console.error("Auto-fill error:", err);
    }
  };

  const addItemFromCatalog = (cat: CatalogItem) => {
    const newItem = calcItem({
      catalogItemId: cat.id,
      name: cat.name,
      category: cat.category,
      supplier: cat.supplier,
      unitPrice: cat.defaultUnitPrice,
      quantity: 1,
      unitLabel: cat.unitLabel,
      percentageApplied: globalPercentage || cat.defaultPercentage,
    });
    setItems(prev => [...prev, newItem]);
    setShowCatalog(false);
  };

  const addManualItem = () => {
    const newItem = calcItem({
      name: "",
      category: "",
      supplier: "",
      unitPrice: 0,
      quantity: 1,
      unitLabel: "unidade",
      percentageApplied: globalPercentage,
    });
    setItems(prev => [...prev, newItem]);
  };

  const updateItemField = (idx: number, field: string, value: any) => {
    setItems(prev => prev.map((it, i) => {
      if (i !== idx) return it;
      const updated = { ...it, [field]: value };
      return calcItem(updated);
    }));
  };

  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const applyGlobalPercentage = () => {
    setItems(prev => prev.map(it => calcItem({ ...it, percentageApplied: globalPercentage })));
  };

  const totals = {
    subtotal: items.reduce((s, i) => s + i.lineTotal, 0),
    additional: items.reduce((s, i) => s + i.additionalValue, 0),
    final: items.reduce((s, i) => s + i.finalValue, 0),
  };

  const handleSave = async () => {
    if (!clientName.trim()) { toast.error("Informe o nome do cliente"); return; }
    setSaving(true);
    try {
      let bid = budgetId;
      if (isEdit) {
        await updateBudget(bid!, {
          clientId, clientName, clientPhone, eventType,
          eventDate: eventDate || null, guestCount, notes, globalPercentage, depositValue,
        });
        // Remove old items and re-add
        const existing = await getBudgetItems(bid!);
        for (const ex of existing) await deleteBudgetItem(ex.id, bid!);
      } else {
        const newBudget = await addBudget({
          clientId, clientName, clientPhone, eventType,
          eventDate: eventDate || null, guestCount, notes, globalPercentage, depositValue,
        });
        bid = newBudget.id;
      }

      // Save items
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        await addBudgetItem(bid!, {
          catalogItemId: it.catalogItemId,
          name: it.name,
          category: it.category,
          supplier: it.supplier,
          unitPrice: it.unitPrice,
          quantity: it.quantity,
          unitLabel: it.unitLabel,
          percentageApplied: it.percentageApplied,
          sortOrder: i,
        });
      }
      await recalcBudgetTotals(bid!);
      toast.success(isEdit ? "Orçamento atualizado" : "Orçamento criado");
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ fontFamily: "var(--font-heading)" }}>
            {isEdit ? "Editar Orçamento" : "Novo Orçamento"}
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-4">
          {[1, 2, 3].map(s => (
            <button key={s} onClick={() => setStep(s)}
              className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all ${
                step === s ? "bg-primary text-primary-foreground" : step > s ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
              }`}>
              {s}
            </button>
          ))}
          <div className="flex-1" />
          <span className="text-xs text-muted-foreground">
            {step === 1 ? "Dados do cliente" : step === 2 ? "Itens" : "Resumo"}
          </span>
        </div>

        {/* STEP 1: Client Data */}
        {step === 1 && (
          <div className="space-y-4">
            {/* Client search */}
            <div>
              <Label className="text-xs">Buscar cliente existente</Label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Pesquisar..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} className="pl-9" />
              </div>
              {clientResults.length > 0 && (
                <div className="mt-1 rounded-lg border border-border bg-card shadow-lg max-h-40 overflow-y-auto">
                  {clientResults.map(c => (
                    <button key={c.id} onClick={() => selectClient(c)} className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-muted-foreground ml-2 text-xs">{c.phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Nome do cliente *</Label>
                <Input value={clientName} onChange={e => setClientName(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Telefone</Label>
                <Input value={clientPhone} onChange={e => {
                  let v = e.target.value.replace(/\D/g, "").slice(0, 11);
                  if (v.length > 6) v = `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
                  else if (v.length > 2) v = `(${v.slice(0,2)}) ${v.slice(2)}`;
                  else if (v.length > 0) v = `(${v}`;
                  setClientPhone(v);
                }} placeholder="(31) 99999-9999" />
              </div>
              <div>
                <Label className="text-xs">Tipo do evento</Label>
                <Select value={eventType} onValueChange={setEventType}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Data do evento</Label>
                <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Quantidade de pessoas</Label>
                <NumericInput value={guestCount} onChange={setGuestCount} />
              </div>
              <div>
                <Label className="text-xs">Percentual geral (%)</Label>
                <NumericInput value={globalPercentage} onChange={setGlobalPercentage} />
              </div>
              <div>
                <Label className="text-xs">Valor do sinal (reserva)</Label>
                <CurrencyInput value={depositValue} onChange={setDepositValue} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
            </div>

            <div className="flex justify-end">
              <Button onClick={() => { if (!clientName.trim()) { toast.error("Informe o nome do cliente"); return; } setStep(2); }} className="gap-2">
                Próximo <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: Items */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={addManualItem} className="gap-1">
                <Plus size={14} /> Item manual
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowCatalog(!showCatalog)} className="gap-1">
                <Package size={14} /> Do catálogo
              </Button>
              {globalPercentage > 0 && (
                <Button variant="outline" size="sm" onClick={applyGlobalPercentage} className="gap-1 text-xs">
                  Aplicar {globalPercentage}% em todos
                </Button>
              )}
            </div>

            {/* Catalog picker */}
            {showCatalog && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar no catálogo..."
                    value={catalogSearch}
                    onChange={e => setCatalogSearch(e.target.value)}
                    className="pl-9 h-9 text-sm"
                    autoFocus
                  />
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {catalog.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Catálogo vazio. Adicione itens em Configurações.</p>
                  ) : (() => {
                    const q = catalogSearch.toLowerCase().trim();
                    const filtered = q ? catalog.filter(c => c.name.toLowerCase().includes(q) || c.supplier.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)) : catalog;
                    if (filtered.length === 0) return <p className="text-xs text-muted-foreground text-center py-4">Nenhum item encontrado</p>;
                    // Group by supplier, sorted alphabetically
                    const grouped: Record<string, typeof filtered> = {};
                    for (const c of [...filtered].sort((a, b) => (a.supplier || "").localeCompare(b.supplier || "") || a.name.localeCompare(b.name))) {
                      const key = c.supplier || "Sem fornecedor";
                      if (!grouped[key]) grouped[key] = [];
                      grouped[key].push(c);
                    }
                    return Object.entries(grouped).map(([supplier, items]) => (
                      <div key={supplier} className="mb-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-1.5 sticky top-0 bg-muted/30">{supplier}</p>
                        {items.map(c => (
                          <button key={c.id} onClick={() => { addItemFromCatalog(c); setCatalogSearch(""); }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-card transition-colors flex justify-between items-center">
                            <span className="font-medium">{c.name}</span>
                            <span className="text-primary font-medium shrink-0 ml-2">{fmt(c.defaultUnitPrice)}</span>
                          </button>
                        ))}
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}

            {/* Items list */}
            {items.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Adicione itens ao orçamento
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div key={idx} className="rounded-xl border border-border bg-card p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 space-y-1">
                        <Input placeholder="Nome do item" value={item.name} onChange={e => updateItemField(idx, "name", e.target.value)} className="text-sm font-medium" />
                        {item.supplier && <p className="text-[11px] text-muted-foreground px-1">Fornecedor: {item.supplier}</p>}
                      </div>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive shrink-0" onClick={() => removeItem(idx)}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Valor unit.</Label>
                        <CurrencyInput value={item.unitPrice} onChange={v => updateItemField(idx, "unitPrice", v)} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Qtd.</Label>
                        <NumericInput value={item.quantity} onChange={v => updateItemField(idx, "quantity", v)} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">% Adicional</Label>
                        <NumericInput value={item.percentageApplied} onChange={v => updateItemField(idx, "percentageApplied", v)} />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Unidade</Label>
                        <Input value={item.unitLabel} onChange={e => updateItemField(idx, "unitLabel", e.target.value)} className="text-xs" />
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Subtotal: {fmt(item.lineTotal)}</span>
                      <span>Adicional: {fmt(item.additionalValue)}</span>
                      <span className="font-semibold text-foreground">Total: {fmt(item.finalValue)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Summary bar */}
            {items.length > 0 && (
              <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 flex flex-wrap gap-6 text-sm">
                <div><span className="text-muted-foreground">Subtotal:</span> <span className="font-semibold">{fmt(totals.subtotal)}</span></div>
                <div><span className="text-muted-foreground">Adicional:</span> <span className="font-semibold">{fmt(totals.additional)}</span></div>
                <div><span className="text-muted-foreground">Total:</span> <span className="font-bold text-primary text-lg">{fmt(totals.final)}</span></div>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
                <ChevronLeft size={16} /> Voltar
              </Button>
              <Button onClick={() => setStep(3)} className="gap-2">
                Resumo <ChevronRight size={16} />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Summary */}
        {step === 3 && (
          <div className="space-y-6">
            {/* Client info */}
            <div className="rounded-xl border border-border p-4 space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Dados do Cliente</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Nome:</span> <span className="font-medium">{clientName}</span></div>
                <div><span className="text-muted-foreground">Telefone:</span> <span className="font-medium">{clientPhone || "—"}</span></div>
                <div><span className="text-muted-foreground">Evento:</span> <span className="font-medium">{eventType || "—"}</span></div>
                <div><span className="text-muted-foreground">Data:</span> <span className="font-medium">{eventDate ? new Date(eventDate + "T12:00:00").toLocaleDateString("pt-BR") : "—"}</span></div>
                <div><span className="text-muted-foreground">Pessoas:</span> <span className="font-medium">{guestCount}</span></div>
              </div>
              {notes && <p className="text-xs text-muted-foreground mt-2">{notes}</p>}
            </div>

            {/* Items */}
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground text-xs">Item</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground text-xs">Qtd.</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground text-xs">Unitário</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground text-xs">%</th>
                    <th className="text-right px-4 py-2 font-medium text-muted-foreground text-xs">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={i} className="border-b border-border last:border-0">
                      <td className="px-4 py-2">{it.name || "(sem nome)"}</td>
                      <td className="px-4 py-2 text-right">{it.quantity} {it.unitLabel}</td>
                      <td className="px-4 py-2 text-right">{fmt(it.unitPrice)}</td>
                      <td className="px-4 py-2 text-right">{it.percentageApplied}%</td>
                      <td className="px-4 py-2 text-right font-semibold">{fmt(it.finalValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-5 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{fmt(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Adicional total</span>
                <span className="font-medium">{fmt(totals.additional)}</span>
              </div>
              <div className="border-t border-primary/20 pt-2 flex justify-between">
                <span className="font-bold text-lg">Total Final</span>
                <span className="font-bold text-lg text-primary">{fmt(totals.final)}</span>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)} className="gap-2">
                <ChevronLeft size={16} /> Voltar
              </Button>
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? "Salvando..." : isEdit ? "Salvar alterações" : "Salvar orçamento"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
