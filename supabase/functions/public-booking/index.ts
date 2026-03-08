import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!;
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!;

// For now we use the first connected google_settings user as the "owner"
// In production you'd scope this to a specific user/tenant
async function getOwnerSettings(supabase: ReturnType<typeof createClient>) {
  const { data } = await supabase
    .from('google_settings')
    .select('*')
    .eq('is_connected', true)
    .limit(1)
    .single();
  return data;
}

async function getValidToken(supabase: ReturnType<typeof createClient>, userId: string, settings: Record<string, unknown>): Promise<string> {
  const expiresAt = settings.token_expires_at ? new Date(settings.token_expires_at as string) : null;
  const now = new Date();
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

// Available hours: 09:00 to 19:00 (last slot starts at 19, ends at 20)
const AVAILABLE_HOURS = Array.from({ length: 11 }, (_, i) => i + 9); // 9,10,...,19

function isAllowedDay(dateStr: string): boolean {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay(); // 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat
  return day === 2 || day === 4; // Tuesday or Thursday
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    if (action === 'get-available-slots') {
      // Get available time slots for a specific date
      const { date } = body; // "YYYY-MM-DD"
      if (!date) {
        return new Response(JSON.stringify({ error: 'date required' }), { status: 400, headers: corsHeaders });
      }

      // Validate it's a Tuesday or Thursday
      if (!isAllowedDay(date)) {
        return new Response(JSON.stringify({ slots: [], message: 'Visitas apenas às terças e quintas-feiras' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Validate not in the past
      const today = new Date().toISOString().split('T')[0];
      if (date < today) {
        return new Response(JSON.stringify({ slots: [], message: 'Não é possível agendar em datas passadas' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check existing visits in DB for that date
      const { data: existingVisits } = await supabase
        .from('visits')
        .select('visit_time, status')
        .eq('visit_date', date)
        .neq('status', 'Cancelada');

      const bookedTimes = new Set(
        (existingVisits || []).map((v: any) => {
          // visit_time is "HH:MM:SS" or "HH:MM"
          return parseInt(v.visit_time.split(':')[0], 10);
        })
      );

      // Check Google Calendar for busy times
      let googleBusyHours = new Set<number>();
      const settings = await getOwnerSettings(supabase);
      if (settings?.is_connected) {
        try {
          const token = await getValidToken(supabase, settings.user_id, settings);
          const calendarId = settings.calendar_id || 'primary';
          const timeMin = `${date}T09:00:00-03:00`;
          const timeMax = `${date}T21:00:00-03:00`;
          
          const eventsRes = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&timeZone=America/Sao_Paulo`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const eventsData = await eventsRes.json();
          
          for (const event of (eventsData.items || [])) {
            if (event.status === 'cancelled') continue;
            
            // All-day events block nothing for hourly visits (they're contract events)
            if (event.start?.date && !event.start?.dateTime) continue;
            
            if (event.start?.dateTime) {
              // Extract hour from the dateTime string directly to avoid UTC conversion
              // Google returns format like "2026-03-10T14:00:00-03:00"
              const startMatch = event.start.dateTime.match(/T(\d{2}):/);
              const endMatch = (event.end?.dateTime || event.start.dateTime).match(/T(\d{2}):/);
              const startHour = startMatch ? parseInt(startMatch[1], 10) : 0;
              const endHour = endMatch ? parseInt(endMatch[1], 10) : startHour + 1;
              // Block all hours the event spans
              for (let h = startHour; h < Math.max(endHour, startHour + 1); h++) {
                if (h >= 9 && h <= 19) googleBusyHours.add(h);
              }
            }
          }
        } catch (e) {
          console.error('Error fetching Google Calendar:', e);
        }
      }

      const slots = AVAILABLE_HOURS.map(hour => {
        const timeStr = `${hour.toString().padStart(2, '0')}:00`;
        const isBooked = bookedTimes.has(hour);
        const isGoogleBusy = googleBusyHours.has(hour);
        return {
          time: timeStr,
          available: !isBooked && !isGoogleBusy,
        };
      });

      return new Response(JSON.stringify({ slots }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'book-visit') {
      const { clientName, clientPhone, interestEventDate, guestCount, visitDate, visitTime, notes } = body;

      // Validations
      if (!clientName || !clientPhone || !visitDate || !visitTime) {
        return new Response(JSON.stringify({ error: 'Campos obrigatórios não preenchidos' }), { status: 400, headers: corsHeaders });
      }

      if (!isAllowedDay(visitDate)) {
        return new Response(JSON.stringify({ error: 'Visitas apenas às terças e quintas-feiras' }), { status: 400, headers: corsHeaders });
      }

      const today = new Date().toISOString().split('T')[0];
      if (visitDate < today) {
        return new Response(JSON.stringify({ error: 'Não é possível agendar em datas passadas' }), { status: 400, headers: corsHeaders });
      }

      const hour = parseInt(visitTime.split(':')[0], 10);
      if (hour < 9 || hour > 19) {
        return new Response(JSON.stringify({ error: 'Horário fora do permitido' }), { status: 400, headers: corsHeaders });
      }

      // Double-booking check
      const { data: existing } = await supabase
        .from('visits')
        .select('id')
        .eq('visit_date', visitDate)
        .eq('visit_time', visitTime + ':00')
        .neq('status', 'Cancelada')
        .limit(1);

      if (existing && existing.length > 0) {
        return new Response(JSON.stringify({ error: 'Este horário acabou de ficar indisponível. Por favor, escolha outro.' }), {
          status: 409, headers: corsHeaders,
        });
      }

      // Find the owner user_id (from google_settings or first user)
      const settings = await getOwnerSettings(supabase);
      const ownerUserId = settings?.user_id;
      
      if (!ownerUserId) {
        // Fallback: get any user from visits table
        const { data: anyVisit } = await supabase.from('visits').select('user_id').limit(1).single();
        if (!anyVisit) {
          return new Response(JSON.stringify({ error: 'Sistema não configurado' }), { status: 500, headers: corsHeaders });
        }
      }

      const userId = ownerUserId || (await supabase.from('visits').select('user_id').limit(1).single()).data?.user_id;

      // Create visit
      const { data: visit, error: insertError } = await supabase.from('visits').insert({
        user_id: userId,
        client_name: clientName,
        client_phone: clientPhone,
        interest_event_date: interestEventDate || null,
        guest_count: guestCount || 0,
        visit_date: visitDate,
        visit_time: visitTime + ':00',
        notes: notes || '',
        lead_source: 'Agendamento online',
        status: 'Agendada',
      }).select().single();

      if (insertError) {
        console.error('Insert error:', insertError);
        // Check if it's a duplicate
        if (insertError.code === '23505') {
          return new Response(JSON.stringify({ error: 'Este horário acabou de ficar indisponível.' }), {
            status: 409, headers: corsHeaders,
          });
        }
        return new Response(JSON.stringify({ error: 'Erro ao agendar visita' }), { status: 500, headers: corsHeaders });
      }

      // Create Google Calendar event
      let googleEventId: string | null = null;
      if (settings?.is_connected) {
        try {
          const token = await getValidToken(supabase, settings.user_id, settings);
          const calendarId = settings.calendar_id || 'primary';

          const startDateTime = `${visitDate}T${visitTime}:00`;
          const endDate = new Date(`${visitDate}T${visitTime}:00`);
          endDate.setHours(endDate.getHours() + 1);
          const endTime = `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}:00`;
          const endDateTime = `${visitDate}T${endTime}`;

          const visitDesc = [
            `👤 Cliente: ${clientName}`,
            `📞 Telefone: ${clientPhone}`,
            `📅 Data de interesse: ${interestEventDate || '—'}`,
            `👥 Quantidade de pessoas: ${guestCount || '—'}`,
            notes ? `📝 Observações: ${notes}` : '',
            `🌐 Origem: Agendamento online`,
            '',
            '— Criado automaticamente pelo CRM Lamoniê',
          ].filter(Boolean).join('\n');

          const eventBody = {
            summary: `Visita - ${clientName}`,
            description: visitDesc,
            location: 'Espaço Lamoniê',
            start: { dateTime: startDateTime, timeZone: 'America/Sao_Paulo' },
            end: { dateTime: endDateTime, timeZone: 'America/Sao_Paulo' },
            colorId: '7', // peacock/teal for visits
            extendedProperties: { private: { visit_id: visit.id, crm: 'lamonie' } },
          };

          const googleRes = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
            { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(eventBody) }
          );
          const resBody = await googleRes.json();
          if (googleRes.ok && resBody.id) {
            googleEventId = resBody.id;
            await supabase.from('visits').update({ google_event_id: googleEventId }).eq('id', visit.id);
          }

          await supabase.from('google_sync_logs').insert({
            user_id: userId,
            action: 'public-booking-sync',
            status: googleRes.ok ? 'success' : 'error',
            message: googleRes.ok ? `Public booking event: ${googleEventId}` : JSON.stringify(resBody),
            google_event_id: googleEventId,
          });
        } catch (e) {
          console.error('Google Calendar sync error:', e);
        }
      }

      return new Response(JSON.stringify({
        success: true,
        visit: {
          id: visit.id,
          clientName: visit.client_name,
          visitDate: visit.visit_date,
          visitTime: visitTime,
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: corsHeaders });
  } catch (err) {
    console.error('public-booking error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
