import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Inbox, GitBranch, Zap, ScrollText } from "lucide-react";
import WhatsAppInbox from "@/components/WhatsAppInbox";
import WhatsAppAutomation from "@/components/WhatsAppAutomation";
import WhatsAppLogs from "@/components/WhatsAppLogs";

export default function WhatsApp() {
  const [tab, setTab] = useState("inbox");

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-3xl font-display font-semibold tracking-tight">WhatsApp</h1>
        <p className="text-sm text-muted-foreground mt-1">Inbox, automações e logs de mensagens</p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="inbox" className="gap-1.5 text-xs">
            <Inbox size={14} /> Inbox
          </TabsTrigger>
          <TabsTrigger value="automation" className="gap-1.5 text-xs">
            <Zap size={14} /> Automação
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5 text-xs">
            <ScrollText size={14} /> Logs
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox">
          <WhatsAppInbox />
        </TabsContent>

        <TabsContent value="automation">
          <WhatsAppAutomation />
        </TabsContent>

        <TabsContent value="logs">
          <WhatsAppLogs />
        </TabsContent>
      </Tabs>
    </div>
  );
}
