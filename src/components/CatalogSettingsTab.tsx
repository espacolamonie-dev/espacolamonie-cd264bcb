import { useState, useEffect } from "react";
import { Plus, Trash2, Upload, Edit2, Check, X, FileSpreadsheet, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  getCatalogItems, addCatalogItem, updateCatalogItem, deleteCatalogItem,
  CatalogItem,
} from "@/data/budgetStore";
import { CurrencyInput } from "@/components/CurrencyInput";
import * as XLSX from "xlsx";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface PreviewRow {
  name: string;
  category: string;
  supplier: string;
  unitPrice: number;
  unitLabel: string;
  percentage: number;
  selected: boolean;
}

export default function CatalogSettingsTab() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<CatalogItem>>({});

  // New item form
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newSupplier, setNewSupplier] = useState("");
  const [newPrice, setNewPrice] = useState(0);
  const [newUnit, setNewUnit] = useState("unidade");
  const [newPercentage, setNewPercentage] = useState(0);
  const [saving, setSaving] = useState(false);

  // Import state
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState("");

  const load = async () => {
    setLoading(true);
    try { setItems(await getCatalogItems()); } catch (e: any) { toast.error(e.message); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // ── Add item ──
  const handleAdd = async () => {
    if (!newName.trim()) { toast.error("Informe o nome do item"); return; }
    setSaving(true);
    try {
      await addCatalogItem({
        name: newName, category: newCategory, supplier: newSupplier,
        defaultUnitPrice: newPrice, unitLabel: newUnit, defaultPercentage: newPercentage,
      });
      toast.success("Item adicionado ao catálogo");
      setNewName(""); setNewCategory(""); setNewSupplier(""); setNewPrice(0); setNewUnit("unidade"); setNewPercentage(0);
      setShowAdd(false);
      load();
    } catch (e: any) { toast.error(e.message); }
    setSaving(false);
  };

  // ── Edit item ──
  const startEdit = (item: CatalogItem) => {
    setEditId(item.id);
    setEditData({ ...item });
  };

  const saveEdit = async () => {
    if (!editId || !editData.name?.trim()) return;
    try {
      await updateCatalogItem(editId, {
        name: editData.name, category: editData.category, supplier: editData.supplier,
        defaultUnitPrice: editData.defaultUnitPrice, unitLabel: editData.unitLabel,
        defaultPercentage: editData.defaultPercentage,
      });
      toast.success("Item atualizado");
      setEditId(null);
      load();
    } catch (e: any) { toast.error(e.message); }
  };

  // ── Delete ──
  const handleDelete = async (id: string) => {
    if (!confirm("Remover este item do catálogo?")) return;
    try { await deleteCatalogItem(id); toast.success("Removido"); load(); } catch (e: any) { toast.error(e.message); }
  };

  // ── XLSX Import ──
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const allParsed: PreviewRow[] = [];

      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        if (rawRows.length === 0) continue;

        let currentSupplier = "";

        for (const row of rawRows) {
          const col0 = String(row[0] || "").trim();
          const col1 = row[1];
          const col1Str = String(col1 || "").trim();

          if (!col0) continue;

          // Skip totals and headers
          const lowerCol0 = col0.toLowerCase();
          if (lowerCol0.includes("subtotal") || lowerCol0.includes("total geral") || lowerCol0 === "orçamentos" || lowerCol0 === "utensilios") continue;

          // Detect supplier row: has text in col0 but NO valid price in col1
          const priceVal = parsePrice(col1);
          if (priceVal === 0 && !col1Str) {
            // This is a supplier/section header
            currentSupplier = col0;
            continue;
          }

          // It's an item row if it has a name and a price
          if (col0 && priceVal > 0) {
            allParsed.push({
              name: col0,
              category: "",
              supplier: currentSupplier,
              unitPrice: priceVal,
              unitLabel: "unidade",
              percentage: 0,
              selected: true,
            });
          }
        }
      }

      // Deduplicate by name+supplier (keep first occurrence)
      const seen = new Set<string>();
      const deduped = allParsed.filter(r => {
        const key = `${r.name.toLowerCase()}|${r.supplier.toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (deduped.length === 0) {
        toast.error("Nenhum item válido encontrado na planilha.");
        return;
      }

      setPreview(deduped);
      toast.success(`${deduped.length} itens encontrados`);
    } catch (err: any) {
      toast.error("Erro ao ler planilha: " + err.message);
    }

    e.target.value = "";
  };

  const parsePrice = (val: any): number => {
    if (typeof val === "number") return val;
    if (typeof val === "string") {
      const cleaned = val.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
      const num = parseFloat(cleaned);
      return isNaN(num) ? 0 : num;
    }
    return 0;
  };

  const togglePreviewItem = (idx: number) => {
    setPreview(prev => prev?.map((r, i) => i === idx ? { ...r, selected: !r.selected } : r) || null);
  };

  const importSelected = async () => {
    if (!preview) return;
    const selected = preview.filter(r => r.selected);
    if (selected.length === 0) { toast.error("Nenhum item selecionado"); return; }
    setImporting(true);
    try {
      for (const row of selected) {
        await addCatalogItem({
          name: row.name,
          category: row.category,
          supplier: row.supplier,
          defaultUnitPrice: row.unitPrice,
          unitLabel: row.unitLabel,
          defaultPercentage: row.percentage,
        });
      }
      toast.success(`${selected.length} itens importados com sucesso`);
      setPreview(null);
      load();
    } catch (e: any) { toast.error(e.message); }
    setImporting(false);
  };

  return (
    <div className="space-y-6">
      {/* Import section */}
      <Card className="card-premium">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <FileSpreadsheet size={20} className="text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-display">Importar Planilha</CardTitle>
              <CardDescription className="text-xs mt-0.5">Importe itens de uma planilha XLSX com nome, fornecedor e valores</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <label className="cursor-pointer">
              <input type="file" accept=".xlsx,.xls" onChange={handleFileSelect} className="hidden" />
              <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-primary/30 bg-primary/5 text-primary text-sm font-medium hover:bg-primary/10 transition-colors">
                <Upload size={16} />
                Selecionar planilha (.xlsx)
              </div>
            </label>
            {fileName && <span className="text-xs text-muted-foreground">{fileName}</span>}
          </div>

          {/* Preview */}
          {preview && (
            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  Prévia da importação — <span className="text-primary">{preview.filter(r => r.selected).length}/{preview.length} selecionados</span>
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPreview(null)} className="text-xs">Cancelar</Button>
                  <Button size="sm" onClick={importSelected} disabled={importing} className="text-xs gap-1">
                    {importing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    {importing ? "Importando..." : "Importar selecionados"}
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-border overflow-hidden max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0">
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="w-10 px-3 py-2"></th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Nome</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Fornecedor</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Categoria</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Valor</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Unidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, idx) => (
                      <tr
                        key={idx}
                        className={`border-b border-border last:border-0 cursor-pointer transition-colors ${
                          row.selected ? "bg-card hover:bg-muted/20" : "bg-muted/10 opacity-50"
                        }`}
                        onClick={() => togglePreviewItem(idx)}
                      >
                        <td className="px-3 py-2 text-center">
                          <input type="checkbox" checked={row.selected} readOnly className="rounded" />
                        </td>
                        <td className="px-3 py-2 font-medium">{row.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.supplier || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.category || "—"}</td>
                        <td className="px-3 py-2 text-right text-primary font-medium">{fmt(row.unitPrice)}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.unitLabel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Catalog items list */}
      <Card className="card-premium">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <FileSpreadsheet size={20} className="text-primary" />
              </div>
              <div>
                <CardTitle className="text-base font-display">Catálogo de Itens</CardTitle>
                <CardDescription className="text-xs mt-0.5">Itens reutilizáveis nos orçamentos</CardDescription>
              </div>
            </div>
            <Button size="sm" onClick={() => setShowAdd(!showAdd)} className="gap-1 text-xs">
              <Plus size={14} /> Novo item
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Add form */}
          {showAdd && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 mb-4 space-y-3">
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">Novo item</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-[10px]">Nome *</Label>
                  <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: Mesa redonda" className="mt-1" />
                </div>
                <div>
                  <Label className="text-[10px]">Fornecedor</Label>
                  <Input value={newSupplier} onChange={e => setNewSupplier(e.target.value)} placeholder="Ex: Cia das Festas" className="mt-1" />
                </div>
                <div>
                  <Label className="text-[10px]">Categoria</Label>
                  <Input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="Ex: Mobiliário" className="mt-1" />
                </div>
                <div>
                  <Label className="text-[10px]">Valor unitário</Label>
                  <CurrencyInput value={newPrice} onChange={setNewPrice} />
                </div>
                <div>
                  <Label className="text-[10px]">Unidade</Label>
                  <Input value={newUnit} onChange={e => setNewUnit(e.target.value)} placeholder="unidade" className="mt-1" />
                </div>
                <div>
                  <Label className="text-[10px]">% padrão</Label>
                  <Input type="number" value={newPercentage} onChange={e => setNewPercentage(Number(e.target.value))} className="mt-1" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowAdd(false)} className="text-xs">Cancelar</Button>
                <Button size="sm" onClick={handleAdd} disabled={saving} className="text-xs gap-1">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Salvar
                </Button>
              </div>
            </div>
          )}

          {/* Items table */}
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Carregando...</p>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileSpreadsheet size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum item no catálogo</p>
              <p className="text-xs mt-1">Adicione manualmente ou importe uma planilha</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Item</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Fornecedor</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Categoria</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Valor</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Unidade</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">%</th>
                    <th className="w-20 px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      {editId === item.id ? (
                        <>
                          <td className="px-4 py-2"><Input value={editData.name || ""} onChange={e => setEditData(d => ({ ...d, name: e.target.value }))} className="h-8 text-xs" /></td>
                          <td className="px-4 py-2"><Input value={editData.supplier || ""} onChange={e => setEditData(d => ({ ...d, supplier: e.target.value }))} className="h-8 text-xs" /></td>
                          <td className="px-4 py-2"><Input value={editData.category || ""} onChange={e => setEditData(d => ({ ...d, category: e.target.value }))} className="h-8 text-xs" /></td>
                          <td className="px-4 py-2"><Input type="number" value={editData.defaultUnitPrice || 0} onChange={e => setEditData(d => ({ ...d, defaultUnitPrice: Number(e.target.value) }))} className="h-8 text-xs text-right" /></td>
                          <td className="px-4 py-2"><Input value={editData.unitLabel || ""} onChange={e => setEditData(d => ({ ...d, unitLabel: e.target.value }))} className="h-8 text-xs" /></td>
                          <td className="px-4 py-2"><Input type="number" value={editData.defaultPercentage || 0} onChange={e => setEditData(d => ({ ...d, defaultPercentage: Number(e.target.value) }))} className="h-8 text-xs text-right" /></td>
                          <td className="px-4 py-2">
                            <div className="flex gap-1 justify-end">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveEdit}><Check size={14} /></Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditId(null)}><X size={14} /></Button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-2.5 font-medium">{item.name}</td>
                          <td className="px-4 py-2.5 text-muted-foreground">{item.supplier || "—"}</td>
                          <td className="px-4 py-2.5">
                            {item.category && <Badge variant="outline" className="text-[10px]">{item.category}</Badge>}
                          </td>
                          <td className="px-4 py-2.5 text-right text-primary font-medium">{fmt(item.defaultUnitPrice)}</td>
                          <td className="px-4 py-2.5 text-muted-foreground text-xs">{item.unitLabel}</td>
                          <td className="px-4 py-2.5 text-right text-muted-foreground">{item.defaultPercentage}%</td>
                          <td className="px-4 py-2.5">
                            <div className="flex gap-1 justify-end">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(item)}><Edit2 size={14} /></Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(item.id)}><Trash2 size={14} /></Button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
