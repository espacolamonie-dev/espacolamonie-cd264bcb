import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/**
 * Parse end hour from event_time like "08:00 às 20:00" → 20
 */
function parseEndTime(eventTime: string): { hours: number; minutes: number } | null {
  if (!eventTime) return null;
  // Match patterns like "08:00 às 20:00" or "08:00 - 20:00"
  const match = eventTime.match(/(\d{1,2}):(\d{2})\s*(?:às|-)?\s*(\d{1,2}):(\d{2})/);
  if (!match) {
    // Try single time like "20:00"
    const single = eventTime.match(/(\d{1,2}):(\d{2})/);
    if (single) return { hours: parseInt(single[1]), minutes: parseInt(single[2]) };
    return null;
  }
  return { hours: parseInt(match[3]), minutes: parseInt(match[4]) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Get today's date in São Paulo timezone
    const now = new Date();
    const spNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const todayStr = `${spNow.getFullYear()}-${String(spNow.getMonth() + 1).padStart(2, '0')}-${String(spNow.getDate()).padStart(2, '0')}`;
    const currentMinutes = spNow.getHours() * 60 + spNow.getMinutes();

    console.log(`[check-event-alerts] Checking at ${todayStr} ${spNow.getHours()}:${String(spNow.getMinutes()).padStart(2, '0')} (${currentMinutes} min)`);

    // Get active contracts for today
    const { data: contracts, error } = await supabase
      .from('contracts')
      .select('id, client_id, event_date, event_time, event_status, event_type, user_id')
      .eq('event_date', todayStr)
      .in('event_status', ['pending', 'em_andamento', 'proximo_fim'])
      .neq('status', 'cancelled');

    if (error) {
      console.error('[check-event-alerts] Query error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!contracts || contracts.length === 0) {
      console.log('[check-event-alerts] No active events today');
      return new Response(JSON.stringify({ checked: 0, alerts: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let alertsSent = 0;

    for (const contract of contracts) {
      const endTime = parseEndTime(contract.event_time);
      if (!endTime) {
        console.log(`[check-event-alerts] Could not parse end time for contract ${contract.id}: "${contract.event_time}"`);
        continue;
      }

      const endMinutes = endTime.hours * 60 + endTime.minutes;
      const minutesLeft = endMinutes - currentMinutes;
      const endTimeStr = `${String(endTime.hours).padStart(2, '0')}:${String(endTime.minutes).padStart(2, '0')}`;

      console.log(`[check-event-alerts] Contract ${contract.id}: ends at ${endTimeStr}, ${minutesLeft} min left`);

      // Get client name
      let clientName = 'Cliente';
      if (contract.client_id) {
        const { data: client } = await supabase
          .from('clients')
          .select('name')
          .eq('id', contract.client_id)
          .single();
        if (client) clientName = client.name;
      }

      let title = '';
      let body = '';
      let tag = '';
      let newStatus = '';

      // 30 minutes before
      if (minutesLeft <= 30 && minutesLeft > 25 && contract.event_status !== 'proximo_fim') {
        title = '⚠️ Evento próximo do fim!';
        body = `O evento de ${clientName} encerra às ${endTimeStr}. Faltam ~30 minutos.`;
        tag = `event-alert-30-${contract.id}`;
        newStatus = 'proximo_fim';
      }
      // 10 minutes before
      else if (minutesLeft <= 10 && minutesLeft > 5) {
        title = '🚨 Evento quase encerrando!';
        body = `O evento de ${clientName} encerra às ${endTimeStr}. Faltam ~10 minutos! Prepare a finalização.`;
        tag = `event-alert-10-${contract.id}`;
        newStatus = 'proximo_fim';
      }
      // Past end time (in delay)
      else if (minutesLeft <= 0 && minutesLeft > -5 && contract.event_status !== 'em_atraso') {
        const delayMin = Math.abs(minutesLeft);
        title = '🚨 Evento ultrapassou o horário!';
        body = `O evento de ${clientName} deveria ter encerrado às ${endTimeStr}. Atraso: ${delayMin} min. Verificar saída e aplicar multa.`;
        tag = `event-overdue-${contract.id}`;
        newStatus = 'em_atraso';
      }

      if (!title) continue;

      // Update contract status
      if (newStatus) {
        await supabase
          .from('contracts')
          .update({ event_status: newStatus })
          .eq('id', contract.id);
      }

      // Send push notification to all subscribers of this user
      await supabase.functions.invoke('manage-push', {
        body: {
          action: 'send-notification',
          title,
          body,
          url: '/contracts',
          tag,
        },
      });

      alertsSent++;
      console.log(`[check-event-alerts] Alert sent: ${tag}`);
    }

    return new Response(JSON.stringify({ checked: contracts.length, alerts: alertsSent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[check-event-alerts] Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
