import { useEffect, useState } from "react";
import { Plus, TrendingUp, TrendingDown, Wallet, Trash2, FileText, HandCoins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  getPayments, getExpenses, addExpense, deleteExpense,
  getManualEntries, addManualEntry, deleteManualEntry,
  getTotalEntries, getTotalExpenses, getBalance, getContracts, getClients,
} from "@/data/store";
import type { Payment, Expense, ExpenseCategory, ManualEntry, ManualEntryCategory, PaymentMethod } from "@/types";

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "Luz", "Água", "Funcionários", "Manutenção", "Compras", "Marketing", "Outros",
];

const ENTRY_CATEGORIES: ManualEntryCategory[] = [
  "Aluguel extra", "Taxa adicional", "Serviço avulso", "Outro",
];

const PAYMENT_METHODS: PaymentMethod[] = ["Pix", "Dinheiro", "Cartão", "Transferência"];

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

type CombinedEntry = {
  id: string;
  date: string;
  description: string;
  amount: number;
  origin: "contract" | "manual";
  originLabel: string;
};

export default function Financial() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [manualEntries, setManualEntries] = useState<ManualEntry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalIn, setTotalIn] = useState(0);
  const [totalOut, setTotalOut] = useState(0);
  const [balance, setBalance] = useState(0);
  const [expOpen, setExpOpen] = useState(false);
  const [entryOpen, setEntryOpen] = useState(false);
  const [expForm, setExpForm] = useState({
    description: "", category: "Outros" as ExpenseCategory, amount: 0,
    date: new Date().toISOString().split("T")[0],
  });
  const [entryForm, setEntryForm] = useState({
    description: "", category: "Outro" as ManualEntryCategory, amount: 0,
    date: new Date().toISOString().split("T")[0], paymentMethod: "Pix" as PaymentMethod, notes: "",
  });

  const load = () => {
    setPayments(getPayments());
    setManualEntries(getManualEntries());
    setExpenses(getExpenses());
    setTotalIn(getTotalEntries());
    setTotalOut(getTotalExpenses());
    setBalance(getBalance());
  };
  useEffect(load, []);

  const handleAddExpense = () => {
    if (!expForm.description.trim() || expForm.amount <= 0) { toast.error("Preencha descrição e valor"); return; }
    addExpense(expForm); toast.success("Despesa registrada!");
    setExpOpen(false);
    setExpForm({ description: "", category: "Outros", amount: 0, date: new Date().toISOString().split("T")[0] });
    load();
  };

  const handleAddEntry = () => {
    if (!entryForm.description.trim() || entryForm.amount <= 0) { toast.error("Preencha descrição e valor"); return; }
    addManualEntry(entryForm); toast.success("Entrada registrada!");
    setEntryOpen(false);
    setEntryForm({ description: "", category: "Outro", amount: 0, date: new Date().toISOString().split("T")[0], paymentMethod: "Pix", notes: "" });
    load();
  };

  const handleDeleteExpense = (id: string) => { deleteExpense(id); toast.success("Despesa excluída"); load(); };
  const handleDeleteManualEntry = (id: string) => { deleteManualEntry(id); toast.success("Entrada excluída"); load(); };

  const setExp = (field: string, value: any) => setExpForm((p) => ({ ...p, [field]: value }));
  const setEntry = (field: string, value: any) => setEntryForm((p) => ({ ...p, [field]: value }));

  const contracts = getContracts();
  const clients = getClients();
  const contractClientMap = Object.fromEntries(
    contracts.map((c) => [c.id, clients.find((cl) => cl.id === c.clientId)?.name || "—"])
  );

  // Combine contract payments + manual entries for the entries tab
  const combinedEntries: CombinedEntry[] = [
    ...payments.map((p): CombinedEntry => ({
      id: p.id, date: p.date, description: p.description || contractClientMap[p.contractId] || "Pagamento",
      amount: p.amount, origin: "contract", originLabel: contractClientMap[p.contractId] || "Contrato",
    })),
    ...manualEntries.map((e): CombinedEntry => ({
      id: e.id, date: e.date, description: e.description,
      amount: e.amount, origin: "manual", originLabel: e.category,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-3xl font-display font-semibold tracking-tight">Financeiro</h1>
        <p className="text-sm text-muted-foreground mt-1">Controle de entradas e saídas</p>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={14} className="text-success" />
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Entradas</p>
          </div>
          <p className="text-xl font-semibold text-success tracking-tight">{fmt(totalIn)}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={14} className="text-danger" />
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Saídas</p>
          </div>
          <p className="text-xl font-semibold text-danger tracking-tight">{fmt(totalOut)}</p>
        </div>
        <div className="stat-card !border-primary/20">
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={14} className="text-primary" />
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Saldo Atual</p>
          </div>
          <p className={`text-xl font-semibold tracking-tight ${balance >= 0 ? "text-primary" : "text-danger"}`}>{fmt(balance)}</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="entries" className="space-y-4">
        <TabsList>
          <TabsTrigger value="entries">Entradas</TabsTrigger>
          <TabsTrigger value="expenses">Saídas</TabsTrigger>
        </TabsList>

        <TabsContent value="entries">
          <div className="flex justify-end mb-3">
            <Button onClick={() => setEntryOpen(true)} size="sm" className="gap-2 h-9">
              <Plus size={15} /> Entrada Manual
            </Button>
          </div>
          <div className="rounded-lg border border-border/60 bg-card overflow-x-auto">
            <table className="table-premium">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th className="hidden sm:table-cell">Origem</th>
                  <th className="text-right">Valor</th>
                  <th className="text-right w-12"></th>
                </tr>
              </thead>
              <tbody>
                {combinedEntries.length === 0 ? (
                  <tr><td colSpan={5} className="!py-10 text-center text-muted-foreground">Nenhuma entrada registrada</td></tr>
                ) : (
                  combinedEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="text-muted-foreground tabular-nums">{new Date(entry.date).toLocaleDateString("pt-BR")}</td>
                      <td className="font-medium">{entry.description}</td>
                      <td className="hidden sm:table-cell">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                          entry.origin === "contract"
                            ? "bg-primary/10 text-primary"
                            : "bg-accent/15 text-accent-foreground"
                        }`}>
                          {entry.origin === "contract" ? <FileText size={10} /> : <HandCoins size={10} />}
                          {entry.origin === "contract" ? "Contrato" : "Manual"}
                        </span>
                      </td>
                      <td className="text-right font-medium text-success tabular-nums">{fmt(entry.amount)}</td>
                      <td className="text-right">
                        {entry.origin === "manual" && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteManualEntry(entry.id)}>
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="expenses">
          <div className="flex justify-end mb-3">
            <Button onClick={() => setExpOpen(true)} size="sm" className="gap-2 h-9">
              <Plus size={15} /> Nova Despesa
            </Button>
          </div>
          <div className="rounded-lg border border-border/60 bg-card overflow-x-auto">
            <table className="table-premium">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Descrição</th>
                  <th className="hidden sm:table-cell">Categoria</th>
                  <th className="text-right">Valor</th>
                  <th className="text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr><td colSpan={5} className="!py-10 text-center text-muted-foreground">Nenhuma despesa registrada</td></tr>
                ) : (
                  expenses.map((e) => (
                    <tr key={e.id}>
                      <td className="text-muted-foreground tabular-nums">{new Date(e.date).toLocaleDateString("pt-BR")}</td>
                      <td className="font-medium">{e.description}</td>
                      <td className="hidden sm:table-cell">
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">{e.category}</span>
                      </td>
                      <td className="text-right font-medium text-danger tabular-nums">{fmt(e.amount)}</td>
                      <td className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteExpense(e.id)}>
                          <Trash2 size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>

      {/* New Expense Dialog */}
      <Dialog open={expOpen} onOpenChange={setExpOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Nova Despesa</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Descrição *</Label>
              <Input value={expForm.description} onChange={(e) => setExp("description", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Categoria</Label>
                <Select value={expForm.category} onValueChange={(v) => setExp("category", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Valor (R$)</Label>
                <Input type="number" value={expForm.amount} onChange={(e) => setExp("amount", +e.target.value)} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Data</Label>
              <Input type="date" value={expForm.date} onChange={(e) => setExp("date", e.target.value)} />
            </div>
            <Button onClick={handleAddExpense} className="mt-2">Registrar Despesa</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual Entry Dialog */}
      <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Entrada Manual</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Descrição *</Label>
              <Input value={entryForm.description} onChange={(e) => setEntry("description", e.target.value)} placeholder="Ex: Aluguel de cadeiras extra" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Categoria</Label>
                <Select value={entryForm.category} onValueChange={(v) => setEntry("category", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ENTRY_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Valor (R$) *</Label>
                <Input type="number" value={entryForm.amount} onChange={(e) => setEntry("amount", +e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Data</Label>
                <Input type="date" value={entryForm.date} onChange={(e) => setEntry("date", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Forma de Recebimento</Label>
                <Select value={entryForm.paymentMethod} onValueChange={(v) => setEntry("paymentMethod", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Observações</Label>
              <Textarea value={entryForm.notes} onChange={(e) => setEntry("notes", e.target.value)} rows={2} placeholder="Informações adicionais (opcional)" />
            </div>
            <Button onClick={handleAddEntry} className="mt-2">Registrar Entrada</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
