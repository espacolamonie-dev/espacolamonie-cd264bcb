import { Megaphone, Globe, Instagram, Facebook, Users, Search, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AttributionBadgeProps {
  utmSource?: string;
  utmCampaign?: string;
  utmMedium?: string;
  metaAdId?: string;
  metaAdsetId?: string;
  /** Direct origin label (e.g. "Instagram", "Indicação") */
  origin?: string;
  compact?: boolean;
}

const SOURCE_CONFIG: Record<string, { label: string; icon: typeof Globe; className: string }> = {
  facebook: { label: "Facebook", icon: Facebook, className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  instagram: { label: "Instagram", icon: Instagram, className: "bg-pink-500/10 text-pink-600 border-pink-500/20" },
  google: { label: "Google", icon: Search, className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  "tráfego pago": { label: "Tráfego Pago", icon: Megaphone, className: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
  indicação: { label: "Indicação", icon: Users, className: "bg-violet-500/10 text-violet-600 border-violet-500/20" },
  "indicacao": { label: "Indicação", icon: Users, className: "bg-violet-500/10 text-violet-600 border-violet-500/20" },
  orgânico: { label: "Orgânico", icon: Globe, className: "bg-teal-500/10 text-teal-600 border-teal-500/20" },
  "organico": { label: "Orgânico", icon: Globe, className: "bg-teal-500/10 text-teal-600 border-teal-500/20" },
  outro: { label: "Outro", icon: Smartphone, className: "bg-muted text-muted-foreground border-border" },
};

export function AttributionBadge({ utmSource, utmCampaign, utmMedium, metaAdId, metaAdsetId, origin, compact }: AttributionBadgeProps) {
  const raw = origin || utmSource || "";
  if (!raw && !utmCampaign) return null;

  const key = raw.toLowerCase();
  const config = SOURCE_CONFIG[key] || { label: raw || "Direto", icon: Megaphone, className: "bg-muted text-muted-foreground border-border" };
  const Icon = config.icon;

  const details = [
    utmCampaign && `Campanha: ${utmCampaign}`,
    utmMedium && `Mídia: ${utmMedium}`,
    metaAdsetId && `Conjunto: ${metaAdsetId}`,
    metaAdId && `Anúncio: ${metaAdId}`,
  ].filter(Boolean);

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`${config.className} text-[10px] gap-1 cursor-default`}>
            <Icon size={10} />
            {config.label}
          </Badge>
        </TooltipTrigger>
        {details.length > 0 && (
          <TooltipContent side="top" className="text-xs max-w-xs">
            {details.map((d, i) => <div key={i}>{d}</div>)}
          </TooltipContent>
        )}
      </Tooltip>
    );
  }

  return (
    <div className="space-y-1">
      <Badge variant="outline" className={`${config.className} text-[10px] gap-1`}>
        <Icon size={10} />
        {config.label}
      </Badge>
      {utmCampaign && (
        <p className="text-[10px] text-muted-foreground truncate">📣 {utmCampaign}</p>
      )}
    </div>
  );
}
