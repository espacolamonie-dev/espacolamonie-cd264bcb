import { useEffect, useState } from "react";
import { todayLocalStr } from "@/lib/dateUtils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/CurrencyInput";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, UserRound, Phone, DollarSign, Edit, X, ChevronDown, FileText } from "lucide-react";
import { toast } from "sonner";

const applyPhoneMask = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const formatPhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return phone;
};

const ROLE_OPTIONS = [
  "Marketing", "Atendimento", "Limpeza", "Decoração", "Cozinha", "Segurança", "Manutenção", "Administrativo",
];

const PAYMENT_TYPES: Record<string, string> = {
  por_contrato: "Por contrato fechado",
  fixo_mensal: "Fixo mensal",
  avulso: "Avulso (sob demanda)",
};

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface Employee {
  id: string;
  name: string;
  phone: string;
  roles: string[];
  paymentValue: number;
  paymentType: string;
  isActive: boolean;
  createdAt: string;
}

interface EmployeePayment {
  id: string;
  employeeId: string;
  amount: number;
  date: string;
  description: string;
  createdAt: string;
}

interface Props {
  selectedMonth: string;
  contracts: any[];
  clients: any[];
}

export default function EmployeesTab({ selectedMonth, contracts, clients }: Props) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payments, setPayments] = useState<EmployeePayment[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [payModalEmployee, setPayModalEmployee] = useState<Employee | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [payDate, setPayDate] = useState(() => todayLocalStr());
  const [payDesc, setPayDesc] = useState("");

  const [form, setForm] = useState({
    name: "", phone: "", roles: [] as string[], paymentValue: 0, paymentType: "por_contrato",
  });

  const [year, month] = selectedMonth.split("-").map(Number);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59);

  const activeContracts = contracts.filter(c => c.status !== "cancelled");
  const contractsInMonth = activeContracts.filter(c => {
    const d = new Date(c.eventDate || c.createdAt);
    return d >= monthStart && d <= monthEnd;
  });

  // Count multi-day contracts (event_date to event_date_end) as 2 units
  const getContractUnits = (c: any): number => {
    if (c.eventDateEnd && c.eventDateEnd !== c.eventDate) return 2;
    return 1;
  };

  const contractUnitsInMonth = contractsInMonth.reduce((sum, c) => sum + getContractUnits(c), 0);

  const loadEmployees = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: empData } = await (supabase.from("employees" as any) as any)
      .select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    
    const { data: payData } = await (supabase.from("employee_payments" as any) as any)
      .select("*").eq("user_id", user.id);

    setEmployees((empData || []).map((e: any) => ({
      id: e.id, name: e.name, phone: e.phone, roles: e.roles || [],
      paymentValue: Number(e.payment_value), paymentType: e.payment_type,
      isActive: e.is_active, createdAt: e.created_at,
    })));

    setPayments((payData || []).map((p: any) => ({
      id: p.id, employeeId: p.employee_id, amount: Number(p.amount),
      date: p.date, description: p.description, createdAt: p.created_at,
    })));
  };

  useEffect(() => { loadEmployees(); }, []);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Informe o nome"); return; }
    if (form.roles.length === 0) { toast.error("Selecione pelo menos um cargo"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      user_id: user.id, name: form.name, phone: form.phone,
      roles: form.roles, payment_value: form.paymentValue,
      payment_type: form.paymentType, updated_at: new Date().toISOString(),
    };

    if (editId) {
      await (supabase.from("employees" as any) as any).update(payload).eq("id", editId);
      toast.success("Funcionário atualizado");
    } else {
      await (supabase.from("employees" as any) as any).insert(payload);
      toast.success("Funcionário cadastrado");
    }
    setAddOpen(false);
    setEditId(null);
    setForm({ name: "", phone: "", roles: [], paymentValue: 0, paymentType: "por_contrato" });
    await loadEmployees();
  };

  const handleDelete = async (id: string) => {
    await (supabase.from("employees" as any) as any).delete().eq("id", id);
    toast.success("Funcionário removido");
    await loadEmployees();
  };

  const handleAddPayment = async () => {
    if (!payModalEmployee || payAmount <= 0) { toast.error("Informe um valor"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await (supabase.from("employee_payments" as any) as any).insert({
      user_id: user.id, employee_id: payModalEmployee.id,
      amount: payAmount, date: payDate,
      description: payDesc || `Pagamento ${payModalEmployee.name}`,
    });
    toast.success("Pagamento registrado");
    setPayModalEmployee(null);
    setPayAmount(0);
    setPayDesc("");
    await loadEmployees();
  };

  const handleDeletePayment = async (id: string) => {
    await (supabase.from("employee_payments" as any) as any).delete().eq("id", id);
    toast.success("Pagamento removido");
    await loadEmployees();
  };

  const openEdit = (emp: Employee) => {
    setForm({ name: emp.name, phone: emp.phone, roles: emp.roles, paymentValue: emp.paymentValue, paymentType: emp.paymentType });
    setEditId(emp.id);
    setAddOpen(true);
  };

  const toggleRole = (role: string) => {
    setForm(f => ({
      ...f,
      roles: f.roles.includes(role) ? f.roles.filter(r => r !== role) : [...f.roles, role],
    }));
  };

  const getEmployeeTotal = (emp: Employee) => {
    if (emp.paymentType === "por_contrato") return contractUnitsInMonth * emp.paymentValue;
    if (emp.paymentType === "fixo_mensal") return emp.paymentValue;
    return 0;
  };

  const getEmployeePaid = (empId: string) => {
    return payments
      .filter(p => p.employeeId === empId && new Date(p.date) >= monthStart && new Date(p.date) <= monthEnd)
      .reduce((s, p) => s + p.amount, 0);
  };

  const totalDevido = employees.filter(e => e.isActive).reduce((s, e) => s + getEmployeeTotal(e), 0);
  const totalPago = employees.filter(e => e.isActive).reduce((s, e) => s + getEmployeePaid(e.id), 0);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 border-violet-500/30 bg-gradient-to-br from-violet-500/5 to-transparent">
          <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Total Funcionários</p>
          <p className="text-2xl font-display font-bold text-violet-600 dark:text-violet-400">{employees.filter(e => e.isActive).length}</p>
        </Card>
        <Card className="p-4 border-warning/30 bg-gradient-to-br from-warning/5 to-transparent">
          <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">A Pagar (Mês)</p>
          <p className="text-2xl font-display font-bold text-warning">{fmt(totalDevido)}</p>
          <p className="text-[10px] text-muted-foreground">{contractUnitsInMonth} diária{contractUnitsInMonth !== 1 ? "s" : ""} ({contractsInMonth.length} contrato{contractsInMonth.length !== 1 ? "s" : ""})</p>
        </Card>
        <Card className="p-4 border-success/30 bg-gradient-to-br from-success/5 to-transparent">
          <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Já Pago</p>
          <p className="text-2xl font-display font-bold text-success">{fmt(totalPago)}</p>
        </Card>
        <Card className="p-4 border-danger/30 bg-gradient-to-br from-danger/5 to-transparent">
          <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Falta Pagar</p>
          <p className="text-2xl font-display font-bold text-danger">{fmt(Math.max(0, totalDevido - totalPago))}</p>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex justify-end">
        <Button onClick={() => { setEditId(null); setForm({ name: "", phone: "", roles: [], paymentValue: 0, paymentType: "por_contrato" }); setAddOpen(true); }} className="gap-2 rounded-xl">
          <Plus size={16} /> Novo Funcionário
        </Button>
      </div>

      {/* Employee list */}
      <div className="space-y-4">
        {employees.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">
            <UserRound size={32} className="mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-sm">Nenhum funcionário cadastrado</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Clique em "Novo Funcionário" para começar</p>
          </Card>
        )}
        {employees.map(emp => {
          const total = getEmployeeTotal(emp);
          const paid = getEmployeePaid(emp.id);
          const remaining = Math.max(0, total - paid);
          const empPayments = payments.filter(p => p.employeeId === emp.id && new Date(p.date) >= monthStart && new Date(p.date) <= monthEnd);

          return (
            <Card key={emp.id} className="p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="rounded-full bg-violet-500/15 p-2.5 shrink-0">
                      <UserRound size={18} className="text-violet-500" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display font-bold text-base truncate">{emp.name}</h3>
                      {emp.phone && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone size={10} /> {formatPhone(emp.phone)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {emp.roles.map(role => (
                      <Badge key={role} variant="secondary" className="text-[10px] px-2 py-0.5">{role}</Badge>
                    ))}
                    <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-violet-500/30 text-violet-600">
                      {PAYMENT_TYPES[emp.paymentType]}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-2 rounded-lg bg-violet-500/5 border border-violet-500/10">
                      <p className="text-[9px] text-muted-foreground uppercase font-semibold">Deve</p>
                      <p className="text-sm font-bold text-violet-600 dark:text-violet-400">{fmt(total)}</p>
                      {emp.paymentType === "por_contrato" && (
                        <p className="text-[9px] text-muted-foreground">{contractsInMonth.length}× {fmt(emp.paymentValue)}</p>
                      )}
                    </div>
                    <div className="p-2 rounded-lg bg-success/5 border border-success/10">
                      <p className="text-[9px] text-muted-foreground uppercase font-semibold">Pago</p>
                      <p className="text-sm font-bold text-success">{fmt(paid)}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-danger/5 border border-danger/10">
                      <p className="text-[9px] text-muted-foreground uppercase font-semibold">Falta</p>
                      <p className="text-sm font-bold text-danger">{fmt(remaining)}</p>
                    </div>
                  </div>

                  {/* Payment history */}
                  {empPayments.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase">Pagamentos no mês</p>
                      {empPayments.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-2 rounded-lg border bg-card text-sm">
                          <div>
                            <p className="text-xs font-medium">{p.description}</p>
                            <p className="text-[10px] text-muted-foreground">{new Date(p.date).toLocaleDateString("pt-BR")}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-success">{fmt(p.amount)}</p>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive">
                                  <Trash2 size={12} />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir pagamento?</AlertDialogTitle>
                                  <AlertDialogDescription>"{p.description}" de {fmt(p.amount)} será removido permanentemente.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeletePayment(p.id)} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1.5 shrink-0">
                  <Button size="sm" variant="outline" className="gap-1.5 text-xs rounded-lg" onClick={() => { setPayModalEmployee(emp); setPayAmount(0); setPayDesc(""); setPayDate(todayLocalStr()); }}>
                    <DollarSign size={12} /> Pagar
                  </Button>
                  <Button size="sm" variant="ghost" className="gap-1.5 text-xs rounded-lg" onClick={() => openEdit(emp)}>
                    <Edit size={12} /> Editar
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="gap-1.5 text-xs rounded-lg text-destructive hover:text-destructive">
                        <Trash2 size={12} /> Excluir
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir {emp.name}?</AlertDialogTitle>
                        <AlertDialogDescription>Todos os pagamentos registrados também serão removidos.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(emp.id)} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Add/Edit Employee Modal */}
      <Dialog open={addOpen} onOpenChange={(open) => { if (!open) { setEditId(null); } setAddOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl flex items-center gap-2">
              <UserRound size={20} className="text-violet-500" />
              {editId ? "Editar Funcionário" : "Novo Funcionário"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome do funcionário" className="rounded-lg h-11" />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: applyPhoneMask(e.target.value) }))} placeholder="(31) 99999-9999" className="rounded-lg h-11" />
            </div>
            <div className="space-y-2">
              <Label>Cargos *</Label>
              <div className="flex flex-wrap gap-2">
                {ROLE_OPTIONS.map(role => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRole(role)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      form.roles.includes(role)
                        ? "bg-violet-500 text-white border-violet-500"
                        : "bg-card border-border text-muted-foreground hover:border-violet-500/50"
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tipo de pagamento</Label>
              <Select value={form.paymentType} onValueChange={v => setForm(f => ({ ...f, paymentType: v }))}>
                <SelectTrigger className="rounded-lg h-11"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="por_contrato">Por contrato fechado</SelectItem>
                  <SelectItem value="fixo_mensal">Fixo mensal</SelectItem>
                  <SelectItem value="avulso">Avulso (sob demanda)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{form.paymentType === "por_contrato" ? "Valor por contrato" : form.paymentType === "fixo_mensal" ? "Valor mensal" : "Valor padrão"}</Label>
              <CurrencyInput value={form.paymentValue} onChange={v => setForm(f => ({ ...f, paymentValue: v }))} placeholder="R$ 0,00" />
              {form.paymentType === "avulso" && (
                <p className="text-[10px] text-muted-foreground">Para funcionários avulsos, registre cada pagamento individualmente.</p>
              )}
            </div>
            <Button onClick={handleSave} className="w-full rounded-lg h-11 text-base mt-2">
              {editId ? "Salvar Alterações" : "Cadastrar Funcionário"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Pay Employee Modal */}
      <Dialog open={!!payModalEmployee} onOpenChange={(open) => { if (!open) setPayModalEmployee(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-lg flex items-center gap-2">
              <DollarSign size={18} className="text-success" />
              Pagar {payModalEmployee?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Valor *</Label>
              <CurrencyInput value={payAmount} onChange={setPayAmount} placeholder="R$ 0,00" />
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="rounded-lg h-11" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={payDesc} onChange={e => setPayDesc(e.target.value)} placeholder="Ex: Pagamento semanal" className="rounded-lg h-11" />
            </div>
            <Button onClick={handleAddPayment} className="w-full rounded-lg h-11">Registrar Pagamento</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
