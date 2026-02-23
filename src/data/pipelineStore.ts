import { supabase } from "@/integrations/supabase/client";

export interface PipelineStage {
  id: string;
  stage_key: string;
  label: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
  default_template_key: string | null;
}

const DEFAULT_STAGES: Omit<PipelineStage, "id">[] = [
  { stage_key: "novo_lead", label: "Novo Lead", color: "bg-blue-500/15 text-blue-600 border-blue-500/30", sort_order: 0, is_active: true, is_system: true, default_template_key: "resposta_inicial" },
  { stage_key: "qualificando", label: "Qualificando", color: "bg-amber-500/15 text-amber-600 border-amber-500/30", sort_order: 1, is_active: true, is_system: false, default_template_key: "envio_valores" },
  { stage_key: "visita_agendada", label: "Visita Agendada", color: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", sort_order: 2, is_active: true, is_system: false, default_template_key: "confirmacao_visita" },
  { stage_key: "proposta_enviada", label: "Proposta Enviada", color: "bg-violet-500/15 text-violet-600 border-violet-500/30", sort_order: 3, is_active: true, is_system: false, default_template_key: "envio_valores" },
  { stage_key: "contrato_gerado", label: "Contrato Gerado", color: "bg-indigo-500/15 text-indigo-600 border-indigo-500/30", sort_order: 4, is_active: true, is_system: false, default_template_key: "envio_contrato" },
  { stage_key: "aguardando_assinatura", label: "Aguardando Assinatura", color: "bg-orange-500/15 text-orange-600 border-orange-500/30", sort_order: 5, is_active: true, is_system: false, default_template_key: "envio_contrato" },
  { stage_key: "aguardando_sinal", label: "Aguardando Sinal", color: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30", sort_order: 6, is_active: true, is_system: false, default_template_key: "cobranca_sinal" },
  { stage_key: "fechado", label: "Fechado", color: "bg-green-500/15 text-green-600 border-green-500/30", sort_order: 7, is_active: true, is_system: true, default_template_key: "confirmacao_pagamento" },
  { stage_key: "perdido", label: "Perdido", color: "bg-red-500/15 text-red-600 border-red-500/30", sort_order: 8, is_active: true, is_system: true, default_template_key: null },
];

export async function getPipelineStages(): Promise<PipelineStage[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data, error } = await supabase
    .from("pipeline_stages")
    .select("*")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true });

  if (error) throw error;

  // If no stages exist, seed defaults
  if (!data || data.length === 0) {
    return await seedDefaultStages(user.id);
  }

  return data as any;
}

async function seedDefaultStages(userId: string): Promise<PipelineStage[]> {
  const rows = DEFAULT_STAGES.map((s) => ({
    user_id: userId,
    ...s,
  }));

  const { data, error } = await supabase
    .from("pipeline_stages")
    .insert(rows)
    .select();

  if (error) throw error;
  return (data || []) as any;
}

export async function updateStage(id: string, updates: Partial<PipelineStage>): Promise<void> {
  const { error } = await supabase
    .from("pipeline_stages")
    .update(updates as any)
    .eq("id", id);
  if (error) throw error;
}

export async function addStage(stage: {
  stage_key: string;
  label: string;
  color?: string;
  sort_order: number;
  default_template_key?: string | null;
}): Promise<PipelineStage> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data, error } = await supabase
    .from("pipeline_stages")
    .insert({
      user_id: user.id,
      stage_key: stage.stage_key,
      label: stage.label,
      color: stage.color || "bg-blue-500/15 text-blue-600 border-blue-500/30",
      sort_order: stage.sort_order,
      default_template_key: stage.default_template_key || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as any;
}

export async function deleteStage(id: string): Promise<void> {
  const { error } = await supabase
    .from("pipeline_stages")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function reorderStages(stages: { id: string; sort_order: number }[]): Promise<void> {
  for (const s of stages) {
    await supabase
      .from("pipeline_stages")
      .update({ sort_order: s.sort_order } as any)
      .eq("id", s.id);
  }
}

// Helpers for building label/color maps from dynamic stages
export function buildStageLabels(stages: PipelineStage[]): Record<string, string> {
  const map: Record<string, string> = {};
  stages.forEach((s) => { map[s.stage_key] = s.label; });
  return map;
}

export function buildStageColors(stages: PipelineStage[]): Record<string, string> {
  const map: Record<string, string> = {};
  stages.forEach((s) => { map[s.stage_key] = s.color; });
  return map;
}

export const STAGE_COLOR_OPTIONS = [
  { value: "bg-blue-500/15 text-blue-600 border-blue-500/30", label: "Azul" },
  { value: "bg-amber-500/15 text-amber-600 border-amber-500/30", label: "Âmbar" },
  { value: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", label: "Verde" },
  { value: "bg-violet-500/15 text-violet-600 border-violet-500/30", label: "Violeta" },
  { value: "bg-indigo-500/15 text-indigo-600 border-indigo-500/30", label: "Índigo" },
  { value: "bg-orange-500/15 text-orange-600 border-orange-500/30", label: "Laranja" },
  { value: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30", label: "Amarelo" },
  { value: "bg-green-500/15 text-green-600 border-green-500/30", label: "Verde escuro" },
  { value: "bg-red-500/15 text-red-600 border-red-500/30", label: "Vermelho" },
  { value: "bg-pink-500/15 text-pink-600 border-pink-500/30", label: "Rosa" },
  { value: "bg-cyan-500/15 text-cyan-600 border-cyan-500/30", label: "Ciano" },
];
