import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Brain, TrendingUp, TrendingDown, Wallet, Target, AlertTriangle,
  CheckCircle2, Plus, Sparkles, Calculator, CreditCard, Send, Loader2, Trash2
} from "lucide-react";

type Expense = {
  id: string;
  description: string;
  amount: number;
  date: string;
  due_date: string | null;
  category: string;
  payment_method: string;
  is_fixed: boolean;
  parent_expense_id: string | null;
  installment_number: number | null;
  total_installments: number | null;
};

type Payment = { amount: number; date: string; contract_id: string };
type Contract = { id: string; total_value: number; remaining_value: number; deposit_value: number; status: string; payment_status: string; event_date: string };
type ManualEntry = { amount: number; date: string };

const BRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const todayISO = () => new Date().toISOString().slice(0, 10);

export default function FinancialAI() {
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [manualEntries, setManualEntries] = useState<ManualEntry[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);

  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const monthEndISO = monthEnd.toISOString().slice(0, 10);
  const monthStartISO = monthStart.toISOString().slice(0, 10);

  // ---- Load data ----
  const loadAll = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [exp, pay, me, ct] = await Promise.all([
      supabase.from("expenses").select("*").eq("user_id", user.id),
      supabase.from("payments").select("amount,date,contract_id").eq("user_id", user.id),
      supabase.from("manual_entries").select("amount,date").eq("user_id", user.id),
      supabase.from("contracts").select("id,total_value,remaining_value,deposit_value,status,payment_status,event_date").eq("user_id", user.id),
    ]);

    setExpenses((exp.data as Expense[]) || []);
    setPayments((pay.data as Payment[]) || []);
    setManualEntries((me.data as ManualEntry[]) || []);
    setContracts((ct.data as Contract[]) || []);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  // ---- Compute KPIs ----
  const kpis = useMemo(() => {
    const inMonth = (d: string) => d >= monthStartISO && d <= monthEndISO;

    const recebidoMes =
      payments.filter(p => inMonth(p.date)).reduce((s, p) => s + Number(p.amount), 0) +
      manualEntries.filter(e => inMonth(e.date)).reduce((s, e) => s + Number(e.amount), 0);

    const despesasMes = expenses
      .filter(e => inMonth(e.due_date || e.date))
      .reduce((s, e) => s + Number(e.amount), 0);

    // A receber: contratos ativos com remaining > 0 e evento ainda não passou ou pagamento pendente
    const aReceberTotal = contracts
      .filter(c => c.status !== "cancelled" && Number(c.remaining_value) > 0)
      .reduce((s, c) => s + Number(c.remaining_value), 0);

    // Despesas previstas até fim do mês ainda não consideradas como pagas (todas no mês)
    const despesasFuturasMes = expenses
      .filter(e => {
        const ref = e.due_date || e.date;
        return ref >= todayISO() && ref <= monthEndISO;
      })
      .reduce((s, e) => s + Number(e.amount), 0);

    // Receita projetada do mês: recebido + parcela de "a receber" estimada (assumimos que entradas pendentes do mês caem se contrato é deste mês)
    const aReceberMes = contracts
      .filter(c => c.event_date >= monthStartISO && c.event_date <= monthEndISO && c.status !== "cancelled")
      .reduce((s, c) => s + Number(c.remaining_value), 0);

    const receitaProjetada = recebidoMes + aReceberMes;
    const lucroAtual = recebidoMes - despesasMes;
    const lucroProjetado = receitaProjetada - despesasMes - despesasFuturasMes + (despesasMes - despesasFuturasMes); 
    // simplificação: lucro projetado = receita projetada - todas as despesas do mês
    const lucroProjetadoFinal = receitaProjetada - despesasMes;

    // Caixa estimado = recebido - despesas já pagas (assumimos despesas com data <= hoje)
    const despesasPagas = expenses
      .filter(e => (e.due_date || e.date) <= todayISO())
      .reduce((s, e) => s + Number(e.amount), 0);
    const caixaAtual = recebidoMes - despesasPagas;

    // Compromissos futuros (próximos 90 dias) — parcelas
    const horizonte = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const compromissos90d = expenses
      .filter(e => {
        const ref = e.due_date || e.date;
        return ref > todayISO() && ref <= horizonte;
      })
      .reduce((s, e) => s + Number(e.amount), 0);

    // Margem
    const margem = receitaProjetada > 0 ? (lucroProjetadoFinal / receitaProjetada) * 100 : 0;

    return {
      recebidoMes, despesasMes, lucroAtual, receitaProjetada,
      lucroProjetado: lucroProjetadoFinal, despesasFuturasMes, aReceberTotal,
      aReceberMes, caixaAtual, compromissos90d, margem,
    };
  }, [expenses, payments, manualEntries, contracts]);

  // ---- Alertas ----
  const alertas = useMemo(() => {
    const arr: { tipo: "ok" | "warn" | "danger"; msg: string }[] = [];
    if (kpis.lucroProjetado < 0) arr.push({ tipo: "danger", msg: "Projeção de prejuízo neste mês. Reduza despesas ou aumente vendas." });
    if (kpis.margem < 15 && kpis.receitaProjetada > 0) arr.push({ tipo: "warn", msg: `Margem baixa (${kpis.margem.toFixed(1)}%). Ideal acima de 25%.` });
    if (kpis.caixaAtual < kpis.compromissos90d * 0.3) arr.push({ tipo: "warn", msg: "Caixa abaixo de 30% dos compromissos dos próximos 90 dias." });
    if (kpis.despesasMes > kpis.recebidoMes && kpis.recebidoMes > 0) arr.push({ tipo: "warn", msg: "Despesas do mês superaram o recebido. Atenção ao caixa." });
    if (arr.length === 0) arr.push({ tipo: "ok", msg: "Tudo em ordem. Saúde financeira saudável neste mês." });
    return arr;
  }, [kpis]);

  // ---- Próximas parcelas ----
  const proximasParcelas = useMemo(() => {
    return expenses
      .filter(e => e.installment_number && e.total_installments && (e.due_date || e.date) >= todayISO())
      .sort((a, b) => (a.due_date || a.date).localeCompare(b.due_date || b.date))
      .slice(0, 10);
  }, [expenses]);

  const ticketMedio = useMemo(() => {
    const fechados = contracts.filter(c => c.status !== "cancelled");
    if (!fechados.length) return 0;
    return fechados.reduce((s, c) => s + Number(c.total_value), 0) / fechados.length;
  }, [contracts]);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-semibold flex items-center gap-2" style={{ fontFamily: "var(--font-display)" }}>
            <Brain className="h-7 w-7 text-primary" />
            Financeiro Inteligente
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Consultor financeiro completo: projeções, parcelas e decisões em tempo real.</p>
        </div>
        <div className="flex gap-2">
          <NewExpenseDialog onSaved={loadAll} />
          <SimulatorDialog kpis={kpis} />
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard icon={<Wallet className="h-4 w-4" />} label="Caixa Atual" value={BRL(kpis.caixaAtual)} tone={kpis.caixaAtual >= 0 ? "good" : "bad"} />
            <KpiCard icon={<TrendingUp className="h-4 w-4 text-emerald-500" />} label="Recebido no mês" value={BRL(kpis.recebidoMes)} />
            <KpiCard icon={<TrendingDown className="h-4 w-4 text-rose-500" />} label="Despesas do mês" value={BRL(kpis.despesasMes)} />
            <KpiCard icon={<Target className="h-4 w-4 text-primary" />} label="Lucro projetado" value={BRL(kpis.lucroProjetado)} tone={kpis.lucroProjetado >= 0 ? "good" : "bad"} />
          </div>

          {/* Projeção + Alertas */}
          <div className="grid lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Projeção até o fim do mês</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Row label="Receita projetada" value={BRL(kpis.receitaProjetada)} />
                <Row label="A receber este mês" value={BRL(kpis.aReceberMes)} sub />
                <Row label="A receber total (todos contratos)" value={BRL(kpis.aReceberTotal)} sub />
                <Row label="Despesas previstas até fim do mês" value={BRL(kpis.despesasFuturasMes)} sub />
                <Row label="Compromissos próximos 90 dias" value={BRL(kpis.compromissos90d)} sub />
                <div className="border-t pt-3 mt-3">
                  <Row label="Lucro projetado" value={BRL(kpis.lucroProjetado)} bold />
                  <Row label="Margem projetada" value={`${kpis.margem.toFixed(1)}%`} bold />
                  <Row label="Ticket médio" value={BRL(ticketMedio)} bold />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Alertas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {alertas.map((a, i) => (
                  <div key={i} className={`text-sm rounded-lg p-3 border flex gap-2 items-start ${
                    a.tipo === "ok" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300" :
                    a.tipo === "warn" ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300" :
                    "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300"
                  }`}>
                    {a.tipo === "ok" ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />}
                    <span>{a.msg}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="parcelas">
            <TabsList>
              <TabsTrigger value="parcelas"><CreditCard className="h-4 w-4 mr-2" />Próximas parcelas</TabsTrigger>
              <TabsTrigger value="despesas">Despesas cadastradas</TabsTrigger>
              <TabsTrigger value="ia"><Brain className="h-4 w-4 mr-2" />Consultor IA</TabsTrigger>
            </TabsList>

            <TabsContent value="parcelas">
              <Card>
                <CardContent className="pt-6">
                  {proximasParcelas.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhuma parcela futura cadastrada.</p>
                  ) : (
                    <div className="space-y-2">
                      {proximasParcelas.map(p => (
                        <div key={p.id} className="flex items-center justify-between border rounded-lg p-3">
                          <div>
                            <p className="font-medium text-sm">{p.description}</p>
                            <p className="text-xs text-muted-foreground">
                              Parcela {p.installment_number}/{p.total_installments} · {new Date((p.due_date || p.date) + "T12:00:00").toLocaleDateString("pt-BR")} · {p.category}
                            </p>
                          </div>
                          <span className="font-semibold text-rose-600">{BRL(Number(p.amount))}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="despesas">
              <ExpensesList expenses={expenses} onChanged={loadAll} />
            </TabsContent>

            <TabsContent value="ia">
              <AIConsultant kpis={kpis} ticketMedio={ticketMedio} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

// ---- Components ----
function KpiCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
        <p className={`mt-1 text-xl font-semibold ${tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-rose-600" : ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function Row({ label, value, sub, bold }: { label: string; value: string; sub?: boolean; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${sub ? "text-xs text-muted-foreground" : "text-sm"} ${bold ? "font-semibold !text-foreground" : ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function NewExpenseDialog({ onSaved }: { onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    description: "", amount: "", category: "Outros", payment_method: "pix",
    is_fixed: false, due_date: todayISO(), parcelado: false, total_installments: "1",
  });

  const reset = () => setForm({ description: "", amount: "", category: "Outros", payment_method: "pix", is_fixed: false, due_date: todayISO(), parcelado: false, total_installments: "1" });

  const save = async () => {
    if (!form.description.trim() || !form.amount) { toast.error("Preencha descrição e valor"); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const totalAmount = parseFloat(form.amount.replace(",", "."));
    const parcelas = form.parcelado ? Math.max(1, parseInt(form.total_installments) || 1) : 1;
    const valorParcela = totalAmount / parcelas;
    const baseDate = new Date(form.due_date + "T12:00:00");

    if (parcelas === 1) {
      const { error } = await supabase.from("expenses").insert({
        user_id: user.id,
        description: form.description,
        amount: totalAmount,
        category: form.category,
        date: form.due_date,
        due_date: form.due_date,
        payment_method: form.payment_method,
        is_fixed: form.is_fixed,
      });
      if (error) { toast.error(error.message); setSaving(false); return; }
    } else {
      // Cria primeira como "pai" e depois as filhas
      const { data: parent, error: e1 } = await supabase.from("expenses").insert({
        user_id: user.id,
        description: `${form.description} (1/${parcelas})`,
        amount: valorParcela,
        category: form.category,
        date: form.due_date,
        due_date: form.due_date,
        payment_method: form.payment_method,
        is_fixed: false,
        installment_number: 1,
        total_installments: parcelas,
      }).select("id").single();
      if (e1 || !parent) { toast.error(e1?.message || "Erro"); setSaving(false); return; }

      const restantes = [];
      for (let i = 2; i <= parcelas; i++) {
        const d = new Date(baseDate);
        d.setMonth(d.getMonth() + (i - 1));
        const iso = d.toISOString().slice(0, 10);
        restantes.push({
          user_id: user.id,
          description: `${form.description} (${i}/${parcelas})`,
          amount: valorParcela,
          category: form.category,
          date: iso,
          due_date: iso,
          payment_method: form.payment_method,
          is_fixed: false,
          parent_expense_id: parent.id,
          installment_number: i,
          total_installments: parcelas,
        });
      }
      const { error: e2 } = await supabase.from("expenses").insert(restantes);
      if (e2) { toast.error(e2.message); setSaving(false); return; }
    }

    toast.success(parcelas > 1 ? `${parcelas} parcelas criadas` : "Despesa criada");
    setSaving(false);
    setOpen(false);
    reset();
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4" />Nova despesa</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nova despesa</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Descrição</Label>
            <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Ex: Reforma cozinha" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor total (R$)</Label>
              <Input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <Label>Vencimento</Label>
              <Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Funcionários", "Marketing", "Manutenção", "Reformas", "Aluguel", "Compras", "Outros"].map(c =>
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Forma de pagamento</Label>
              <Select value={form.payment_method} onValueChange={v => setForm({ ...form, payment_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">Pix</SelectItem>
                  <SelectItem value="debito">Débito</SelectItem>
                  <SelectItem value="credito">Crédito</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between border rounded-lg p-3">
            <div>
              <p className="text-sm font-medium">Despesa fixa/recorrente</p>
              <p className="text-xs text-muted-foreground">Marca como gasto fixo mensal</p>
            </div>
            <Switch checked={form.is_fixed} onCheckedChange={v => setForm({ ...form, is_fixed: v })} />
          </div>
          <div className="flex items-center justify-between border rounded-lg p-3">
            <div>
              <p className="text-sm font-medium">Parcelado</p>
              <p className="text-xs text-muted-foreground">Divide o valor em parcelas mensais</p>
            </div>
            <Switch checked={form.parcelado} onCheckedChange={v => setForm({ ...form, parcelado: v })} />
          </div>
          {form.parcelado && (
            <div>
              <Label>Número de parcelas</Label>
              <Input type="number" min="2" max="36" value={form.total_installments} onChange={e => setForm({ ...form, total_installments: e.target.value })} />
              {form.amount && parseInt(form.total_installments) > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {form.total_installments}x de {BRL(parseFloat(form.amount.replace(",", ".")) / parseInt(form.total_installments))}
                </p>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExpensesList({ expenses, onChanged }: { expenses: Expense[]; onChanged: () => void }) {
  const remove = async (e: Expense) => {
    if (!confirm(`Excluir "${e.description}"?${e.installment_number === 1 && e.total_installments && e.total_installments > 1 ? " Todas as parcelas serão removidas." : ""}`)) return;
    // Se for "pai" (installment 1 com filhas), remove pai e cascata
    if (e.installment_number === 1 && e.total_installments && e.total_installments > 1) {
      await supabase.from("expenses").delete().or(`id.eq.${e.id},parent_expense_id.eq.${e.id}`);
    } else {
      await supabase.from("expenses").delete().eq("id", e.id);
    }
    toast.success("Removido");
    onChanged();
  };

  const sorted = [...expenses].sort((a, b) => (b.due_date || b.date).localeCompare(a.due_date || a.date));

  return (
    <Card>
      <CardContent className="pt-6">
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma despesa cadastrada ainda.</p>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {sorted.map(e => (
              <div key={e.id} className="flex items-center justify-between border rounded-lg p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{e.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date((e.due_date || e.date) + "T12:00:00").toLocaleDateString("pt-BR")} · {e.category} · {e.payment_method}
                    {e.is_fixed && " · fixa"}
                  </p>
                </div>
                <span className="font-semibold text-rose-600 mr-2">{BRL(Number(e.amount))}</span>
                <Button variant="ghost" size="icon" onClick={() => remove(e)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SimulatorDialog({ kpis }: { kpis: any }) {
  const [open, setOpen] = useState(false);
  const [valor, setValor] = useState("");
  const [parcelas, setParcelas] = useState("1");

  const v = parseFloat(valor.replace(",", ".")) || 0;
  const np = Math.max(1, parseInt(parcelas) || 1);
  const valorParcela = v / np;
  const novoCaixa = kpis.caixaAtual - (np === 1 ? v : valorParcela);
  const novoLucro = kpis.lucroProjetado - v;
  const seguro = novoLucro >= 0 && novoCaixa >= 0;
  const atencao = novoLucro >= 0 && novoCaixa < 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline"><Calculator className="h-4 w-4" />Simular compra</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Simulador de compra</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Valor da compra</Label>
            <Input type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} placeholder="1500" />
          </div>
          <div>
            <Label>Parcelas</Label>
            <Input type="number" min="1" max="24" value={parcelas} onChange={e => setParcelas(e.target.value)} />
            {v > 0 && np > 1 && <p className="text-xs text-muted-foreground mt-1">{np}x de {BRL(valorParcela)}</p>}
          </div>
          {v > 0 && (
            <div className="rounded-lg border p-4 space-y-2 bg-muted/40">
              <div className="flex justify-between text-sm"><span>Caixa atual</span><span className="font-medium">{BRL(kpis.caixaAtual)}</span></div>
              <div className="flex justify-between text-sm"><span>Impacto imediato</span><span className="font-medium text-rose-600">-{BRL(np === 1 ? v : valorParcela)}</span></div>
              <div className="flex justify-between text-sm"><span>Novo caixa</span><span className={`font-semibold ${novoCaixa >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{BRL(novoCaixa)}</span></div>
              <div className="flex justify-between text-sm border-t pt-2"><span>Lucro projetado mês</span><span className="font-medium">{BRL(kpis.lucroProjetado)}</span></div>
              <div className="flex justify-between text-sm"><span>Novo lucro projetado</span><span className={`font-semibold ${novoLucro >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{BRL(novoLucro)}</span></div>
              <div className={`text-center py-2 rounded font-semibold mt-2 ${
                seguro ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" :
                atencao ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" :
                "bg-rose-500/15 text-rose-700 dark:text-rose-300"
              }`}>
                {seguro ? "✅ Compra segura" : atencao ? "⚠️ Atenção: caixa ficará negativo" : "❌ Evite: lucro projetado negativo"}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AIConsultant({ kpis, ticketMedio }: { kpis: any; ticketMedio: number }) {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([
    { role: "assistant", content: "Olá! Sou seu consultor financeiro. Pergunte coisas como:\n\n• \"Posso comprar algo de R$ 1.500 agora?\"\n• \"Quanto posso gastar hoje sem prejudicar o mês?\"\n• \"Quando posso comprar algo de R$ 3.000?\"\n• \"Qual meu lucro previsto?\"" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const ask = async () => {
    if (!input.trim() || loading) return;
    const q = input.trim();
    setMessages(m => [...m, { role: "user", content: q }]);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("financial-advisor", {
        body: {
          question: q,
          context: {
            caixa_atual: kpis.caixaAtual,
            recebido_no_mes: kpis.recebidoMes,
            despesas_do_mes: kpis.despesasMes,
            despesas_futuras_ate_fim_do_mes: kpis.despesasFuturasMes,
            a_receber_este_mes: kpis.aReceberMes,
            a_receber_total: kpis.aReceberTotal,
            receita_projetada_mes: kpis.receitaProjetada,
            lucro_projetado_mes: kpis.lucroProjetado,
            margem_percent: kpis.margem,
            compromissos_proximos_90_dias: kpis.compromissos90d,
            ticket_medio: ticketMedio,
          },
        },
      });
      if (error) throw error;
      setMessages(m => [...m, { role: "assistant", content: data?.answer || "Sem resposta." }]);
    } catch (e: any) {
      const msg = e?.message?.includes("429") ? "Muitas requisições. Aguarde alguns segundos." :
        e?.message?.includes("402") ? "Créditos de IA esgotados. Adicione créditos no workspace." :
        "Erro ao consultar IA. Tente novamente.";
      toast.error(msg);
      setMessages(m => [...m, { role: "assistant", content: msg }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-3 max-h-[420px] overflow-y-auto mb-4 pr-2">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}>{m.content}</div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start"><div className="bg-muted rounded-2xl px-4 py-2.5"><Loader2 className="h-4 w-4 animate-spin" /></div></div>
          )}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Pergunte algo ao consultor..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && ask()}
            disabled={loading}
          />
          <Button onClick={ask} disabled={loading || !input.trim()}><Send className="h-4 w-4" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}
