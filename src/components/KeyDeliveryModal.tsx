import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Key, Copy, ExternalLink, CheckCircle, Send } from "lucide-react";
import type { Contract, Client } from "@/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contract: Contract;
  client: Client;
  onGenerated?: () => void;
}

export default function KeyDeliveryModal({ open, onOpenChange, contract, client, onGenerated }: Props) {
  const { user } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [termLink, setTermLink] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [existingTerm, setExistingTerm] = useState<any>(null);

  const checkExisting = async () => {
    const { data } = await supabase
      .from("key_delivery_terms")
      .select("*")
      .eq("contract_id", contract.id)
      .order("created_at", { ascending: false })
      .limit(1);
    if (data && data.length > 0) {
      setExistingTerm(data[0]);
      const baseUrl = window.location.origin;
      setTermLink(`${baseUrl}/termo-chaves?token=${data[0].token}`);
    }
  };

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      checkExisting();
    } else {
      setTermLink(null);
      setExistingTerm(null);
    }
    onOpenChange(isOpen);
  };

  const handleGenerate = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.from("key_delivery_terms").insert({
        user_id: user.id,
        contract_id: contract.id,
        client_name: client.name,
        client_cpf: client.cpf || "",
        event_type: contract.eventType,
        event_date: contract.eventDate,
        event_time: contract.eventTime || "",
        delivery_datetime: new Date().toISOString(),
        status: "pending",
      }).select().single();

      if (error) throw error;

      const baseUrl = window.location.origin;
      const link = `${baseUrl}/termo-chaves?token=${data.token}`;
      setTermLink(link);
      setExistingTerm(data);
      toast.success("Termo gerado com sucesso!");
      onGenerated?.();
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar termo");
    } finally {
      setGenerating(false);
    }
  };

  const copyLink = () => {
    if (!termLink) return;
    navigator.clipboard.writeText(termLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const sendWhatsApp = () => {
    if (!termLink || !client.phone) return;
    const phone = client.phone.replace(/\D/g, "");
    const fullPhone = phone.startsWith("55") ? phone : `55${phone}`;
    const text = encodeURIComponent(
      `Olá ${client.name}! 🔑\n\nSegue o link para assinatura do Termo de Entrega de Chaves do seu evento no Espaço Lamoniê:\n\n${termLink}\n\nPor favor, assine no momento da entrega das chaves.`
    );
    window.open(`https://wa.me/${fullPhone}?text=${text}`, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key size={18} /> Termo de Entrega de Chaves
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Contract info summary */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cliente:</span>
              <span className="font-medium">{client.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Evento:</span>
              <span className="font-medium">{contract.eventType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Data:</span>
              <span className="font-medium">
                {new Date(contract.eventDate + "T12:00:00").toLocaleDateString("pt-BR")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Horário:</span>
              <span className="font-medium">{contract.eventTime || "—"}</span>
            </div>
          </div>

          {existingTerm?.status === "signed" && (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 p-3 flex items-center gap-3">
              <CheckCircle size={20} className="text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Termo já assinado</p>
                <p className="text-xs text-muted-foreground">
                  Assinado em {new Date(existingTerm.signed_at).toLocaleString("pt-BR")}
                </p>
              </div>
            </div>
          )}

          {termLink ? (
            <div className="space-y-3">
              <div className="rounded-lg border bg-card p-3">
                <p className="text-xs text-muted-foreground mb-1">Link do termo:</p>
                <code className="text-[11px] font-mono break-all select-all block bg-secondary rounded px-2 py-1.5">
                  {termLink}
                </code>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={copyLink}>
                  {linkCopied ? <CheckCircle size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  {linkCopied ? "Copiado!" : "Copiar"}
                </Button>
                <Button variant="outline" size="sm" className="flex-1 gap-1.5" onClick={() => window.open(termLink, "_blank")}>
                  <ExternalLink size={14} /> Abrir
                </Button>
              </div>

              {client.phone && (
                <Button variant="default" size="sm" className="w-full gap-1.5" onClick={sendWhatsApp}>
                  <Send size={14} /> Enviar no WhatsApp
                </Button>
              )}

              {existingTerm?.status !== "signed" && (
                <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={handleGenerate}>
                  Gerar novo termo
                </Button>
              )}
            </div>
          ) : (
            <Button onClick={handleGenerate} disabled={generating} className="w-full h-12 gap-2 font-semibold">
              {generating ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : (
                <Key size={16} />
              )}
              {generating ? "Gerando..." : "Gerar Termo de Entrega"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
