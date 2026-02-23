import { Phone, Clock, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Lead } from "@/data/leadsStore";
import { STAGE_COLORS, type LeadStage } from "@/data/leadsStore";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface LeadCardProps {
  lead: Lead;
  onClick: () => void;
}

function getTimeSinceInteraction(date: string) {
  try {
    return formatDistanceToNow(new Date(date), { locale: ptBR, addSuffix: false });
  } catch {
    return "—";
  }
}

export default function LeadCard({ lead, onClick }: LeadCardProps) {
  const timeSince = getTimeSinceInteraction(lead.last_interaction);
  const isStale =
    (lead.stage === "qualificando" || lead.stage === "proposta_enviada") &&
    Date.now() - new Date(lead.last_interaction).getTime() > 24 * 60 * 60 * 1000;

  return (
    <div
      onClick={onClick}
      className="group cursor-pointer rounded-2xl border border-border bg-card p-4 shadow-sm hover:shadow-md transition-all duration-200 space-y-2.5"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold truncate leading-tight">{lead.name}</p>
        {isStale && (
          <span className="shrink-0 text-[10px] font-medium text-danger bg-danger/10 px-1.5 py-0.5 rounded-md">
            ⚠️ {timeSince}
          </span>
        )}
      </div>

      <a
        href={`https://wa.me/55${lead.phone.replace(/\D/g, "")}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="flex items-center gap-1.5 text-xs text-primary hover:underline"
      >
        <Phone size={11} /> {lead.phone}
      </a>

      {lead.interest_date && (
        <p className="text-[11px] text-muted-foreground">
          📅 Interesse: {new Date(lead.interest_date + "T12:00:00").toLocaleDateString("pt-BR")}
        </p>
      )}

      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Clock size={10} />
          <span>{timeSince}</span>
        </div>
        {lead.tags.length > 0 && (
          <div className="flex gap-1 flex-wrap justify-end">
            {lead.tags.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <Badge className="text-[9px] px-1.5 py-0 h-4 bg-green-500/15 text-green-600 border-green-500/30">
          <MessageSquare size={8} className="mr-0.5" /> WhatsApp
        </Badge>
      </div>
    </div>
  );
}
