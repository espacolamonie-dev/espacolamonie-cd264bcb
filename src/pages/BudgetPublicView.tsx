import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { MessageCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBudgetByToken, getBudgetItems, Budget, BudgetItem } from "@/data/budgetStore";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string | null) => d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR") : "—";

export default function BudgetPublicView() {
  const { token } = useParams<{ token: string }>();
  const [budget, setBudget] = useState<Budget | null>(null);
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!token) { setNotFound(true); setLoading(false); return; }
      const b = await getBudgetByToken(token);
      if (!b) { setNotFound(true); setLoading(false); return; }
      setBudget(b);
      setItems(await getBudgetItems(b.id));
      setLoading(false);
    };
    load();
  }, [token]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-muted-foreground">Carregando orçamento...</p>
    </div>
  );

  if (notFound || !budget) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">Orçamento não encontrado</h1>
        <p className="text-muted-foreground">O link pode ter expirado ou estar incorreto.</p>
      </div>
    </div>
  );

  const contactWhatsApp = () => {
    const msg = encodeURIComponent(`Olá! Gostaria de falar sobre o orçamento para ${budget.eventType || "evento"}.`);
    window.open(`https://wa.me/5511999999999?text=${msg}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <img src="/images/logo-lamonie.png" alt="Lamoniê" className="h-10 w-10 object-contain" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>
            Orçamento
          </h1>
          <p className="text-muted-foreground mt-1">Espaço Lamoniê</p>
        </div>

        {/* Client & event info */}
        <div className="rounded-2xl border border-border bg-card p-6 mb-6 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Cliente</p>
              <p className="font-semibold text-lg">{budget.clientName}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Tipo de Evento</p>
              <p className="font-semibold">{budget.eventType || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Data do Evento</p>
              <p className="font-semibold">{fmtDate(budget.eventDate)}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Quantidade de Pessoas</p>
              <p className="font-semibold">{budget.guestCount}</p>
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden mb-6 shadow-sm">
          <div className="px-6 py-4 border-b border-border bg-muted/20">
            <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Itens do Orçamento</h2>
          </div>
          <div className="divide-y divide-border">
            {items.map(item => (
              <div key={item.id} className="px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.quantity} {item.unitLabel} × {fmt(item.unitPrice)}
                    {item.percentageApplied > 0 && ` (+${item.percentageApplied}%)`}
                  </p>
                </div>
                <p className="font-semibold text-primary">{fmt(item.finalValue)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-6 mb-6 shadow-sm">
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{fmt(budget.subtotal)}</span>
            </div>
            {budget.additionalTotal > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Adicional</span>
                <span className="font-medium">{fmt(budget.additionalTotal)}</span>
              </div>
            )}
            <div className="border-t border-primary/20 pt-3 flex justify-between">
              <span className="text-xl font-bold">Total Final</span>
              <span className="text-xl font-bold text-primary">{fmt(budget.finalTotal)}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {budget.notes && (
          <div className="rounded-2xl border border-border bg-card p-6 mb-6 shadow-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Observações</h3>
            <p className="text-sm whitespace-pre-wrap">{budget.notes}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button size="lg" onClick={contactWhatsApp} className="gap-2">
            <MessageCircle size={18} /> Falar no WhatsApp
          </Button>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-xs text-muted-foreground">
          <p>Espaço Lamoniê © {new Date().getFullYear()}</p>
        </div>
      </div>
    </div>
  );
}
