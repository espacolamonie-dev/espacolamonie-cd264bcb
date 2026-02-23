import { useEffect, useState } from "react";
import { GripVertical, Plus, Pencil, Trash2, Save, X, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  type PipelineStage,
  getPipelineStages, updateStage, addStage, deleteStage, reorderStages,
  STAGE_COLOR_OPTIONS,
} from "@/data/pipelineStore";
import { TEMPLATE_KEYS } from "@/data/leadsStore";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function PipelineSettingsTab() {
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editTemplate, setEditTemplate] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState(STAGE_COLOR_OPTIONS[0].value);
  const [newTemplate, setNewTemplate] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      setStages(await getPipelineStages());
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (s: PipelineStage) => {
    setEditingId(s.id);
    setEditLabel(s.label);
    setEditColor(s.color);
    setEditTemplate(s.default_template_key);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editLabel.trim()) return;
    try {
      await updateStage(editingId, {
        label: editLabel.trim(),
        color: editColor,
        default_template_key: editTemplate,
      });
      toast.success("Etapa atualizada!");
      setEditingId(null);
      load();
    } catch {
      toast.error("Erro ao salvar");
    }
  };

  const handleToggleActive = async (s: PipelineStage) => {
    try {
      await updateStage(s.id, { is_active: !s.is_active });
      toast.success(s.is_active ? "Etapa desativada" : "Etapa ativada");
      load();
    } catch {
      toast.error("Erro ao alterar");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteStage(id);
      toast.success("Etapa removida");
      load();
    } catch {
      toast.error("Erro ao remover");
    }
  };

  const handleAdd = async () => {
    if (!newLabel.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    const key = newLabel.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    try {
      await addStage({
        stage_key: key,
        label: newLabel.trim(),
        color: newColor,
        sort_order: stages.length,
        default_template_key: newTemplate,
      });
      toast.success("Etapa criada!");
      setAddingNew(false);
      setNewLabel("");
      setNewTemplate(null);
      load();
    } catch (e: any) {
      toast.error(e.message?.includes("duplicate") ? "Já existe uma etapa com esse nome" : "Erro ao criar");
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const updated = [...stages];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    const orders = updated.map((s, i) => ({ id: s.id, sort_order: i }));
    setStages(updated);
    try {
      await reorderStages(orders);
    } catch {
      toast.error("Erro ao reordenar");
      load();
    }
  };

  const handleMoveDown = async (index: number) => {
    if (index >= stages.length - 1) return;
    const updated = [...stages];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    const orders = updated.map((s, i) => ({ id: s.id, sort_order: i }));
    setStages(updated);
    try {
      await reorderStages(orders);
    } catch {
      toast.error("Erro ao reordenar");
      load();
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="card-premium">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-display">Etapas do Pipeline</CardTitle>
              <CardDescription className="text-xs mt-0.5">Personalize as etapas do funil de vendas. Arraste para reordenar.</CardDescription>
            </div>
            <Button size="sm" onClick={() => setAddingNew(true)} className="gap-1.5 text-xs" disabled={addingNew}>
              <Plus size={13} /> Nova etapa
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* Add new stage form */}
          {addingNew && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label className="text-xs">Nome da etapa</Label>
                  <Input
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="Ex: Follow-up"
                    className="mt-1"
                    autoFocus
                  />
                </div>
                <div>
                  <Label className="text-xs">Cor</Label>
                  <Select value={newColor} onValueChange={setNewColor}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STAGE_COLOR_OPTIONS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          <div className="flex items-center gap-2">
                            <div className={`h-3 w-3 rounded-full ${c.value.split(" ")[0]}`} />
                            {c.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Mensagem padrão</Label>
                  <Select value={newTemplate || "none"} onValueChange={(v) => setNewTemplate(v === "none" ? null : v)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Nenhuma" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhuma</SelectItem>
                      {TEMPLATE_KEYS.map((t) => (
                        <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAdd} className="gap-1.5 text-xs">
                  <Save size={12} /> Criar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setAddingNew(false); setNewLabel(""); }} className="text-xs">
                  <X size={12} /> Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Stage list */}
          {stages.map((stage, index) => (
            <div
              key={stage.id}
              className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                !stage.is_active ? "opacity-50 bg-muted/20" : "bg-card"
              } ${editingId === stage.id ? "border-primary/30 bg-primary/5" : "border-border"}`}
            >
              {/* Reorder buttons */}
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs"
                >
                  ▲
                </button>
                <button
                  onClick={() => handleMoveDown(index)}
                  disabled={index === stages.length - 1}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-xs"
                >
                  ▼
                </button>
              </div>

              {editingId === stage.id ? (
                <div className="flex-1 grid gap-3 sm:grid-cols-3">
                  <div>
                    <Input
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      className="h-8 text-sm"
                      autoFocus
                    />
                  </div>
                  <div>
                    <Select value={editColor} onValueChange={setEditColor}>
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STAGE_COLOR_OPTIONS.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            <div className="flex items-center gap-2">
                              <div className={`h-3 w-3 rounded-full ${c.value.split(" ")[0]}`} />
                              {c.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Select value={editTemplate || "none"} onValueChange={(v) => setEditTemplate(v === "none" ? null : v)}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Nenhuma" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {TEMPLATE_KEYS.map((t) => (
                          <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center gap-3 min-w-0">
                  <Badge className={`text-[10px] font-medium border rounded-full px-2.5 py-0.5 shrink-0 ${stage.color}`}>
                    {stage.label}
                  </Badge>
                  {stage.default_template_key && (
                    <span className="text-[10px] text-muted-foreground truncate">
                      📲 {TEMPLATE_KEYS.find((t) => t.key === stage.default_template_key)?.label || stage.default_template_key}
                    </span>
                  )}
                  {stage.is_system && (
                    <span className="text-[9px] text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded">sistema</span>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                {editingId === stage.id ? (
                  <>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveEdit}>
                      <Save size={13} />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                      <X size={13} />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(stage)}>
                      <Pencil size={13} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => handleToggleActive(stage)}
                      title={stage.is_active ? "Desativar" : "Ativar"}
                    >
                      {stage.is_active ? <ToggleRight size={13} className="text-green-600" /> : <ToggleLeft size={13} />}
                    </Button>
                    {!stage.is_system && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-danger hover:text-danger">
                            <Trash2 size={13} />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover etapa "{stage.label}"?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Leads nesta etapa permanecerão, mas a coluna não aparecerá no pipeline.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(stage.id)} className="bg-destructive text-destructive-foreground">
                              Remover
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
