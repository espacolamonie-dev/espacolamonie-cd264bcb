import { useEffect, useState, useCallback, useMemo } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { Plus, Search, Filter } from "lucide-react";
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
  type Lead, type LeadStage,
  STAGE_ORDER, STAGE_LABELS, STAGE_COLORS,
  getLeads, addLead, moveLeadStage,
} from "@/data/leadsStore";

function phoneMask(v: string): string {
  const digits = v.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : "";
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export default function LeadsWhatsApp() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [saving, setSaving] = useState(false);

  // Form
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formInterest, setFormInterest] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      setLeads(await getLeads());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  const columns = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    STAGE_ORDER.forEach((s) => { map[s] = []; });
    const q = search.toLowerCase();
    leads.forEach((lead) => {
      if (q && !lead.name.toLowerCase().includes(q) && !lead.phone.includes(q)) return;
      if (map[lead.stage]) map[lead.stage].push(lead);
    });
    return map;
  }, [leads, search]);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    const { draggableId, source, destination } = result;
    if (source.droppableId === destination.droppableId) return;

    const lead = leads.find((l) => l.id === draggableId);
    if (!lead) return;

    // Optimistic update
    setLeads((prev) =>
      prev.map((l) => l.id === draggableId ? { ...l, stage: destination.droppableId } : l)
    );

    try {
      await moveLeadStage(draggableId, source.droppableId, destination.droppableId);
      toast.success(`Lead movido para "${STAGE_LABELS[destination.droppableId as LeadStage]}"`);
      loadLeads();
    } catch {
      toast.error("Erro ao mover lead");
      loadLeads();
    }
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
      loadLeads();
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
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display font-semibold tracking-tight">Leads WhatsApp</h1>
          <p className="text-sm text-muted-foreground mt-1">Funil de vendas com acompanhamento de leads</p>
        </div>
        <Button onClick={() => setModalOpen(true)} className="gap-2">
          <Plus size={16} /> Novo Lead
        </Button>
      </div>

      {/* Search */}
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

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6 md:-mx-10 md:px-10">
          {STAGE_ORDER.map((stage) => (
            <Droppable key={stage} droppableId={stage}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`shrink-0 w-[280px] rounded-2xl border border-border p-3 transition-colors duration-200 ${
                    snapshot.isDraggingOver ? "bg-primary/5 border-primary/30" : "bg-muted/30"
                  }`}
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <Badge className={`text-[10px] font-medium border rounded-full px-2 py-0.5 ${STAGE_COLORS[stage]}`}>
                        {STAGE_LABELS[stage]}
                      </Badge>
                    </div>
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {columns[stage]?.length || 0}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="space-y-2.5 min-h-[60px]">
                    {columns[stage]?.map((lead, index) => (
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

      {/* Detail Sheet */}
      <LeadDetailSheet
        lead={selectedLead}
        open={!!selectedLead}
        onClose={() => setSelectedLead(null)}
        onRefresh={loadLeads}
      />

      {/* Create Modal */}
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
