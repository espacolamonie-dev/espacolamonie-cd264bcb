import { useEffect, useState, useCallback, useRef } from "react";
import { Search, Send, User, Bot, UserCheck, MessageSquare, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { type Lead, getLeads, updateLead } from "@/data/leadsStore";
import { type PipelineStage, getPipelineStages, buildStageLabels, buildStageColors } from "@/data/pipelineStore";
import {
  type WhatsAppMessage,
  getMessages, addMessage,
  getConnection, sendWahaMessage,
} from "@/data/whatsappStore";
import {
  getTemplates, getDefaultTemplate, resolveTemplate,
  getPixSettings, TEMPLATE_KEYS,
} from "@/data/leadsStore";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function WhatsAppInbox() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const stageLabels = buildStageLabels(stages);
  const stageColors = buildStageColors(stages);
  const selectedLead = leads.find((l) => l.id === selectedLeadId) || null;

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const [l, s] = await Promise.all([getLeads(), getPipelineStages()]);
      setLeads(l);
      setStages(s);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  useEffect(() => {
    if (!selectedLeadId) return;
    setMsgLoading(true);
    getMessages(selectedLeadId).then(setMessages).finally(() => setMsgLoading(false));
  }, [selectedLeadId]);

  // Realtime subscription for messages
  useEffect(() => {
    const channel = supabase
      .channel("whatsapp-messages-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "whatsapp_messages" }, (payload) => {
        const msg = payload.new as any;
        if (msg.lead_id === selectedLeadId) {
          setMessages((prev) => [...prev, msg]);
        }
        // Refresh leads list for last_message updates
        loadLeads();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedLeadId, loadLeads]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMsg.trim() || !selectedLead) return;
    setSending(true);
    try {
      // Save message to DB
      await addMessage({
        lead_id: selectedLead.id,
        direction: "out",
        body: newMsg.trim(),
        status: "sent",
      });

      // Try sending via WAHA if connected
      const conn = await getConnection();
      if (conn && conn.status === "connected" && conn.waha_url) {
        const sent = await sendWahaMessage(
          conn.waha_url, conn.waha_api_key, conn.session_name,
          selectedLead.phone, newMsg.trim()
        );
        if (!sent) {
          toast.warning("Mensagem salva mas não enviada via WhatsApp — verifique a conexão WAHA.");
        }
      }

      setNewMsg("");
      // Refresh messages
      const msgs = await getMessages(selectedLead.id);
      setMessages(msgs);
    } catch {
      toast.error("Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  const handleToggleHumanMode = async () => {
    if (!selectedLead) return;
    const newMode = !selectedLead.human_mode;
    await updateLead(selectedLead.id, { human_mode: newMode } as any);
    setLeads((prev) => prev.map((l) => l.id === selectedLead.id ? { ...l, human_mode: newMode } : l));
    toast.success(newMode ? "Atendimento humano ativado" : "Bot reativado");
  };

  const handleInsertTemplate = async (templateKey: string) => {
    if (!selectedLead) return;
    const templates = await getTemplates();
    const found = templates.find((t) => t.template_key === templateKey);
    const text = found?.template_text || getDefaultTemplate(templateKey);
    const pix = await getPixSettings();

    const resolved = resolveTemplate(text, {
      nome: selectedLead.name,
      data_evento: selectedLead.interest_date ? new Date(selectedLead.interest_date + "T12:00:00").toLocaleDateString("pt-BR") : "—",
      hora_visita: "—",
      valor_total: "—",
      valor_sinal: "—",
      chave_pix: pix?.pix_key || "—",
      banco: pix?.bank || "—",
      favorecido: pix?.beneficiary_name || "—",
      link_contrato: "—",
    });
    setNewMsg(resolved);
  };

  const filteredLeads = leads.filter((l) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return l.name.toLowerCase().includes(q) || l.phone.includes(q);
  });

  if (loading) {
    return (
      <div className="flex gap-4 h-[600px]">
        <Skeleton className="w-80 h-full rounded-2xl" />
        <Skeleton className="flex-1 h-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-260px)] min-h-[500px]">
      {/* Conversations List */}
      <div className="w-80 shrink-0 border border-border rounded-2xl bg-card flex flex-col">
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar conversa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="divide-y divide-border">
            {filteredLeads.map((lead) => (
              <button
                key={lead.id}
                onClick={() => setSelectedLeadId(lead.id)}
                className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${
                  selectedLeadId === lead.id ? "bg-primary/5 border-l-2 border-l-primary" : ""
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User size={16} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium truncate">{lead.name}</p>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(lead.last_interaction), { locale: ptBR, addSuffix: false })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Badge className={`text-[9px] px-1.5 py-0 border rounded-full ${stageColors[lead.stage] || ""}`}>
                        {stageLabels[lead.stage] || lead.stage}
                      </Badge>
                      {lead.human_mode && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0">
                          <UserCheck size={8} className="mr-0.5" /> Humano
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
            {filteredLeads.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">Nenhum lead encontrado</p>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Panel */}
      <div className="flex-1 border border-border rounded-2xl bg-card flex flex-col">
        {selectedLead ? (
          <>
            {/* Chat Header */}
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                  <User size={16} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{selectedLead.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedLead.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`text-[10px] cursor-pointer ${selectedLead.human_mode ? "bg-amber-500/15 text-amber-600 border-amber-500/30" : "bg-blue-500/15 text-blue-600 border-blue-500/30"}`}
                  onClick={handleToggleHumanMode}
                >
                  {selectedLead.human_mode ? (
                    <><UserCheck size={10} className="mr-1" /> Humano</>
                  ) : (
                    <><Bot size={10} className="mr-1" /> Bot ativo</>
                  )}
                </Badge>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              {msgLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-48" />
                  <Skeleton className="h-10 w-64 ml-auto" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <MessageSquare size={40} className="opacity-20 mb-3" />
                  <p className="text-sm">Nenhuma mensagem ainda</p>
                  <p className="text-xs mt-1">As mensagens aparecerão aqui quando o WAHA estiver conectado</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.direction === "out" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                          msg.direction === "out"
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-muted rounded-bl-md"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.body}</p>
                        <p className={`text-[10px] mt-1 ${
                          msg.direction === "out" ? "text-primary-foreground/60" : "text-muted-foreground"
                        }`}>
                          {new Date(msg.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Quick Templates */}
            <div className="px-4 py-2 border-t border-border">
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {TEMPLATE_KEYS.slice(0, 5).map(({ key, label }) => (
                  <Button
                    key={key}
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[10px] shrink-0 rounded-full px-2.5"
                    onClick={() => handleInsertTemplate(key)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Message Input */}
            <div className="p-3 border-t border-border">
              <div className="flex gap-2">
                <Textarea
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  placeholder="Digite uma mensagem..."
                  rows={2}
                  className="resize-none text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!newMsg.trim() || sending}
                  className="self-end h-10 w-10 p-0"
                >
                  <Send size={16} />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <MessageSquare size={48} className="opacity-15 mb-4" />
            <p className="text-sm font-medium">Selecione uma conversa</p>
            <p className="text-xs mt-1">Escolha um lead à esquerda para ver as mensagens</p>
          </div>
        )}
      </div>
    </div>
  );
}
