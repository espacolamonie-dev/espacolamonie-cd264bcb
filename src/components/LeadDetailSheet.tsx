import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Phone, CalendarDays, FileText, CreditCard, MessageSquare, Clock, Save, Trash2 } from "lucide-react";
import {
  type Lead, type LeadStatusEntry,
  getLeadHistory, updateLead, deleteLead, openWhatsApp,
  getTemplates, getDefaultTemplate, resolveTemplate,
  getPixSettings,
} from "@/data/leadsStore";
import {
  type PipelineStage,
  buildStageLabels, buildStageColors,
} from "@/data/pipelineStore";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { getSafeErrorMessage } from "@/lib/errorSanitizer";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Props {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onScheduleVisit?: (lead: Lead) => void;
  onGenerateContract?: (lead: Lead) => void;
  stages?: PipelineStage[];
}

export default function LeadDetailSheet({ lead, open, onClose, onRefresh, onScheduleVisit, onGenerateContract, stages = [] }: Props) {
  const [history, setHistory] = useState<LeadStatusEntry[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const STAGE_LABELS = buildStageLabels(stages);
  const STAGE_COLORS = buildStageColors(stages);

  useEffect(() => {
    if (lead) {
      setNotes(lead.notes || "");
      getLeadHistory(lead.id).then(setHistory).catch(() => {});
    }
  }, [lead]);

  if (!lead) return null;

  const handleSaveNotes = async () => {
    setSaving(true);
    try {
      await updateLead(lead.id, { notes } as any);
      toast.success("Observações salvas");
      onRefresh();
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteLead(lead.id);
      toast.success("Lead excluído");
      onClose();
      onRefresh();
    } catch {
      toast.error("Erro ao excluir");
    }
  };

  const handleSendMessage = async (templateKey: string) => {
    const templates = await getTemplates();
    const found = templates.find((t) => t.template_key === templateKey);
    const text = found?.template_text || getDefaultTemplate(templateKey);
    const pix = await getPixSettings();

    const resolved = resolveTemplate(text, {
      nome: lead.name,
      data_evento: lead.interest_date ? new Date(lead.interest_date + "T12:00:00").toLocaleDateString("pt-BR") : "—",
      hora_visita: "—",
      valor_total: "—",
      valor_sinal: "—",
      chave_pix: pix?.pix_key || "—",
      banco: pix?.bank || "—",
      favorecido: pix?.beneficiary_name || "—",
      link_contrato: "—",
    });

    openWhatsApp(lead.phone, resolved);
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="font-display text-xl">{lead.name}</SheetTitle>
          <Badge className={`w-fit text-[10px] font-medium border rounded-full px-2.5 py-0.5 ${STAGE_COLORS[lead.stage] || ""}`}>
            {STAGE_LABELS[lead.stage] || lead.stage}
          </Badge>
        </SheetHeader>

        <div className="space-y-6 pb-6">
          {/* Contact Info */}
          <div className="space-y-2">
            <a
              href={`https://wa.me/55${lead.phone.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Phone size={14} /> {lead.phone}
            </a>
            {lead.interest_date && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays size={14} />
                Interesse: {new Date(lead.interest_date + "T12:00:00").toLocaleDateString("pt-BR")}
              </p>
            )}
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock size={12} />
              Última interação: {formatDistanceToNow(new Date(lead.last_interaction), { locale: ptBR, addSuffix: true })}
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Observações</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Anotações sobre o lead..."
            />
            <Button size="sm" onClick={handleSaveNotes} disabled={saving} className="gap-1.5">
              <Save size={13} /> Salvar
            </Button>
          </div>

          {/* Quick Actions */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ações Rápidas</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs justify-start"
                onClick={() => handleSendMessage("resposta_inicial")}
              >
                <MessageSquare size={13} /> Enviar mensagem
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs justify-start"
                onClick={() => onScheduleVisit?.(lead)}
              >
                <CalendarDays size={13} /> Agendar visita
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs justify-start"
                onClick={() => onGenerateContract?.(lead)}
              >
                <FileText size={13} /> Gerar contrato
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs justify-start"
                onClick={() => handleSendMessage("cobranca_sinal")}
              >
                <CreditCard size={13} /> Cobrar sinal
              </Button>
            </div>
          </div>

          {/* Status History */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Histórico de Status</Label>
            {history.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum histórico</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {history.map((h) => (
                  <div key={h.id} className="flex items-center gap-2 text-xs">
                    <div className="h-2 w-2 rounded-full bg-primary/40 shrink-0" />
                    <span className="text-muted-foreground">
                      {h.from_stage ? `${STAGE_LABELS[h.from_stage] || h.from_stage} →` : "→"}{" "}
                      <span className="font-medium text-foreground">{STAGE_LABELS[h.to_stage] || h.to_stage}</span>
                    </span>
                    <span className="ml-auto text-muted-foreground/60 text-[10px]">
                      {format(new Date(h.changed_at), "dd/MM HH:mm")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Delete */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-danger hover:text-danger">
                <Trash2 size={13} /> Excluir lead
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Excluir lead?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. O lead e todo seu histórico serão removidos.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Excluir
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </SheetContent>
    </Sheet>
  );
}
