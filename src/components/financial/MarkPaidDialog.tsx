import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  count: number;                // quantas parcelas serão marcadas
  totalAmount?: number;         // soma opcional para mostrar
  defaultDate?: string;         // ISO yyyy-mm-dd
  onConfirm: (paidDate: string) => Promise<void> | void;
  title?: string;
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const BRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function MarkPaidDialog({
  open, onOpenChange, count, totalAmount, defaultDate, onConfirm, title,
}: Props) {
  const [date, setDate] = useState(defaultDate || todayISO());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDate(defaultDate || todayISO());
  }, [open, defaultDate]);

  const submit = async () => {
    setSaving(true);
    try {
      await onConfirm(date);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            {title || (count > 1 ? `Marcar ${count} parcelas como pagas` : "Marcar parcela como paga")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {typeof totalAmount === "number" && totalAmount > 0 && (
            <p className="text-sm text-muted-foreground">
              Total: <strong className="text-foreground">{BRL(totalAmount)}</strong>
              {count > 1 && ` em ${count} parcelas`}
            </p>
          )}
          <div>
            <Label>Data do pagamento</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">
              Use a data real do desembolso (útil para antecipações).
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar pagamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
