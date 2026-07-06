import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

// Rate limit: max notifications a single actor may trigger per rolling minute.
const RATE_LIMIT_PER_MIN = 20;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // ── Authenticate the caller ────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);

  const callerSupabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error: authError } = await callerSupabase.auth.getUser();
  if (authError || !user) return json({ error: 'Unauthorized' }, 401);

  // Service-role client for verification + privileged writes
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  // Resolve the caller's username from their verified uid — never trust the body
  const { data: actorProfile } = await supabase
    .from('profiles').select('username').eq('id', user.id).single();
  const actor = actorProfile?.username;
  if (!actor) return json({ error: 'No profile' }, 403);

  try {
    const { type, data } = await req.json();
    const payload = data ?? {};

    // ── Rate limit per actor ─────────────────────────────────────────────────
    const since = new Date(Date.now() - 60_000).toISOString();
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('actor_username', actor)
      .gte('created_at', since);
    if ((count ?? 0) >= RATE_LIMIT_PER_MIN) {
      return json({ error: 'Rate limit exceeded' }, 429);
    }

    // ── Verify the relationship & build trusted text server-side ─────────────
    // The caller cannot set the recipient or the message; both are derived from
    // the real action they performed, so this endpoint can't be used to phish.
    let recipient: string | null = null;
    let title = '';
    let body = '';

    if (type === 'bubble_join') {
      const bubbleId = Number(payload.bubbleId);
      if (!bubbleId) return json({ error: 'Bad request' }, 400);
      const { data: bubble } = await supabase
        .from('bubbles').select('created_by, name').eq('id', bubbleId).single();
      const { data: membership } = await supabase
        .from('bubble_member_detail').select('id')
        .eq('bubble_id', bubbleId).eq('username', actor).maybeSingle();
      if (!bubble || !membership) return json({ error: 'Not a member' }, 403);
      if (bubble.created_by === actor) return json({ success: true, skipped: 'self' });
      recipient = bubble.created_by;
      title = 'Someone joined your bubble!';
      body = `${actor} just joined "${bubble.name}"`;

    } else if (type === 'event_join') {
      const eventId = Number(payload.eventId);
      if (!eventId) return json({ error: 'Bad request' }, 400);
      const { data: event } = await supabase
        .from('events').select('created_by, title').eq('id', eventId).single();
      const { data: attendance } = await supabase
        .from('event_attendees').select('id')
        .eq('event_id', eventId).eq('username', actor).maybeSingle();
      if (!event || !attendance) return json({ error: 'Not attending' }, 403);
      if (event.created_by === actor) return json({ success: true, skipped: 'self' });
      recipient = event.created_by;
      title = "Someone RSVP'd to your event!";
      body = `${actor} is going to "${event.title}"`;

    } else if (type === 'invite') {
      const bubbleId = payload.bubbleId ? Number(payload.bubbleId) : null;
      const eventId = payload.eventId ? Number(payload.eventId) : null;
      // Must correspond to a real invite this actor actually sent
      const { data: invite } = await supabase
        .from('invites')
        .select('invitee_username, bubble_id, event_id')
        .eq('inviter_username', actor)
        .eq(bubbleId ? 'bubble_id' : 'event_id', bubbleId ?? eventId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!invite) return json({ error: 'No matching invite' }, 403);
      recipient = invite.invitee_username;
      if (bubbleId) {
        const { data: b } = await supabase.from('bubbles').select('name').eq('id', bubbleId).single();
        title = `${actor} invited you to a bubble!`;
        body = `Join "${b?.name ?? 'a bubble'}"`;
      } else {
        const { data: e } = await supabase.from('events').select('title').eq('id', eventId).single();
        title = `${actor} invited you to an event!`;
        body = `Join "${e?.title ?? 'an event'}"`;
      }

    } else {
      return json({ error: 'Unknown notification type' }, 400);
    }

    if (!recipient) return json({ error: 'No recipient' }, 400);

    // ── Fetch recipient push token & deliver ─────────────────────────────────
    const { data: profile } = await supabase
      .from('profiles').select('push_token').eq('username', recipient).single();

    await supabase.from('notifications').insert({
      recipient_username: recipient,
      actor_username: actor,
      type,
      title,
      body,
      data: payload,
    });

    if (profile?.push_token) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify({
          to: profile.push_token,
          title,
          body,
          data: payload,
          sound: 'default',
          priority: 'high',
        }),
      });
    }

    return json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    return json({ error: message }, 500);
  }
});
