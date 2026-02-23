import { useEffect, useState } from "react";
import { Save, Eye, MessageSquare, CreditCard, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  TEMPLATE_KEYS,
  getTemplates, upsertTemplate, getDefaultTemplate, resolveTemplate,
  getPixSettings, upsertPixSettings,
  type PixSettings, type WhatsAppTemplate,
} from "@/data/leadsStore";

const VARIABLES = [
  { var: "{nome}", desc: "Nome do cliente" },
  { var: "{data_evento}", desc: "Data do evento" },
  { var: "{hora_visita}", desc: "Horário da visita" },
  { var: "{valor_total}", desc: "Valor total" },
  { var: "{valor_sinal}", desc: "Valor do sinal" },
  { var: "{chave_pix}", desc: "Chave Pix" },
  { var: "{banco}", desc: "Banco" },
  { var: "{favorecido}", desc: "Nome favorecido" },
  { var: "{link_contrato}", desc: "Link do contrato" },
];

export default function WhatsAppSettingsTab() {
  const [templates, setTemplates] = useState<Record<string, string>>({});
  const [pixSettings, setPixSettings] = useState<PixSettings>({ pix_key: "", bank: "", beneficiary_name: "" });
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewText, setPreviewText] = useState("");

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [tpls, pix] = await Promise.all([getTemplates(), getPixSettings()]);
      const map: Record<string, string> = {};
      TEMPLATE_KEYS.forEach(({ key }) => {
        const found = tpls.find((t) => t.template_key === key);
        map[key] = found?.template_text || getDefaultTemplate(key);
      });
      setTemplates(map);
      if (pix) setPixSettings(pix);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async (key: string) => {
    setSavingKey(key);
    try {
      await upsertTemplate(key, templates[key] || "");
      toast.success("Mensagem salva!");
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSavingKey(null);
    }
  };

  const handleResetTemplate = (key: string) => {
    setTemplates((prev) => ({ ...prev, [key]: getDefaultTemplate(key) }));
  };

  const handlePreview = (key: string) => {
    const text = resolveTemplate(templates[key] || "", {
      nome: "João Silva",
      data_evento: "15/03/2026",
      hora_visita: "14:00",
      valor_total: "R$ 5.000,00",
      valor_sinal: "R$ 1.500,00",
      chave_pix: pixSettings.pix_key || "exemplo@pix.com",
      banco: pixSettings.bank || "Banco do Brasil",
      favorecido: pixSettings.beneficiary_name || "Espaço Lamoniê",
      link_contrato: "https://lamonie.com/assinar/abc123",
    });
    setPreviewText(text);
    setPreviewOpen(true);
  };

  const handleSavePix = async () => {
    setSavingKey("pix");
    try {
      await upsertPixSettings(pixSettings);
      toast.success("Dados Pix salvos!");
    } catch {
      toast.error("Erro ao salvar");
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Variables Reference */}
      <Card className="card-premium">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <MessageSquare size={20} className="text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-display">Variáveis Dinâmicas</CardTitle>
              <CardDescription className="text-xs mt-0.5">Use estas variáveis nas mensagens — serão substituídas automaticamente</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {VARIABLES.map((v) => (
              <Badge
                key={v.var}
                variant="outline"
                className="text-xs cursor-pointer hover:bg-primary/10 transition-colors"
                title={v.desc}
                onClick={() => navigator.clipboard.writeText(v.var).then(() => toast.info(`Copiado: ${v.var}`))}
              >
                {v.var}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pix Settings */}
      <Card className="card-premium">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <CreditCard size={20} className="text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-display">Chave Pix</CardTitle>
              <CardDescription className="text-xs mt-0.5">Dados utilizados nas mensagens de cobrança</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label className="text-xs">Chave Pix</Label>
              <Input
                value={pixSettings.pix_key}
                onChange={(e) => setPixSettings((p) => ({ ...p, pix_key: e.target.value }))}
                placeholder="CPF, email ou chave"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Banco</Label>
              <Input
                value={pixSettings.bank}
                onChange={(e) => setPixSettings((p) => ({ ...p, bank: e.target.value }))}
                placeholder="Ex: Banco do Brasil"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Nome favorecido</Label>
              <Input
                value={pixSettings.beneficiary_name}
                onChange={(e) => setPixSettings((p) => ({ ...p, beneficiary_name: e.target.value }))}
                placeholder="Nome"
                className="mt-1"
              />
            </div>
          </div>
          <Button size="sm" onClick={handleSavePix} disabled={savingKey === "pix"} className="gap-1.5">
            <Save size={13} /> Salvar Pix
          </Button>
        </CardContent>
      </Card>

      {/* Message Templates */}
      <div className="grid gap-4 lg:grid-cols-2">
        {TEMPLATE_KEYS.map(({ key, label, description }) => (
          <Card key={key} className="card-premium">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-display">{label}</CardTitle>
              <CardDescription className="text-xs">{description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                value={templates[key] || ""}
                onChange={(e) => setTemplates((prev) => ({ ...prev, [key]: e.target.value }))}
                rows={5}
                className="text-sm"
              />
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" onClick={() => handleSaveTemplate(key)} disabled={savingKey === key} className="gap-1.5 text-xs">
                  <Save size={12} /> Salvar
                </Button>
                <Button size="sm" variant="outline" onClick={() => handlePreview(key)} className="gap-1.5 text-xs">
                  <Eye size={12} /> Preview
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleResetTemplate(key)} className="gap-1.5 text-xs text-muted-foreground">
                  <RotateCcw size={12} /> Padrão
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Preview da Mensagem</DialogTitle>
          </DialogHeader>
          <div className="rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/30 p-4">
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{previewText}</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
