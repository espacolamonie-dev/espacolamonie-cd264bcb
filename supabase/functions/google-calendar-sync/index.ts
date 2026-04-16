import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!;
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!;

const CONTRACT_STATUS_LABELS: Record<string, string> = {
  awaiting_documents: 'Aguardando Documentos',
  awaiting_signature: 'Aguardando Assinatura',
  signed: 'Assinado',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendente',
  deposit_paid: 'Sinal Pago',
  paid_full: 'Pago Total',
};

// Google Calendar color IDs
const PAYMENT_COLOR_IDS: Record<string, string> = {
  pending: '5',      // yellow/banana
  deposit_paid: '2', // sage/green light
  paid_full: '10',   // basil/green dark
  cancelled: '8',    // graphite
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Parse body early to check for cron action
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  // Cron-based sync: no user auth needed, syncs all users
  if (action === 'sync-all-contracts-cron') {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    try {
      // Get all connected google_settings
      const { data: allSettings } = await supabase
        .from('google_settings')
        .select('*')
        .eq('is_connected', true);

      if (!allSettings || allSettings.length === 0) {
        return new Response(JSON.stringify({ success: true, message: 'No connected users' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let totalSynced = 0;
      for (const settings of allSettings) {
        try {
          const { data: contracts } = await supabase
            .from('contracts')
            .select('*')
            .eq('user_id', settings.user_id)
            .neq('status', 'cancelled');

          if (!contracts || contracts.length === 0) continue;

          const clientIds = [...new Set(contracts.map((c: any) => c.client_id))];
          const { data: clients } = await supabase.from('clients').select('*').in('id', clientIds);
          const clientMap: Record<string, any> = {};
          (clients || []).forEach((c: any) => { clientMap[c.id] = c; });

          // Also fetch payments to update payment_status before syncing
          const contractIds = contracts.map((c: any) => c.id);
          const { data: allPayments } = await supabase
            .from('payments')
            .select('*')
            .in('contract_id', contractIds);

          const paymentsByContract: Record<string, number> = {};
          (allPayments || []).forEach((p: any) => {
            paymentsByContract[p.contract_id] = (paymentsByContract[p.contract_id] || 0) + Number(p.amount);
          });

          // Update payment_status based on actual payments
          for (const contract of contracts) {
            const totalPaid = paymentsByContract[contract.id] || 0;
            let newStatus = 'pending';
            if (totalPaid >= Number(contract.total_value)) newStatus = 'paid_full';
            else if (totalPaid > 0) newStatus = 'deposit_paid';

            if (newStatus !== contract.payment_status) {
              const remaining = Math.max(0, Number(contract.total_value) - totalPaid);
              await supabase.from('contracts').update({
                payment_status: newStatus,
                remaining_value: remaining,
              }).eq('id', contract.id);
              contract.payment_status = newStatus;
              contract.remaining_value = remaining;
            }
          }

          const token = await getValidToken(supabase, settings.user_id, settings);
          const calendarId = settings.calendar_id || 'primary';

          for (const contract of contracts) {
            try {
              const client = clientMap[contract.client_id];
              if (!client) continue;

              const title = `Lamoniê — ${client.name} — ${contract.event_type}`;
              const description = buildDescription(contract, client);
              const colorId = PAYMENT_COLOR_IDS[contract.payment_status] || '5';

              const baseEndDate = contract.event_date_end || contract.event_date;
              const endDate = new Date(baseEndDate + 'T12:00:00');
              endDate.setDate(endDate.getDate() + 1);
              const endDateStr = endDate.toISOString().split('T')[0];

              const eventBody = {
                summary: title, description,
                location: 'Espaço Lamoniê — Endereço do espaço',
                start: { date: contract.event_date },
                end: { date: endDateStr },
                colorId,
                extendedProperties: { private: { contract_id: contract.id, crm: 'lamonie' } },
              };

              let googleEventId = contract.google_event_id;
              let googleRes;

              if (googleEventId) {
                googleRes = await fetch(
                  `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${googleEventId}`,
                  { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(eventBody) }
                );
                if (!googleRes.ok && googleRes.status === 404) googleEventId = null;
              }

              if (!googleEventId) {
                googleRes = await fetch(
                  `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
                  { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(eventBody) }
                );
                const resBody = await googleRes.json();
                if (googleRes.ok && resBody.id) {
                  await supabase.from('contracts').update({ google_event_id: resBody.id }).eq('id', contract.id);
                }
              }

              if (googleRes?.ok) totalSynced++;
            } catch (err) {
              console.error(`Cron: Failed to sync contract ${contract.id}:`, err);
            }
          }
        } catch (userErr) {
          console.error(`Cron: Failed for user ${settings.user_id}:`, userErr);
        }
      }

      return new Response(JSON.stringify({ success: true, synced: totalSynced }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      console.error('sync-all-contracts-cron error:', err);
      return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
    }
  }


  // Public action: sync visit after client confirms (no user auth needed)
  if (action === 'public-sync-visit') {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    try {
      const { visit_id, confirmation_token } = body;
      if (!visit_id || !confirmation_token) {
        return new Response(JSON.stringify({ error: 'visit_id and confirmation_token required' }), { status: 400, headers: corsHeaders });
      }

      // Validate the token matches the visit (security check)
      const { data: visit } = await supabase.from('visits').select('*').eq('id', visit_id).eq('confirmation_token', confirmation_token).single();
      if (!visit) {
        return new Response(JSON.stringify({ error: 'Visit not found or invalid token' }), { status: 404, headers: corsHeaders });
      }

      // Get the visit owner's google settings
      const { data: settings } = await supabase.from('google_settings').select('*').eq('user_id', visit.user_id).single();
      if (!settings?.is_connected) {
        return new Response(JSON.stringify({ success: true, message: 'Google Calendar not connected' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const token = await getValidToken(supabase, visit.user_id, settings);
      const calendarId = settings.calendar_id || 'primary';

      const visitStatusLabels: Record<string, string> = {
        Agendada: 'Agendada', Confirmada: 'Confirmada', Remarcada: 'Remarcada', Cancelada: 'Cancelada',
      };

      const visitTitle = `[Visita Lamoniê] ${visit.client_name}`;
      const formatDateBR = (d: string) => { const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; };
      const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const createdAt = new Date(visit.created_at);
      const createdAtStr = `${createdAt.toLocaleDateString('pt-BR')} às ${createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

      const visitDesc = [
        `👤 Cliente: ${visit.client_name} | ${visit.client_phone}`,
        `📅 Data de interesse do evento: ${visit.interest_event_date ? formatDateBR(visit.interest_event_date) : '—'}`,
        `🎉 Evento desejado: ${visit.event_type_desired || '—'}`,
        `💰 Valor do evento: ${visit.event_value ? formatCurrency(Number(visit.event_value)) : '—'}`,
        `👥 Qtd. de pessoas: ${visit.guest_count || '—'}`,
        `📆 Data da visita: ${formatDateBR(visit.visit_date)}`,
        `🕐 Horário: ${visit.visit_time?.slice(0, 5) || '—'}`,
        `📊 Status: ${visitStatusLabels[visit.status] || visit.status}`,
        `📣 Fonte do Lead: ${visit.lead_source || '—'}`,
        `🗓️ Data de cadastro: ${createdAtStr}`,
        visit.notes ? `📝 Observações: ${visit.notes}` : '',
        '', '— Criado automaticamente pelo CRM Lamoniê',
      ].filter(Boolean).join('\n');

      const visitColorId = visit.status === 'Confirmada' ? '10' : visit.status === 'Remarcada' ? '5' : '7';

      const startDateTime = `${visit.visit_date}T${visit.visit_time}`;
      const endDate = new Date(`${visit.visit_date}T${visit.visit_time}`);
      endDate.setHours(endDate.getHours() + 1);
      const endDateTime = endDate.toISOString().replace('Z', '');

      const eventBody = {
        summary: visitTitle,
        description: visitDesc,
        location: 'Espaço Lamoniê',
        start: { dateTime: startDateTime, timeZone: 'America/Sao_Paulo' },
        end: { dateTime: endDateTime.slice(0, 19), timeZone: 'America/Sao_Paulo' },
        colorId: visitColorId,
        extendedProperties: { private: { visit_id: visit.id, crm: 'lamonie' } },
      };

      let googleEventId = visit.google_event_id;
      let googleRes;
      let resBody;

      if (googleEventId) {
        googleRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${googleEventId}`,
          { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(eventBody) }
        );
        resBody = await googleRes.json();
        if (!googleRes.ok && googleRes.status === 404) googleEventId = null;
      }

      if (!googleEventId) {
        googleRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
          { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(eventBody) }
        );
        resBody = await googleRes.json();
        if (googleRes.ok && resBody.id) {
          googleEventId = resBody.id;
          await supabase.from('visits').update({ google_event_id: googleEventId }).eq('id', visit_id);
        }
      }

      await supabase.from('google_sync_logs').insert({
        user_id: visit.user_id,
        action: 'public-sync-visit',
        status: googleRes?.ok ? 'success' : 'error',
        message: googleRes?.ok ? `Visit confirmed & synced: ${googleEventId}` : JSON.stringify(resBody),
        google_event_id: googleEventId,
      });

      return new Response(JSON.stringify({ success: googleRes?.ok, google_event_id: googleEventId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      console.error('public-sync-visit error:', err);
      return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
    }
  }

  // Regular user-authenticated actions
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  const supabaseUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Get user's google settings
    const { data: settings } = await supabase
      .from('google_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (action === 'get-auth-url') {
      const redirectUri = `${SUPABASE_URL}/functions/v1/google-oauth-callback`;
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email');
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');
      authUrl.searchParams.set('state', user.id);
      return new Response(JSON.stringify({ url: authUrl.toString() }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'disconnect') {
      await supabase.from('google_settings').update({ is_connected: false, access_token: null, refresh_token: null }).eq('user_id', user.id);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'get-settings') {
      return new Response(JSON.stringify({ settings }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'get-calendars') {
      if (!settings?.is_connected) {
        return new Response(JSON.stringify({ error: 'Not connected' }), { status: 400, headers: corsHeaders });
      }
      const token = await getValidToken(supabase, user.id, settings);
      const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      return new Response(JSON.stringify({ calendars: data.items || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'set-calendar') {
      await supabase.from('google_settings')
        .update({ calendar_id: body.calendar_id, calendar_name: body.calendar_name })
        .eq('user_id', user.id);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'delete-event') {
      // Delete a Google Calendar event when a contract is cancelled
      const { contract_id } = body;
      if (!contract_id) {
        return new Response(JSON.stringify({ error: 'contract_id required' }), { status: 400, headers: corsHeaders });
      }

      const { data: contract } = await supabase.from('contracts').select('google_event_id').eq('id', contract_id).single();
      const googleEventId = contract?.google_event_id;

      if (!googleEventId) {
        // No event linked — nothing to delete on Google
        return new Response(JSON.stringify({ success: true, message: 'No Google event linked' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!settings?.is_connected) {
        // Not connected — just clear the google_event_id from the contract
        await supabase.from('contracts').update({ google_event_id: null }).eq('id', contract_id);
        return new Response(JSON.stringify({ success: true, message: 'Not connected, cleared event id' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const token = await getValidToken(supabase, user.id, settings);
      const calendarId = settings.calendar_id || 'primary';

      const deleteRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId as string)}/events/${googleEventId}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
      );

      // 204 = success, 404 = already gone — both are fine
      const isOk = deleteRes.status === 204 || deleteRes.status === 404;

      // Clear google_event_id from contract regardless
      await supabase.from('contracts').update({ google_event_id: null }).eq('id', contract_id);

      // Log
      await supabase.from('google_sync_logs').insert({
        user_id: user.id,
        contract_id,
        action: 'delete-event',
        status: isOk ? 'success' : 'error',
        message: isOk
          ? `Event ${googleEventId} deleted from Google Calendar`
          : `Failed to delete event ${googleEventId} (status ${deleteRes.status})`,
        google_event_id: googleEventId,
      });

      return new Response(JSON.stringify({ success: isOk, google_event_id: googleEventId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'sync-all-contracts') {
      // Sync ALL non-cancelled contracts to Google Calendar
      if (!settings?.is_connected) {
        return new Response(JSON.stringify({ error: 'Not connected to Google Calendar' }), { status: 400, headers: corsHeaders });
      }

      const { data: allContracts } = await supabase.from('contracts').select('*').eq('user_id', user.id).neq('status', 'cancelled');
      if (!allContracts || allContracts.length === 0) {
        return new Response(JSON.stringify({ success: true, synced: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const clientIds = [...new Set(allContracts.map((c: any) => c.client_id))];
      const { data: allClients } = await supabase.from('clients').select('*').in('id', clientIds);
      const clientMap: Record<string, any> = {};
      (allClients || []).forEach((c: any) => { clientMap[c.id] = c; });

      const token = await getValidToken(supabase, user.id, settings);
      const calendarId = settings.calendar_id || 'primary';
      let synced = 0;

      for (const contract of allContracts) {
        try {
          const client = clientMap[contract.client_id];
          if (!client) continue;

          const title = `Lamoniê — ${client.name} — ${contract.event_type}`;
          const description = buildDescription(contract, client);
          const colorId = PAYMENT_COLOR_IDS[contract.payment_status] || '5';

          const baseEndDate = contract.event_date_end || contract.event_date;
          const endDate = new Date(baseEndDate + 'T12:00:00');
          endDate.setDate(endDate.getDate() + 1);
          const endDateStr = endDate.toISOString().split('T')[0];

          const eventBody = {
            summary: title, description,
            location: 'Espaço Lamoniê — Endereço do espaço',
            start: { date: contract.event_date },
            end: { date: endDateStr },
            colorId,
            extendedProperties: { private: { contract_id: contract.id, crm: 'lamonie' } },
          };

          let googleEventId = contract.google_event_id;
          let googleRes;
          let resBody;

          if (googleEventId) {
            googleRes = await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${googleEventId}`,
              { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(eventBody) }
            );
            resBody = await googleRes.json();
            if (!googleRes.ok && googleRes.status === 404) googleEventId = null;
          }

          if (!googleEventId) {
            googleRes = await fetch(
              `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
              { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(eventBody) }
            );
            resBody = await googleRes.json();
            if (googleRes!.ok && resBody.id) {
              googleEventId = resBody.id;
              await supabase.from('contracts').update({ google_event_id: googleEventId }).eq('id', contract.id);
            }
          }

          if (googleRes?.ok) synced++;
        } catch (err) {
          console.error(`Failed to sync contract ${contract.id}:`, err);
        }
      }

      await supabase.from('google_sync_logs').insert({
        user_id: user.id,
        action: 'sync-all-contracts',
        status: 'success',
        message: `Bulk synced ${synced}/${allContracts.length} contracts`,
      });

      return new Response(JSON.stringify({ success: true, synced, total: allContracts.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'sync-contract') {
      // Create or update a Google Calendar event for a contract
      // Never sync cancelled contracts
      const { contract_id: syncContractId } = body;
      if (syncContractId) {
        const { data: checkContract } = await supabase.from('contracts').select('status').eq('id', syncContractId).single();
        if (checkContract?.status === 'cancelled') {
          return new Response(JSON.stringify({ skipped: true, reason: 'Contract is cancelled' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      if (!settings?.is_connected) {
        return new Response(JSON.stringify({ error: 'Not connected to Google Calendar' }), { status: 400, headers: corsHeaders });
      }

      const { contract_id } = body;
      if (!contract_id) {
        return new Response(JSON.stringify({ error: 'contract_id required' }), { status: 400, headers: corsHeaders });
      }

      const { data: contract } = await supabase.from('contracts').select('*').eq('id', contract_id).single();
      const { data: client } = await supabase.from('clients').select('*').eq('id', contract.client_id).single();

      const token = await getValidToken(supabase, user.id, settings);
      const calendarId = settings.calendar_id || 'primary';

      const isCancelled = contract.status === 'cancelled';
      const title = isCancelled
        ? `[CANCELADO] Lamoniê — ${client.name} — ${contract.event_type}`
        : `Lamoniê — ${client.name} — ${contract.event_type}`;

      const description = buildDescription(contract, client);
      const colorId = isCancelled ? PAYMENT_COLOR_IDS.cancelled : (PAYMENT_COLOR_IDS[contract.payment_status] || '5');

      // Google all-day events use exclusive end date, so add 1 day
      const baseEndDate = contract.event_date_end || contract.event_date;
      const endDate = new Date(baseEndDate + 'T12:00:00');
      endDate.setDate(endDate.getDate() + 1);
      const endDateStr = endDate.toISOString().split('T')[0];

      const eventBody = {
        summary: title,
        description,
        location: 'Espaço Lamoniê — Endereço do espaço',
        start: { date: contract.event_date },
        end: { date: endDateStr },
        colorId,
        extendedProperties: {
          private: {
            contract_id: contract.id,
            crm: 'lamonie',
          },
        },
      };

      let googleEventId = contract.google_event_id;
      let googleRes;
      let resBody;

      if (googleEventId) {
        // Update existing event
        googleRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${googleEventId}`,
          { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(eventBody) }
        );
        resBody = await googleRes.json();
        if (!googleRes.ok) {
          // Event might have been deleted on Google side; create new one
          if (googleRes.status === 404) {
            googleEventId = null;
          }
        }
      }

      if (!googleEventId) {
        // Create new event
        googleRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
          { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(eventBody) }
        );
        resBody = await googleRes.json();
        if (googleRes.ok && resBody.id) {
          googleEventId = resBody.id;
          // Save google_event_id to contract
          await supabase.from('contracts').update({ google_event_id: googleEventId }).eq('id', contract_id);
        }
      }

      // Log
      await supabase.from('google_sync_logs').insert({
        user_id: user.id,
        contract_id,
        action: 'sync-contract',
        status: googleRes?.ok ? 'success' : 'error',
        message: googleRes?.ok ? `Event synced: ${googleEventId}` : JSON.stringify(resBody),
        google_event_id: googleEventId,
      });

      return new Response(JSON.stringify({ success: googleRes?.ok, google_event_id: googleEventId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'sync-visit') {
      // Create or update a Google Calendar event for a visit
      const { visit_id } = body;
      if (!visit_id) {
        return new Response(JSON.stringify({ error: 'visit_id required' }), { status: 400, headers: corsHeaders });
      }

      const { data: visit } = await supabase.from('visits').select('*').eq('id', visit_id).single();
      if (!visit) {
        return new Response(JSON.stringify({ error: 'Visit not found' }), { status: 404, headers: corsHeaders });
      }
      if (visit.status === 'Cancelada') {
        return new Response(JSON.stringify({ skipped: true, reason: 'Visit is cancelled' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!settings?.is_connected) {
        return new Response(JSON.stringify({ error: 'Not connected to Google Calendar' }), { status: 400, headers: corsHeaders });
      }

      const token = await getValidToken(supabase, user.id, settings);
      const calendarId = settings.calendar_id || 'primary';

      const visitStatusLabels: Record<string, string> = {
        Agendada: 'Agendada', Confirmada: 'Confirmada', Remarcada: 'Remarcada', Cancelada: 'Cancelada',
      };

      const visitTitle = `[Visita Lamoniê] ${visit.client_name}`;
      const formatDateBR = (d: string) => { const [y, m, day] = d.split('-'); return `${day}/${m}/${y}`; };
      const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      const createdAt = new Date(visit.created_at);
      const createdAtStr = `${createdAt.toLocaleDateString('pt-BR')} às ${createdAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

      const visitDesc = [
        `👤 Cliente: ${visit.client_name} | ${visit.client_phone}`,
        `📅 Data de interesse do evento: ${visit.interest_event_date ? formatDateBR(visit.interest_event_date) : '—'}`,
        `🎉 Evento desejado: ${visit.event_type_desired || '—'}`,
        `💰 Valor do evento: ${visit.event_value ? formatCurrency(Number(visit.event_value)) : '—'}`,
        `👥 Qtd. de pessoas: ${visit.guest_count || '—'}`,
        `📆 Data da visita: ${formatDateBR(visit.visit_date)}`,
        `🕐 Horário: ${visit.visit_time?.slice(0, 5) || '—'}`,
        `📊 Status: ${visitStatusLabels[visit.status] || visit.status}`,
        `📣 Fonte do Lead: ${visit.lead_source || '—'}`,
        `🗓️ Data de cadastro: ${createdAtStr}`,
        visit.notes ? `📝 Observações: ${visit.notes}` : '',
        '', '— Criado automaticamente pelo CRM Lamoniê',
      ].filter(Boolean).join('\n');

      const visitColorId = visit.status === 'Confirmada' ? '10' : visit.status === 'Remarcada' ? '5' : '7';

      // Build start/end with dateTime (not all-day)
      const startDateTime = `${visit.visit_date}T${visit.visit_time}`;
      const endDate = new Date(`${visit.visit_date}T${visit.visit_time}`);
      endDate.setHours(endDate.getHours() + 1);
      const endDateTime = endDate.toISOString().replace('Z', '');

      const eventBody = {
        summary: visitTitle,
        description: visitDesc,
        location: 'Espaço Lamoniê',
        start: { dateTime: startDateTime, timeZone: 'America/Sao_Paulo' },
        end: { dateTime: endDateTime.slice(0, 19), timeZone: 'America/Sao_Paulo' },
        colorId: visitColorId,
        extendedProperties: { private: { visit_id: visit.id, crm: 'lamonie' } },
      };

      let googleEventId = visit.google_event_id;
      let googleRes;
      let resBody;

      if (googleEventId) {
        googleRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${googleEventId}`,
          { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(eventBody) }
        );
        resBody = await googleRes.json();
        if (!googleRes.ok && googleRes.status === 404) googleEventId = null;
      }

      if (!googleEventId) {
        googleRes = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
          { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(eventBody) }
        );
        resBody = await googleRes.json();
        if (googleRes.ok && resBody.id) {
          googleEventId = resBody.id;
          await supabase.from('visits').update({ google_event_id: googleEventId }).eq('id', visit_id);
        }
      }

      await supabase.from('google_sync_logs').insert({
        user_id: user.id,
        action: 'sync-visit',
        status: googleRes?.ok ? 'success' : 'error',
        message: googleRes?.ok ? `Visit event synced: ${googleEventId}` : JSON.stringify(resBody),
        google_event_id: googleEventId,
      });

      return new Response(JSON.stringify({ success: googleRes?.ok, google_event_id: googleEventId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'delete-visit-event') {
      const { visit_id } = body;
      if (!visit_id) {
        return new Response(JSON.stringify({ error: 'visit_id required' }), { status: 400, headers: corsHeaders });
      }

      const { data: visit } = await supabase.from('visits').select('google_event_id').eq('id', visit_id).single();
      const gEventId = visit?.google_event_id;

      if (!gEventId) {
        return new Response(JSON.stringify({ success: true, message: 'No Google event linked' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!settings?.is_connected) {
        await supabase.from('visits').update({ google_event_id: null }).eq('id', visit_id);
        return new Response(JSON.stringify({ success: true, message: 'Not connected, cleared event id' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const token = await getValidToken(supabase, user.id, settings);
      const calendarId = settings.calendar_id || 'primary';

      const deleteRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId as string)}/events/${gEventId}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
      );

      const isOk = deleteRes.status === 204 || deleteRes.status === 404;
      await supabase.from('visits').update({ google_event_id: null }).eq('id', visit_id);

      await supabase.from('google_sync_logs').insert({
        user_id: user.id,
        action: 'delete-visit-event',
        status: isOk ? 'success' : 'error',
        message: isOk ? `Visit event ${gEventId} deleted` : `Failed (status ${deleteRes.status})`,
        google_event_id: gEventId,
      });

      return new Response(JSON.stringify({ success: isOk }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'fetch-google-events') {
      if (!settings?.is_connected) {
        return new Response(JSON.stringify({ events: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const token = await getValidToken(supabase, user.id, settings);
      const calendarId = settings.calendar_id || 'primary';
      const timeMin = body.time_min || new Date(new Date().getFullYear(), 0, 1).toISOString();
      const timeMax = body.time_max || new Date(new Date().getFullYear() + 1, 11, 31).toISOString();

      const eventsRes = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=250`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const eventsData = await eventsRes.json();
      return new Response(JSON.stringify({ events: eventsData.items || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get-sync-logs') {
      const { data: logs } = await supabase
        .from('google_sync_logs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      return new Response(JSON.stringify({ logs }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: corsHeaders });

  } catch (err) {
    console.error('google-calendar-sync error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});

async function getValidToken(supabase: ReturnType<typeof createClient>, userId: string, settings: Record<string, unknown>): Promise<string> {
  const expiresAt = settings.token_expires_at ? new Date(settings.token_expires_at as string) : null;
  const now = new Date();
  // Refresh if expired or expiring in next 5 minutes
  if (!expiresAt || expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    if (!settings.refresh_token) throw new Error('No refresh token available');
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: settings.refresh_token as string,
        grant_type: 'refresh_token',
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokenRes.ok || !tokens.access_token) throw new Error('Failed to refresh token');
    const newExpiry = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();
    await supabase.from('google_settings').update({
      access_token: tokens.access_token,
      token_expires_at: newExpiry,
    }).eq('user_id', userId);
    return tokens.access_token;
  }
  return settings.access_token as string;
}

function buildDescription(contract: Record<string, unknown>, client: Record<string, unknown>): string {
  const fmtCurrency = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  const contractStatusLabels: Record<string, string> = {
    awaiting_documents: 'Aguardando Documentos',
    awaiting_signature: 'Aguardando Assinatura',
    signed: 'Assinado',
    confirmed: 'Confirmado',
    cancelled: 'Cancelado',
  };
  const paymentStatusLabels: Record<string, string> = {
    pending: 'Pendente',
    deposit_paid: 'Sinal Pago',
    paid_full: 'Pago Total',
  };

  const rentalType = (contract.rental_type as string) || 'Locação (1 dia)';
  const dateInfo = contract.event_date_end
    ? `📅 Datas: ${contract.event_date} a ${contract.event_date_end}`
    : `📅 Data: ${contract.event_date}`;

  return [
    `🎉 ${contract.event_type}`,
    ``,
    `👤 Cliente: ${client.name}`,
    `📄 CPF: ${client.cpf || '—'}`,
    `📞 Telefone: ${client.phone || '—'}`,
    ``,
    `🏠 Modalidade: ${rentalType}`,
    dateInfo,
    ``,
    `💰 Valor Total: ${fmtCurrency(Number(contract.total_value))}`,
    `💵 Sinal (${contract.deposit_percent}%): ${fmtCurrency(Number(contract.deposit_value))}`,
    `📋 Restante: ${fmtCurrency(Number(contract.remaining_value))}`,
    ``,
    `📊 Status Contrato: ${contractStatusLabels[contract.status as string] || contract.status}`,
    `💳 Status Pagamento: ${paymentStatusLabels[contract.payment_status as string] || contract.payment_status}`,
    ``,
    `🆔 ID Contrato: ${contract.id}`,
    ``,
    `— Criado automaticamente pelo CRM Lamoniê`,
  ].join('\n');
}
