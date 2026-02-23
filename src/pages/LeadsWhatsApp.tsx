import { useEffect, useState, useCallback, useMemo } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import LeadCard from "@/components/LeadCard";
import LeadDetailSheet from "@/components/LeadDetailSheet";
import {
  type Lead,
  getLeads, addLead, moveLeadStage,
  getTemplates, getDefaultTemplate, resolveTemplate,
  getPixSettings, openWhatsApp,
} from "@/data/leadsStore";
import {
  type PipelineStage,
  getPipelineStages, buildStageLabels,
} from "@/data/pipelineStore";

function phoneMask(v: string): string {
  const digits = v.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export default function LeadsWhatsApp() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [saving, setSaving] = useState(false);

  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formInterest, setFormInterest] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const activeStages = useMemo(() => stages.filter((s) => s.is_active), [stages]);
  const stageLabels = useMemo(() => buildStageLabels(stages), [stages]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [l, s] = await Promise.all([getLeads(), getPipelineStages()]);
      setLeads(l);
      setStages(s);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const columns = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    activeStages.forEach((s) => { map[s.stage_key] = []; });
    const q = search.toLowerCase();
    leads.forEach((lead) => {
      if (q && !lead.name.toLowerCase().includes(q) && !lead.phone.includes(q)) return;
      if (map[lead.stage]) map[lead.stage].push(lead);
    });
    return map;
  }, [leads, search, activeStages]);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const { draggableId, source, destination } = result;
    if (source.droppableId === destination.droppableId) return;

    const lead = leads.find((l) => l.id === draggableId);
    if (!lead) return;

    setLeads((prev) =>
      prev.map((l) => l.id === draggableId ? { ...l, stage: destination.droppableId } : l)
    );

    try {
      await moveLeadStage(draggableId, source.droppableId, destination.droppableId);
      toast.success(`Lead movido para "${stageLabels[destination.droppableId] || destination.droppableId}"`);

      // Offer to send default message for the new stage
      const destStage = stages.find((s) => s.stage_key === destination.droppableId);
      if (destStage?.default_template_key && lead) {
        sendStageMessage(lead, destStage.default_template_key);
      }

      loadAll();
    } catch {
      toast.error("Erro ao mover lead");
      loadAll();
    }
  };

  const sendStageMessage = async (lead: Lead, templateKey: string) => {
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

    // Copy to clipboard and show toast with send option
    navigator.clipboard.writeText(resolved);
    toast("📲 Mensagem copiada!", {
      description: "Clique para abrir WhatsApp com a mensagem.",
      action: {
        label: "Abrir WhatsApp",
        onClick: () => openWhatsApp(lead.phone, resolved),
      },
      duration: 8000,
    });
  };

  const handleCreate = async () => {
    if (!formName.trim() || !formPhone.trim()) {
      toast.error("Nome e telefone são obrigatórios");
      return;
    }
    setSaving(true);
    try {
      await addLead({
        name: formName.trim(),
        phone: formPhone.trim(),
        interest_date: formInterest || null,
        notes: formNotes.trim(),
      });
      toast.success("Lead adicionado!");
      setModalOpen(false);
      setFormName(""); setFormPhone(""); setFormInterest(""); setFormNotes("");
      loadAll();
    } catch (e: any) {
      toast.error(e.message || "Erro ao adicionar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-fade-in space-y-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-10 w-full max-w-sm" />
        <div className="flex gap-4 overflow-x-auto">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[400px] w-[280px] shrink-0 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-semibold tracking-tight">Leads WhatsApp</h1>
          <p className="text-sm text-muted-foreground mt-1">Funil de vendas com acompanhamento de leads</p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="gap-2">
          <Plus size={16} /> Novo Lead
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Badge variant="secondary" className="text-xs">
          {leads.length} lead{leads.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6 md:-mx-10 md:px-10">
          {activeStages.map((stage) => (
            <Droppable key={stage.stage_key} droppableId={stage.stage_key}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`shrink-0 w-[280px] rounded-2xl border border-border p-3 transition-colors duration-200 ${
                    snapshot.isDraggingOver ? "bg-primary/5 border-primary/30" : "bg-muted/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3 px-1">
                    <Badge className={`text-[10px] font-medium border rounded-full px-2 py-0.5 ${stage.color}`}>
                      {stage.label}
                    </Badge>
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {columns[stage.stage_key]?.length || 0}
                    </span>
                  </div>

                  <div className="space-y-2.5 min-h-[60px]">
                    {columns[stage.stage_key]?.map((lead, index) => (
                      <Draggable key={lead.id} draggableId={lead.id} index={index}>
                        {(prov, snap) => (
                          <div
                            ref={prov.innerRef}
                            {...prov.draggableProps}
                            {...prov.dragHandleProps}
                            className={`transition-shadow duration-200 ${snap.isDragging ? "shadow-lg rotate-1" : ""}`}
                          >
                            <LeadCard lead={lead} onClick={() => setSelectedLead(lead)} />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>

      <LeadDetailSheet
        lead={selectedLead}
        open={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        onRefresh={loadAll}
        stages={stages}
      />

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Novo Lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Nome do lead" />
            </div>
            <div>
              <Label>Telefone (WhatsApp) *</Label>
              <Input
                value={formPhone}
                onChange={(e) => setFormPhone(phoneMask(e.target.value))}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div>
              <Label>Data de interesse (opcional)</Label>
              <Input type="date" value={formInterest} onChange={(e) => setFormInterest(e.target.value)} />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Notas sobre o lead..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Salvando..." : "Adicionar Lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
