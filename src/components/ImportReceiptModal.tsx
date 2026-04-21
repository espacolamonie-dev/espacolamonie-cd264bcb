import { useState, useRef } from "react";
import { todayLocalStr } from "@/lib/dateUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CurrencyInput } from "@/components/CurrencyInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Upload, Loader2, CheckCircle, AlertTriangle, Camera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsMobile } from "@/hooks/use-mobile";

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

interface ReceiptData {
  amount: number | null;
  date: string | null;
  payer_name: string | null;
  receiver_name: string | null;
  bank: string | null;
  transaction_type: string | null;
  description: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "financial" | "contract" | "expense";
  contractId?: string;
  contractTotal?: number;
  contractDeposit?: number;
  totalPaid?: number;
  onImported: () => void;
}

export default function ImportReceiptModal({
  open, onOpenChange, mode, contractId, contractTotal = 0, contractDeposit = 0, totalPaid = 0, onImported
}: Props) {
  const [step, setStep] = useState<"upload" | "preview" | "saving">("upload");
  const [reading, setReading] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(todayLocalStr());
  const [description, setDescription] = useState("");
  const [paymentType, setPaymentType] = useState("sinal");
  const [paymentMethod, setPaymentMethod] = useState("Pix");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  const remaining = contractTotal - totalPaid;
  const depositRemaining = Math.max(0, contractDeposit - totalPaid);
  const isFirstPayment = totalPaid === 0;

  const reset = () => {
    setStep("upload");
    setReading(false);
    setReceiptData(null);
    setImagePreview(null);
    setAmount(0);
    setDate(todayLocalStr());
    setDescription("");
    setPaymentType(isFirstPayment ? "sinal" : "restante");
    setPaymentMethod("Pix");
  };

  const handleFile = async (file: File) => {
    setReading(true);
    
    // Show image preview
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);

    try {
      // Read file as base64
      const base64 = await new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve((r.result as string).split(",")[1]);
        r.readAsDataURL(file);
      });

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Não autenticado"); setReading(false); return; }

      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-receipt`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ image_base64: base64, mime_type: file.type }),
      });

      const result = await res.json();

      if (result.error) {
        toast.error(result.error);
        setReading(false);
        return;
      }

      const receipt = result.receipt;
      setReceiptData(receipt);
      setAmount(receipt.amount || 0);
      if (receipt.date) setDate(receipt.date);
      setDescription(receipt.description || receipt.payer_name || "Comprovante importado");
      if (receipt.bank) setPaymentMethod("Pix");
      if (receipt.transaction_type === "pix") setPaymentMethod("Pix");

      // Auto-detect payment type
      if (mode === "contract" && isFirstPayment) {
        setPaymentType("sinal");
      } else if (mode === "contract" && depositRemaining > 0) {
        setPaymentType("complemento_sinal");
      } else {
        setPaymentType("restante");
      }

      setStep("preview");
    } catch (err) {
      toast.error("Erro ao ler comprovante");
    } finally {
      setReading(false);
    }
  };

  const handleSave = async () => {
    if (amount <= 0) { toast.error("Informe o valor"); return; }
    setStep("saving");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      if (mode === "contract" && contractId) {
        // Save as payment on the contract
        const desc = paymentType === "sinal"
          ? (description || "Sinal - comprovante importado")
          : paymentType === "complemento_sinal"
            ? (description || "Complemento do sinal - comprovante importado")
            : (description || "Pagamento - comprovante importado");

        await supabase.from("payments").insert({
          contract_id: contractId,
          amount,
          date,
          description: desc,
          user_id: user.id,
        });

        // Update contract payment status and remaining
        const newTotalPaid = totalPaid + amount;
        const newRemaining = Math.max(0, contractTotal - newTotalPaid);
        let newPaymentStatus = "pending";
        if (newTotalPaid >= contractTotal) newPaymentStatus = "paid_full";
        else if (newTotalPaid > 0) newPaymentStatus = "deposit_paid";

        await supabase.from("contracts").update({
          remaining_value: newRemaining,
          payment_status: newPaymentStatus,
        }).eq("id", contractId);

        // Determine alert messages
        if (paymentType === "sinal" || paymentType === "complemento_sinal") {
          if (newTotalPaid < contractDeposit) {
            const faltaSinal = contractDeposit - newTotalPaid;
            toast.warning(`Sinal incompleto! Faltam ${fmt(faltaSinal)} para completar o sinal.`);
          } else {
            toast.success("Sinal pago integralmente!");
          }
        }

        // Save receipt image as document on the contract
        if (imagePreview) {
          try {
            const blob = await fetch(imagePreview).then(r => r.blob());
            const ext = blob.type.includes("png") ? "png" : "jpg";
            const fileName = `comprovante_${Date.now()}.${ext}`;
            const storagePath = `${user.id}/${contractId}/${fileName}`;

            const { error: uploadErr } = await supabase.storage
              .from("documents")
              .upload(storagePath, blob, { contentType: blob.type });

            if (!uploadErr) {
              await supabase.from("documents").insert({
                contract_id: contractId,
                user_id: user.id,
                name: `Comprovante - ${desc}`,
                file_name: storagePath,
                type: "comprovante",
              });
            }
          } catch (docErr) {
            console.error("Erro ao salvar comprovante nos documentos:", docErr);
          }
        }

        toast.success(`Pagamento de ${fmt(amount)} registrado via comprovante`);
      } else if (mode === "expense") {
        // Expense mode: save as PAID expense (comprovante = já foi pago)
        await supabase.from("expenses").insert({
          description: description || "Despesa importada via comprovante",
          category: "Outros",
          amount,
          date,
          due_date: date,
          paid: true,
          paid_date: date,
          payment_method: paymentMethod || "Pix",
          user_id: user.id,
        } as any);

        toast.success(`Despesa de ${fmt(amount)} registrada como paga`);
      } else {
        // Financial mode: save as manual entry
        await supabase.from("manual_entries").insert({
          description: description || "Comprovante importado",
          category: "Outro",
          amount,
          date,
          payment_method: paymentMethod,
          notes: receiptData?.bank ? `Banco: ${receiptData.bank}` : "Comprovante importado",
          user_id: user.id,
        });

        toast.success(`Entrada de ${fmt(amount)} registrada via comprovante`);
      }

      onImported();
      onOpenChange(false);
      reset();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + (err?.message || ""));
      setStep("preview");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className={isMobile ? "max-w-[100vw] w-full" : "max-w-md"}>
        <DialogHeader>
          <DialogTitle className="font-display">
            {mode === "expense" ? "Importar Comprovante de Despesa" : "Importar Comprovante"}
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Anexe a foto ou imagem do comprovante de pagamento. O sistema irá ler automaticamente os dados.
            </p>

            {reading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Lendo comprovante...</p>
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFile(file);
                    e.target.value = "";
                  }}
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="w-full h-32 border-dashed border-2 flex flex-col gap-2"
                >
                  <Upload size={24} className="text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Clique para enviar ou tirar foto</span>
                </Button>
              </div>
            )}

            {mode === "contract" && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Resumo do contrato</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <span className="text-muted-foreground">Total:</span>
                  <span className="font-medium">{fmt(contractTotal)}</span>
                  <span className="text-muted-foreground">Sinal esperado:</span>
                  <span className="font-medium">{fmt(contractDeposit)}</span>
                  <span className="text-muted-foreground">Já pago:</span>
                  <span className="font-medium text-success">{fmt(totalPaid)}</span>
                  <span className="text-muted-foreground">Pendente:</span>
                  <span className="font-medium text-warning">{fmt(remaining)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            {imagePreview && (
              <div className="rounded-lg border overflow-hidden max-h-40">
                <img src={imagePreview} alt="Comprovante" className="w-full h-40 object-contain bg-muted" />
              </div>
            )}

            {receiptData && (
              <div className="rounded-lg border border-success/30 bg-success/5 p-3 flex items-start gap-2">
                <CheckCircle size={16} className="text-success mt-0.5 shrink-0" />
                <div className="text-xs space-y-0.5">
                  <p className="font-medium text-success">Dados extraídos automaticamente</p>
                  {receiptData.bank && <p className="text-muted-foreground">Banco: {receiptData.bank}</p>}
                  {receiptData.payer_name && <p className="text-muted-foreground">Pagador: {receiptData.payer_name}</p>}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <Label className="text-xs">Valor (R$)</Label>
                <CurrencyInput value={amount} onChange={setAmount} placeholder="R$ 0,00" />
              </div>
              <div>
                <Label className="text-xs">Data</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Descrição</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição do pagamento" />
              </div>

              {mode === "contract" && (
                <div>
                  <Label className="text-xs">Tipo de pagamento</Label>
                  <Select value={paymentType} onValueChange={setPaymentType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sinal">Sinal</SelectItem>
                      <SelectItem value="complemento_sinal">Complemento do sinal</SelectItem>
                      <SelectItem value="restante">Restante</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(mode === "financial" || mode === "expense") && (
                <div>
                  <Label className="text-xs">Método de pagamento</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pix">Pix</SelectItem>
                      <SelectItem value="Transferência">Transferência</SelectItem>
                      <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="Cartão">Cartão</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {mode === "contract" && amount > 0 && (
                <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Após este pagamento</p>
                  <div className="grid grid-cols-2 gap-1 text-xs">
                    <span className="text-muted-foreground">Total pago:</span>
                    <span className="font-medium text-success">{fmt(totalPaid + amount)}</span>
                    <span className="text-muted-foreground">Restante:</span>
                    <span className="font-medium">{fmt(Math.max(0, contractTotal - totalPaid - amount))}</span>
                    {isFirstPayment && amount < contractDeposit && (
                      <>
                        <span className="text-warning">⚠ Sinal incompleto:</span>
                        <span className="font-medium text-warning">{fmt(contractDeposit - amount)}</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setStep("upload"); setImagePreview(null); }} className="flex-1">
                Voltar
              </Button>
              <Button onClick={handleSave} className="flex-1 gap-1.5">
                <CheckCircle size={14} /> Confirmar
              </Button>
            </div>
          </div>
        )}

        {step === "saving" && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Salvando pagamento...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
