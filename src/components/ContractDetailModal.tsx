import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CalendarDays, Users, DollarSign, FileText, Plus, AlertTriangle } from "lucide-react";
import {
  getContracts,
  getClients,
  getPayments,
  getDocuments,
  addPayment,
  addDocument,
  updateContract,
} from "@/data/store";
import {
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUS_COLORS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_COLORS,
} from "@/types";
import type { Contract, Client, Payment, Document } from "@/types";

interface Props {
  contractId: string;
  onClose: () => void;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ContractDetailModal({ contractId, onClose }: Props) {
  const [contract, setContract] = useState<Contract | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [docs, setDocs] = useState<Document[]>([]);
  const [payForm, setPayForm] = useState({
    amount: 0,
    date: new Date().toISOString().split("T")[0],
    description: "",
  });

  const load = () => {
    const c = getContracts().find((c) => c.id === contractId);
    setContract(c || null);
    if (c) {
      setClient(getClients().find((cl) => cl.id === c.clientId) || null);
      setPayments(getPayments().filter((p) => p.contractId === contractId));
      setDocs(getDocuments().filter((d) => d.contractId === contractId));
    }
  };

  useEffect(load, [contractId]);

  if (!contract) return null;

  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

  const handleAddPayment = () => {
    if (payForm.amount <= 0) {
      toast.error("Informe o valor");
      return;
    }
    addPayment({ ...payForm, contractId });
    toast.success("Pagamento registrado!");
    setPayForm({ amount: 0, date: new Date().toISOString().split("T")[0], description: "" });
    load();
  };

  const handleCancel = () => {
    updateContract(contractId, {
      status: "cancelled",
      cancelledAt: new Date().toISOString(),
      cancelledBy: "Administrador",
    });
    toast.success("Contrato cancelado");
    load();
  };

  const docStatus =
    docs.length === 0
      ? "Nenhum documento"
      : docs.length < 3
      ? "Documentos pendentes"
      : "Documentos completos";

  const docStatusColor =
    docs.length === 0
      ? "text-danger"
      : docs.length < 3
      ? "text-warning"
      : "text-success";

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-3">
            Detalhes do Contrato
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${CONTRACT_STATUS_COLORS[contract.status]}`}>
              {CONTRACT_STATUS_LABELS[contract.status]}
            </span>
          </DialogTitle>
        </DialogHeader>

        {contract.status === "cancelled" && (
          <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm">
            <AlertTriangle size={16} className="text-danger" />
            <div>
              <span className="font-medium text-danger">Evento cancelado</span>
              {contract.cancelledAt && (
                <span className="ml-2 text-muted-foreground">
                  em {new Date(contract.cancelledAt).toLocaleString("pt-BR")}
                  {contract.cancelledBy && ` por ${contract.cancelledBy}`}
                </span>
              )}
            </div>
          </div>
        )}

        <Tabs defaultValue="details" className="mt-2">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="details">Evento</TabsTrigger>
            <TabsTrigger value="payments">Pagamentos</TabsTrigger>
            <TabsTrigger value="documents">Documentos</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>

          {/* Details */}
          <TabsContent value="details" className="space-y-4 pt-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <InfoRow icon={Users} label="Cliente" value={client?.name || "—"} />
              <InfoRow icon={CalendarDays} label="Data" value={new Date(contract.eventDate).toLocaleDateString("pt-BR")} />
              <InfoRow icon={CalendarDays} label="Horário" value={contract.eventTime || "—"} />
              <InfoRow icon={Users} label="Convidados" value={String(contract.guestCount)} />
              <InfoRow icon={FileText} label="Tipo" value={contract.eventType} />
              <InfoRow icon={DollarSign} label="Valor Total" value={fmt(contract.totalValue)} />
              <InfoRow icon={DollarSign} label="Sinal" value={`${contract.depositPercent}% = ${fmt(contract.depositValue)}`} />
              <InfoRow icon={DollarSign} label="Restante" value={fmt(contract.remainingValue)} />
            </div>
            {contract.status !== "cancelled" && (
              <Button variant="destructive" size="sm" onClick={handleCancel} className="mt-4">
                Cancelar Contrato
              </Button>
            )}
          </TabsContent>

          {/* Payments */}
          <TabsContent value="payments" className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Total pago: <span className="font-semibold text-foreground">{fmt(totalPaid)}</span>{" "}
                  de {fmt(contract.totalValue)}
                </p>
                <span className={`text-xs font-medium ${PAYMENT_STATUS_COLORS[contract.paymentStatus].split(" ").slice(1).join(" ")}`}>
                  {PAYMENT_STATUS_LABELS[contract.paymentStatus]}
                </span>
              </div>
            </div>

            {/* Payment list */}
            <div className="divide-y rounded-lg border">
              {payments.length === 0 ? (
                <p className="px-4 py-4 text-sm text-center text-muted-foreground">Nenhum pagamento</p>
              ) : (
                payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <p className="text-sm font-medium">{p.description || "Pagamento"}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(p.date).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <span className="font-medium text-success">{fmt(p.amount)}</span>
                  </div>
                ))
              )}
            </div>

            {/* Add payment */}
            {contract.status !== "cancelled" && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <p className="text-sm font-medium">Registrar Pagamento</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Valor (R$)</Label>
                    <Input type="number" value={payForm.amount} onChange={(e) => setPayForm((p) => ({ ...p, amount: +e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Data</Label>
                    <Input type="date" value={payForm.date} onChange={(e) => setPayForm((p) => ({ ...p, date: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">Descrição</Label>
                    <Input value={payForm.description} onChange={(e) => setPayForm((p) => ({ ...p, description: e.target.value }))} />
                  </div>
                </div>
                <Button size="sm" onClick={handleAddPayment} className="gap-1">
                  <Plus size={14} /> Adicionar
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Documents */}
          <TabsContent value="documents" className="space-y-4 pt-4">
            <p className={`text-sm font-medium ${docStatusColor}`}>{docStatus}</p>
            <div className="divide-y rounded-lg border">
              {docs.length === 0 ? (
                <p className="px-4 py-4 text-sm text-center text-muted-foreground">Nenhum documento enviado</p>
              ) : (
                docs.map((d) => (
                  <div key={d.id} className="flex items-center justify-between px-4 py-2.5">
                    <div>
                      <p className="text-sm font-medium">{d.name}</p>
                      <p className="text-xs text-muted-foreground">{d.type.toUpperCase()} • {d.fileName}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(d.createdAt).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                ))
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Para upload de documentos, habilite o Lovable Cloud para armazenamento seguro de arquivos.
            </p>
          </TabsContent>

          {/* History */}
          <TabsContent value="history" className="space-y-4 pt-4">
            <div className="divide-y rounded-lg border">
              <HistoryItem
                date={contract.createdAt}
                text={`Contrato criado • ${contract.eventType}`}
              />
              {payments.map((p) => (
                <HistoryItem
                  key={p.id}
                  date={p.createdAt}
                  text={`Pagamento de ${fmt(p.amount)} registrado`}
                />
              ))}
              {contract.cancelledAt && (
                <HistoryItem
                  date={contract.cancelledAt}
                  text={`Contrato cancelado por ${contract.cancelledBy || "—"}`}
                  danger
                />
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="rounded-lg bg-muted p-2">
        <Icon size={16} className="text-muted-foreground" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function HistoryItem({ date, text, danger }: { date: string; text: string; danger?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <div className={`h-2 w-2 rounded-full ${danger ? "bg-danger" : "bg-primary"}`} />
      <div className="flex-1">
        <p className={`text-sm ${danger ? "text-danger" : ""}`}>{text}</p>
        <p className="text-xs text-muted-foreground">
          {new Date(date).toLocaleString("pt-BR")}
        </p>
      </div>
    </div>
  );
}
