const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Disabled: event time alerts (30min/10min/overdue) and event finished notifications were removed per user request.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  return new Response(JSON.stringify({ disabled: true, checked: 0, alerts: 0 }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
