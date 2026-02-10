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
  getPayments,
  getExpenses,
  addExpense,
  deleteExpense,
  getTotalEntries,
  getTotalExpenses,
  getBalance,
  getContracts,
  getClients,
} from "@/data/store";
import type { Payment, Expense, ExpenseCategory } from "@/types";

const CATEGORIES: ExpenseCategory[] = [
  "Luz", "Água", "Funcionários", "Manutenção", "Compras", "Marketing", "Outros",
];

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function Financial() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalIn, setTotalIn] = useState(0);
  const [totalOut, setTotalOut] = useState(0);
  const [balance, setBalance] = useState(0);
  const [open, setOpen] = useState(false);
  const [expForm, setExpForm] = useState({
    description: "",
    category: "Outros" as ExpenseCategory,
    amount: 0,
    date: new Date().toISOString().split("T")[0],
  });

  const load = () => {
    setPayments(getPayments());
    setExpenses(getExpenses());
    setTotalIn(getTotalEntries());
    setTotalOut(getTotalExpenses());
    setBalance(getBalance());
  };
  useEffect(load, []);

  const handleAddExpense = () => {
    if (!expForm.description.trim() || expForm.amount <= 0) {
      toast.error("Preencha descrição e valor");
      return;
    }
    addExpense(expForm);
    toast.success("Despesa registrada!");
    setOpen(false);
    setExpForm({ description: "", category: "Outros", amount: 0, date: new Date().toISOString().split("T")[0] });
    load();
  };

  const handleDeleteExpense = (id: string) => {
    deleteExpense(id);
    toast.success("Despesa excluída");
    load();
  };

  const set = (field: string, value: any) => setExpForm((p) => ({ ...p, [field]: value }));

  // Get contract/client info for payment descriptions
  const contracts = getContracts();
  const clients = getClients();
  const contractClientMap = Object.fromEntries(
    contracts.map((c) => [c.id, clients.find((cl) => cl.id === c.clientId)?.name || "—"])
  );

  return (
    <div className="animate-fade-in space-y-4">
      <div>
        <h1 className="text-2xl font-bold font-display">Financeiro</h1>
        <p className="text-sm text-muted-foreground">Controle de entradas e saídas</p>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-success/15 p-2.5">
              <TrendingUp size={20} className="text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Entradas</p>
              <p className="text-lg font-semibold">{fmt(totalIn)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-warning/15 p-2.5">
              <TrendingDown size={20} className="text-warning" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Saídas</p>
              <p className="text-lg font-semibold">{fmt(totalOut)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className={`rounded-lg p-2.5 ${balance >= 0 ? "bg-primary/15" : "bg-danger/15"}`}>
              <Wallet size={20} className={balance >= 0 ? "text-primary" : "text-danger"} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Saldo Atual</p>
              <p className="text-lg font-semibold">{fmt(balance)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="entries" className="space-y-4">
        <TabsList>
          <TabsTrigger value="entries">Entradas</TabsTrigger>
          <TabsTrigger value="expenses">Saídas</TabsTrigger>
        </TabsList>

        <TabsContent value="entries">
          <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Data</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Cliente</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Descrição</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {payments.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhuma entrada registrada
                    </td>
                  </tr>
                ) : (
                  payments.map((p) => (
                    <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">{new Date(p.date).toLocaleDateString("pt-BR")}</td>
                      <td className="px-4 py-3 font-medium">{contractClientMap[p.contractId] || "—"}</td>
                      <td className="px-4 py-3 hidden sm:table-cell">{p.description}</td>
                      <td className="px-4 py-3 text-right font-medium text-success">{fmt(p.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="expenses">
          <div className="flex justify-end mb-3">
            <Button onClick={() => setOpen(true)} className="gap-2">
              <Plus size={16} /> Nova Despesa
            </Button>
          </div>
          <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Data</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Descrição</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Categoria</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Valor</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhuma despesa registrada
                    </td>
                  </tr>
                ) : (
                  expenses.map((e) => (
                    <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">{new Date(e.date).toLocaleDateString("pt-BR")}</td>
                      <td className="px-4 py-3 font-medium">{e.description}</td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs">{e.category}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-danger">{fmt(e.amount)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteExpense(e.id)}>
                          <Trash2 size={15} className="text-destructive" />
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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Nova Despesa</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Descrição *</Label>
              <Input value={expForm.description} onChange={(e) => set("description", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label>Categoria</Label>
                <Select value={expForm.category} onValueChange={(v) => set("category", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Valor (R$)</Label>
                <Input type="number" value={expForm.amount} onChange={(e) => set("amount", +e.target.value)} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Data</Label>
              <Input type="date" value={expForm.date} onChange={(e) => set("date", e.target.value)} />
            </div>
            <Button onClick={handleAddExpense} className="mt-2">Registrar Despesa</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
