import { Megaphone, Globe, Instagram, Facebook } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AttributionBadgeProps {
  utmSource?: string;
  utmCampaign?: string;
  utmMedium?: string;
  metaAdId?: string;
  metaAdsetId?: string;
  compact?: boolean;
}

const SOURCE_CONFIG: Record<string, { label: string; icon: typeof Globe; className: string }> = {
  facebook: { label: "Facebook", icon: Facebook, className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  instagram: { label: "Instagram", icon: Instagram, className: "bg-pink-500/10 text-pink-600 border-pink-500/20" },
  google: { label: "Google", icon: Globe, className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
};

export function AttributionBadge({ utmSource, utmCampaign, utmMedium, metaAdId, metaAdsetId, compact }: AttributionBadgeProps) {
  if (!utmSource && !utmCampaign) return null;

  const source = (utmSource || "").toLowerCase();
  const config = SOURCE_CONFIG[source] || { label: utmSource || "Direto", icon: Megaphone, className: "bg-muted text-muted-foreground border-border" };
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
