import { useState, useRef } from "react";
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { addClient, addContract, getClients, addDocument } from "@/data/store";
import type { EventType } from "@/types";
import { NumericInput } from "@/components/NumericInput";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

const EVENT_TYPES: EventType[] = [
  "Aniversário Adulto", "Aniversário Infantil", "Casamento", "Confraternização", "Evento Corporativo",
];

interface ExtractedData {
  nome: string | null;
  cpf: string | null;
  telefone: string | null;
  endereco: string | null;
  email: string | null;
  dataEvento: string | null;
  valorTotal: number | null;
  percentualSinal: number | null;
  valorSinal: number | null;
  valorRestante: number | null;
  tipoEvento: string | null;
  convidados: number | null;
}

type Step = "upload" | "processing" | "review" | "error";

export default function ImportContractModal({ open, onOpenChange, onImported }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [form, setForm] = useState({
    nome: "", cpf: "", telefone: "", endereco: "", email: "",
    dataEvento: "", valorTotal: 0, percentualSinal: 30,
    tipoEvento: "Aniversário Adulto" as EventType,
    convidados: 0,
  });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("upload");
    setFile(null);
    setExtracted(null);
    setErrorMsg("");
    setForm({
      nome: "", cpf: "", telefone: "", endereco: "", email: "",
      dataEvento: "", valorTotal: 0, percentualSinal: 30,
      tipoEvento: "Aniversário Adulto", convidados: 0,
    });
  };

  const handleFileSelect = async (f: File) => {
    if (f.type !== "application/pdf") {
      toast.error("Selecione um arquivo PDF");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx 10MB)");
      return;
    }
    setFile(f);
    setStep("processing");

    try {
      // Convert to base64
      const buffer = await f.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      const { data, error } = await supabase.functions.invoke("parse-contract-pdf", {
        body: { pdfBase64: base64 },
      });

      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Falha ao processar PDF");

      const d = data.data as ExtractedData;
      setExtracted(d);

      // Match event type
      let eventType: EventType = "Aniversário Adulto";
      if (d.tipoEvento) {
        const match = EVENT_TYPES.find((t) =>
          t.toLowerCase().includes(d.tipoEvento!.toLowerCase()) ||
          d.tipoEvento!.toLowerCase().includes(t.toLowerCase())
        );
        if (match) eventType = match;
      }

      setForm({
        nome: d.nome || "",
        cpf: d.cpf || "",
        telefone: d.telefone || "",
        endereco: d.endereco || "",
        email: d.email || "",
        dataEvento: d.dataEvento || "",
        valorTotal: d.valorTotal || 0,
        percentualSinal: d.percentualSinal || 30,
        tipoEvento: eventType,
        convidados: d.convidados || 0,
      });
      setStep("review");
    } catch (e: any) {
      console.error("PDF parse error:", e);
      setErrorMsg(e.message || "Erro ao processar PDF");
      setStep("error");
    }
  };

  const handleSave = async () => {
    if (!form.nome || !form.dataEvento) {
      toast.error("Nome e data do evento são obrigatórios");
      return;
    }
    setSaving(true);
    try {
      // Check if client exists by CPF or name
      const existingClients = await getClients();
      let clientId: string | null = null;

      if (form.cpf) {
        const match = existingClients.find((c) => c.cpf === form.cpf);
        if (match) clientId = match.id;
      }
      if (!clientId) {
        const match = existingClients.find((c) => c.name.toLowerCase() === form.nome.toLowerCase());
        if (match) clientId = match.id;
      }

      // Create client if not found
      if (!clientId) {
        const newClient = await addClient({
          name: form.nome,
          cpf: form.cpf,
          phone: form.telefone,
          email: form.email,
          address: form.endereco,
          notes: "Importado via PDF",
        });
        clientId = newClient.id;
      }

      // Create contract
      const contract = await addContract({
        clientId,
        eventType: form.tipoEvento,
        eventDate: form.dataEvento,
        eventTime: "",
        guestCount: form.convidados,
        totalValue: form.valorTotal,
        depositPercent: form.percentualSinal,
        status: "signed",
        paymentStatus: "pending",
      });

      // Attach PDF as document
      if (file) {
        try {
          await addDocument({
            contractId: contract.id,
            name: "Contrato importado (PDF)",
            type: "contract",
            file,
          });
        } catch (docErr) {
          console.warn("Failed to attach PDF:", docErr);
        }
      }

      toast.success("Contrato importado com sucesso!");
      onImported();
      onOpenChange(false);
      reset();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar contrato");
    } finally {
      setSaving(false);
    }
  };

  const set = (field: string, value: any) => setForm((p) => ({ ...p, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Importar contrato (PDF)</DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="py-8">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileSelect(f);
              }}
            />
            <div
              onClick={() => fileRef.current?.click()}
              className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border hover:border-primary/50 p-10 cursor-pointer transition-colors"
            >
              <Upload size={32} className="text-muted-foreground" />
              <p className="text-sm font-medium">Clique para selecionar o PDF do contrato</p>
              <p className="text-xs text-muted-foreground">Máximo 10MB</p>
            </div>
          </div>
        )}

        {step === "processing" && (
          <div className="flex flex-col items-center justify-center gap-4 py-12">
            <Loader2 size={36} className="animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Analisando contrato com IA...</p>
            <p className="text-xs text-muted-foreground">Isso pode levar alguns segundos</p>
          </div>
        )}

        {step === "error" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <AlertCircle size={36} className="text-danger" />
            <p className="text-sm text-center text-muted-foreground">{errorMsg}</p>
            <Button variant="outline" onClick={reset}>Tentar novamente</Button>
          </div>
        )}

        {step === "review" && (
          <div className="grid gap-4 py-2">
            <div className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 size={16} />
              <span>Dados extraídos com sucesso! Revise antes de salvar.</span>
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Nome do cliente *</Label>
              <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">CPF</Label>
                <Input value={form.cpf} onChange={(e) => set("cpf", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Telefone</Label>
                <Input value={form.telefone} onChange={(e) => set("telefone", e.target.value)} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">E-mail</Label>
              <Input value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Endereço</Label>
              <Input value={form.endereco} onChange={(e) => set("endereco", e.target.value)} />
            </div>

            <div className="border-t border-border/60 pt-3 mt-1">
              <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">Dados do Contrato</p>
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Tipo de evento</Label>
              <Select value={form.tipoEvento} onValueChange={(v) => set("tipoEvento", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Data do evento *</Label>
                <Input type="date" value={form.dataEvento} onChange={(e) => set("dataEvento", e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Convidados</Label>
                <NumericInput value={form.convidados} onChange={(v) => set("convidados", v)} placeholder="Nº" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Valor total (R$)</Label>
                <NumericInput value={form.valorTotal} onChange={(v) => set("valorTotal", v)} placeholder="Valor" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Sinal (%)</Label>
                <NumericInput value={form.percentualSinal} onChange={(v) => set("percentualSinal", v)} placeholder="30" selectOnFocus />
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving} className="mt-2 gap-2">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
              {saving ? "Salvando..." : "Criar contrato e cliente"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
