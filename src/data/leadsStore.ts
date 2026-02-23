import { supabase } from "@/integrations/supabase/client";

export interface Lead {
  id: string;
  name: string;
  phone: string;
  interest_date: string | null;
  last_interaction: string;
  tags: string[];
  origin: string;
  stage: string;
  notes: string;
  contract_id: string | null;
  visit_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadStatusEntry {
  id: string;
  lead_id: string;
  from_stage: string | null;
  to_stage: string;
  changed_at: string;
}

// Legacy stage constants kept for backward compatibility
const STAGES = [
  "novo_lead", "qualificando", "visita_agendada", "proposta_enviada",
  "contrato_gerado", "aguardando_assinatura", "aguardando_sinal",
  "fechado", "perdido",
] as const;

export type LeadStage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<string, string> = {
  novo_lead: "Novo Lead", qualificando: "Qualificando",
  visita_agendada: "Visita Agendada", proposta_enviada: "Proposta Enviada",
  contrato_gerado: "Contrato Gerado", aguardando_assinatura: "Aguardando Assinatura",
  aguardando_sinal: "Aguardando Sinal", fechado: "Fechado", perdido: "Perdido",
};

export const STAGE_COLORS: Record<string, string> = {
  novo_lead: "bg-blue-500/15 text-blue-600 border-blue-500/30",
  qualificando: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  visita_agendada: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  proposta_enviada: "bg-violet-500/15 text-violet-600 border-violet-500/30",
  contrato_gerado: "bg-indigo-500/15 text-indigo-600 border-indigo-500/30",
  aguardando_assinatura: "bg-orange-500/15 text-orange-600 border-orange-500/30",
  aguardando_sinal: "bg-yellow-500/15 text-yellow-700 border-yellow-500/30",
  fechado: "bg-green-500/15 text-green-600 border-green-500/30",
  perdido: "bg-red-500/15 text-red-600 border-red-500/30",
};

export const STAGE_ORDER = STAGES;

export async function getLeads(): Promise<Lead[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data || []).map((d: any) => ({
    id: d.id,
    name: d.name,
    phone: d.phone,
    interest_date: d.interest_date,
    last_interaction: d.last_interaction,
    tags: d.tags || [],
    origin: d.origin,
    stage: d.stage,
    notes: d.notes || "",
    contract_id: d.contract_id,
    visit_id: d.visit_id,
    created_at: d.created_at,
    updated_at: d.updated_at,
  }));
}

export async function addLead(lead: {
  name: string;
  phone: string;
  interest_date?: string | null;
  notes?: string;
  tags?: string[];
}): Promise<Lead> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data, error } = await supabase
    .from("leads")
    .insert({
      user_id: user.id,
      name: lead.name,
      phone: lead.phone,
      interest_date: lead.interest_date || null,
      notes: lead.notes || "",
      tags: lead.tags || [],
      stage: "novo_lead",
    })
    .select()
    .single();

  if (error) throw error;

  // Log initial status
  await supabase.from("lead_status_history").insert({
    lead_id: data.id,
    from_stage: null,
    to_stage: "novo_lead",
    user_id: user.id,
  });

  return data as any;
}

export async function updateLead(id: string, updates: Partial<Lead>): Promise<void> {
  const { error } = await supabase
    .from("leads")
    .update(updates as any)
    .eq("id", id);
  if (error) throw error;
}

export async function moveLeadStage(id: string, fromStage: string, toStage: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { error } = await supabase
    .from("leads")
    .update({ stage: toStage, last_interaction: new Date().toISOString() } as any)
    .eq("id", id);
  if (error) throw error;

  await supabase.from("lead_status_history").insert({
    lead_id: id,
    from_stage: fromStage,
    to_stage: toStage,
    user_id: user.id,
  });
}

export async function deleteLead(id: string): Promise<void> {
  const { error } = await supabase.from("leads").delete().eq("id", id);
  if (error) throw error;
}

export async function getLeadHistory(leadId: string): Promise<LeadStatusEntry[]> {
  const { data, error } = await supabase
    .from("lead_status_history")
    .select("*")
    .eq("lead_id", leadId)
    .order("changed_at", { ascending: false });
  if (error) throw error;
  return (data || []) as any;
}

// WhatsApp Templates
export interface WhatsAppTemplate {
  id: string;
  template_key: string;
  template_text: string;
}

