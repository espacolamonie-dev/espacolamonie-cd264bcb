import { useEffect, useState } from "react";
import { Plus, TrendingUp, TrendingDown, Wallet, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  getPayments, getExpenses, addExpense, deleteExpense,
  getTotalEntries, getTotalExpenses, getBalance, getContracts, getClients,
} from "@/data/store";
import type { Payment, Expense, ExpenseCategory } from "@/types";

const CATEGORIES: ExpenseCategory[] = [
  "Luz", "Água", "Funcionários", "Manutenção", "Compras", "Marketing", "Outros",
];

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Financial() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalIn, setTotalIn] = useState(0);
  const [totalOut, setTotalOut] = useState(0);
  const [balance, setBalance] = useState(0);
  const [open, setOpen] = useState(false);
  const [expForm, setExpForm] = useState({
    description: "", category: "Outros" as ExpenseCategory, amount: 0,
    date: new Date().toISOString().split("T")[0],
  });

  const load = () => {
    setPayments(getPayments()); setExpenses(getExpenses());
    setTotalIn(getTotalEntries()); setTotalOut(getTotalExpenses()); setBalance(getBalance());
  };
  useEffect(load, []);

  const handleAddExpense = () => {
    if (!expForm.description.trim() || expForm.amount <= 0) { toast.error("Preencha descrição e valor"); return; }
    addExpense(expForm); toast.success("Despesa registrada!");
    setOpen(false);
    setExpForm({ description: "", category: "Outros", amount: 0, date: new Date().toISOString().split("T")[0] });
    load();
  };

  const handleDeleteExpense = (id: string) => { deleteExpense(id); toast.success("Despesa excluída"); load(); };
  const set = (field: string, value: any) => setExpForm((p) => ({ ...p, [field]: value }));

  const contracts = getContracts();
  const clients = getClients();
  const contractClientMap = Object.fromEntries(
    contracts.map((c) => [c.id, clients.find((cl) => cl.id === c.clientId)?.name || "—"])
  );

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
          <div className="rounded-lg border border-border/60 bg-card overflow-x-auto">
            <table className="table-premium">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Cliente</th>
                  <th className="hidden sm:table-cell">Descrição</th>
                  <th className="text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {payments.length === 0 ? (
                  <tr><td colSpan={4} className="!py-10 text-center text-muted-foreground">Nenhuma entrada registrada</td></tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id}>
                      <td className="text-muted-foreground tabular-nums">{new Date(p.date).toLocaleDateString("pt-BR")}</td>
                      <td className="font-medium">{contractClientMap[p.contractId] || "—"}</td>
                      <td className="hidden sm:table-cell text-muted-foreground">{p.description}</td>
                      <td className="text-right font-medium text-success tabular-nums">{fmt(p.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="expenses">
          <div className="flex justify-end mb-3">
            <Button onClick={() => setOpen(true)} size="sm" className="gap-2 h-9">
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Nova Despesa</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Descrição *</Label>
              <Input value={expForm.description} onChange={(e) => set("description", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Categoria</Label>
                <Select value={expForm.category} onValueChange={(v) => set("category", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Valor (R$)</Label>
                <Input type="number" value={expForm.amount} onChange={(e) => set("amount", +e.target.value)} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Data</Label>
              <Input type="date" value={expForm.date} onChange={(e) => set("date", e.target.value)} />
            </div>
            <Button onClick={handleAddExpense} className="mt-2">Registrar Despesa</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
