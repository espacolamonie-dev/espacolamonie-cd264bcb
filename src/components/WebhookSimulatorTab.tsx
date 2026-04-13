import { useState } from "react";
import { CheckCircle2, XCircle, Clock, Play, Zap, ExternalLink, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface SimLog {
  id: string;
  contractId: string;
  status: string;
  timestamp: string;
  success: boolean;
  message: string;
  clientSlug?: string;
}

export default function WebhookSimulatorTab() {
  const { toast } = useToast();
  const [contractId, setContractId] = useState("");
  const [paymentId, setPaymentId] = useState(() => `SIM-${Date.now()}`);
  const [loading, setLoading] = useState<string | null>(null);
  const [logs, setLogs] = useState<SimLog[]>([]);

  const simulate = async (status: "approved" | "pending" | "rejected") => {
    if (!contractId.trim()) {
      toast({ title: "Erro", description: "Informe o ID do contrato", variant: "destructive" });
      return;
    }

    setLoading(status);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // 1. Fetch contract
      const { data: contract, error: contractError } = await supabase
        .from("contracts")
        .select("*, clients(name)")
        .eq("id", contractId.trim())
        .eq("user_id", user.id)
        .maybeSingle();

      if (contractError || !contract) {
        throw new Error("Contrato não encontrado. Verifique o ID.");
      }

      const paidAmount = Number(contract.deposit_value) || 0;
      const now = new Date();
      const today = now.toISOString().split("T")[0];
      const mpId = paymentId.trim() || `SIM-${Date.now()}`;

      let paymentStatusLabel = "";
      let newPaymentStatus = "";

      if (status === "approved") {
        // Insert payment
        const { error: payErr } = await supabase.from("payments").insert({
          user_id: user.id,
          contract_id: contract.id,
          amount: paidAmount,
          date: today,
          description: `Pagamento simulado (Webhook Test) - MP#${mpId}`,
        });
        if (payErr) console.error("Payment insert error:", payErr);

        // Recalculate
        const { data: allPayments } = await supabase
          .from("payments")
          .select("amount")
          .eq("contract_id", contract.id);

        const totalPaid = (allPayments || []).reduce((s, p) => s + Number(p.amount), 0);
        const remaining = Math.max(0, Number(contract.total_value) - totalPaid);

        if (remaining <= 0) {
          newPaymentStatus = "paid_full";
          paymentStatusLabel = "Quitado";
        } else {
          newPaymentStatus = "deposit_paid";
          paymentStatusLabel = "Sinal Pago";
        }

        await supabase
          .from("contracts")
          .update({
            remaining_value: remaining,
            payment_status: newPaymentStatus,
            mp_payment_id: mpId,
            mp_payment_status: "approved",
          })
          .eq("id", contract.id);

      } else if (status === "pending") {
        newPaymentStatus = "pending";
        paymentStatusLabel = "Pendente";
        await supabase
          .from("contracts")
          .update({
            mp_payment_id: mpId,
            mp_payment_status: "pending",
          })
          .eq("id", contract.id);

      } else {
        newPaymentStatus = "pending";
        paymentStatusLabel = "Recusado";
        await supabase
          .from("contracts")
          .update({
            mp_payment_id: mpId,
            mp_payment_status: "rejected",
          })
          .eq("id", contract.id);
      }

      // Generate slug for link
      const clientName = (contract as any).clients?.name || "cliente";
      const slug = clientName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      const log: SimLog = {
        id: crypto.randomUUID(),
        contractId: contract.id,
        status,
        timestamp: now.toLocaleString("pt-BR"),
        success: true,
        message: `${status === "approved" ? "✅" : status === "pending" ? "⚠️" : "❌"} ${paymentStatusLabel} — Contrato atualizado`,
        clientSlug: slug,
      };

      setLogs((prev) => [log, ...prev]);

      toast({
        title: status === "approved" ? "✅ Pagamento aprovado com sucesso!" : status === "pending" ? "⚠️ Pagamento pendente" : "❌ Pagamento recusado",
        description: `Contrato ${contract.id.slice(0, 8)}... atualizado para "${paymentStatusLabel}"`,
        variant: status === "rejected" ? "destructive" : "default",
      });

    } catch (err: any) {
      const log: SimLog = {
        id: crypto.randomUUID(),
        contractId: contractId.trim(),
        status,
        timestamp: new Date().toLocaleString("pt-BR"),
        success: false,
        message: `❌ Erro: ${err.message}`,
      };
      setLogs((prev) => [log, ...prev]);
      toast({ title: "Erro na simulação", description: err.message, variant: "destructive" });
    } finally {
      setLoading(null);
    }
  };

  const simulateFullFlow = async () => {
    await simulate("approved");
  };

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}/contrato/${slug}`;
    navigator.clipboard.writeText(url);
    toast({ title: "Link copiado!", description: url });
  };

  return (
    <div className="space-y-6 stagger-fade-in">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap size={20} className="text-primary" />
            Simulador de Webhook
          </CardTitle>
          <CardDescription>
            Simule notificações de pagamento do Mercado Pago para testar o sistema sem depender de pagamentos reais.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Inputs */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs">ID do contrato (external_reference)</Label>
              <Input
                value={contractId}
                onChange={(e) => setContractId(e.target.value)}
                placeholder="Cole o UUID do contrato aqui"
                className="mt-1 font-mono text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">ID do pagamento (opcional)</Label>
              <Input
                value={paymentId}
                onChange={(e) => setPaymentId(e.target.value)}
                placeholder="ID simulado"
                className="mt-1 font-mono text-xs"
              />
            </div>
          </div>

          <Separator />

          {/* Action Buttons */}
          <div className="grid gap-3 sm:grid-cols-3">
            <Button
              onClick={() => simulate("approved")}
              disabled={!!loading}
              className="gap-2 h-12 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {loading === "approved" ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <CheckCircle2 size={18} />
              )}
              Simular Aprovado
            </Button>

            <Button
              onClick={() => simulate("pending")}
              disabled={!!loading}
              variant="outline"
              className="gap-2 h-12 border-amber-500/50 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20"
            >
              {loading === "pending" ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
              ) : (
                <Clock size={18} />
              )}
              Simular Pendente
            </Button>

            <Button
              onClick={() => simulate("rejected")}
              disabled={!!loading}
              variant="outline"
              className="gap-2 h-12 border-red-500/50 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
            >
              {loading === "rejected" ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
              ) : (
                <XCircle size={18} />
              )}
              Simular Recusado
            </Button>
          </div>

          <Separator />

          {/* Full Flow */}
          <Button
            onClick={simulateFullFlow}
            disabled={!!loading}
            className="gap-2 w-full h-14 text-base"
          >
            <Play size={20} />
            🚀 Simular Fluxo Completo (Aprovado + Link)
          </Button>
        </CardContent>
      </Card>

      {/* Logs */}
      {logs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Logs de Simulação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={`rounded-xl border p-4 space-y-2 ${
                    log.success
                      ? "bg-muted/30 border-border"
                      : "bg-destructive/5 border-destructive/30"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          log.status === "approved"
                            ? "default"
                            : log.status === "pending"
                            ? "secondary"
                            : "destructive"
                        }
                        className="text-xs"
                      >
                        {log.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{log.timestamp}</span>
                    </div>
                    {log.clientSlug && log.success && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => copyLink(log.clientSlug!)}
                        >
                          <Copy size={12} /> Copiar link
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() =>
                            window.open(`/contrato/${log.clientSlug}`, "_blank")
                          }
                        >
                          <ExternalLink size={12} /> Abrir
                        </Button>
                      </div>
                    )}
                  </div>
                  <p className="text-sm">{log.message}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    Contrato: {log.contractId}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