export const TEMPLATE_KEYS = [
  { key: "resposta_inicial", label: "Resposta Inicial", description: "Primeira mensagem ao receber contato" },
  { key: "envio_valores", label: "Envio de Valores", description: "Informar valores do espaço" },
  { key: "confirmacao_visita", label: "Confirmação de Visita", description: "Confirmar agendamento de visita" },
  { key: "lembrete_visita", label: "Lembrete de Visita", description: "Lembrete 24h antes da visita" },
  { key: "envio_contrato", label: "Envio de Contrato", description: "Enviar link do contrato para assinatura" },
  { key: "cobranca_sinal", label: "Cobrança de Sinal", description: "Solicitar pagamento do sinal" },
  { key: "confirmacao_pagamento", label: "Confirmação de Pagamento", description: "Confirmar recebimento de pagamento" },
  { key: "pos_evento", label: "Pós-Evento", description: "Agradecimento após o evento" },
] as const;

const DEFAULT_TEMPLATES: Record<string, string> = {
  resposta_inicial: "Olá {nome}! 👋\nObrigado pelo seu contato. Sou do Espaço Lamoniê e ficarei feliz em ajudá-lo(a) com seu evento.\nComo posso ajudar?",
  envio_valores: "Olá {nome}!\nSegue nossos valores:\n\n💰 Valor total: {valor_total}\n📅 Data disponível: {data_evento}\n\nFicou com alguma dúvida?",
  confirmacao_visita: "Olá {nome}! ✅\nSua visita ao Espaço Lamoniê está confirmada:\n\n📅 Data: {data_evento}\n🕐 Horário: {hora_visita}\n\nAguardamos você!",
  lembrete_visita: "Olá {nome}! 📢\nLembrando que amanhã é sua visita ao Espaço Lamoniê:\n\n🕐 Horário: {hora_visita}\n\nConfirma presença?",
  envio_contrato: "Olá {nome}! 📄\nSeu contrato está pronto para assinatura:\n\n🔗 {link_contrato}\n\nQualquer dúvida, estou à disposição!",
  cobranca_sinal: "Olá {nome}! 💳\nPara garantir sua data, segue os dados para o sinal:\n\n💰 Valor: {valor_sinal}\n🏦 Banco: {banco}\n🔑 Pix: {chave_pix}\n👤 Favorecido: {favorecido}\n\nApós o pagamento, envie o comprovante aqui!",
  confirmacao_pagamento: "Olá {nome}! ✅\nPagamento recebido com sucesso!\n\n💰 Valor: {valor_sinal}\n📅 Data do evento: {data_evento}\n\nObrigado pela confiança!",
  pos_evento: "Olá {nome}! 🎉\nFoi um prazer receber seu evento no Espaço Lamoniê!\nEsperamos que tudo tenha sido maravilhoso.\n\nConte com a gente sempre! ⭐",
};

export async function getTemplates(): Promise<WhatsAppTemplate[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data, error } = await supabase
    .from("whatsapp_templates")
    .select("*")
    .eq("user_id", user.id);
  if (error) throw error;
  return (data || []) as any;
}

export async function upsertTemplate(key: string, text: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data: existing } = await supabase
    .from("whatsapp_templates")
    .select("id")
    .eq("user_id", user.id)
    .eq("template_key", key)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("whatsapp_templates")
      .update({ template_text: text } as any)
      .eq("id", existing.id);
  } else {
    await supabase.from("whatsapp_templates").insert({
      user_id: user.id,
      template_key: key,
      template_text: text,
    });
  }
}

export function getDefaultTemplate(key: string): string {
  return DEFAULT_TEMPLATES[key] || "";
}

// Pix Settings
export interface PixSettings {
  pix_key: string;
  bank: string;
  beneficiary_name: string;
}

export async function getPixSettings(): Promise<PixSettings | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data, error } = await supabase
    .from("pix_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  return data as any;
}

export async function upsertPixSettings(settings: PixSettings): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");

  const { data: existing } = await supabase
    .from("pix_settings")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("pix_settings")
      .update(settings as any)
      .eq("id", existing.id);
  } else {
    await supabase.from("pix_settings").insert({
      user_id: user.id,
      ...settings,
    });
  }
}

export function resolveTemplate(
  template: string,
  vars: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.split(`{${key}}`).join(value);
  }
  return result;
}

export function openWhatsApp(phone: string, message: string) {
  const cleanPhone = phone.replace(/\D/g, "");
  const fullPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;
  const encoded = encodeURIComponent(message);
  window.open(`https://wa.me/${fullPhone}?text=${encoded}`, "_blank");
}
