import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  // Only the pg_cron job may call this
  const secret = req.headers.get('x-cron-secret');
  if (!secret || secret !== Deno.env.get('CRON_SECRET')) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  try {
    const { data: due, error } = await supabase
      .from('event_reminders')
      .select('id, username, event_id, events ( title, location, time, event_date )')
      .eq('sent', false)
      .lte('remind_at', new Date().toISOString())
      .limit(100);
    if (error) throw error;
    if (!due || due.length === 0) return json({ processed: 0, sent: 0 });

    // Skip reminders whose event already started (e.g. reminder set < 1 hr before,
    // or the cron was down past the start time)
    const now = Date.now();
    const active = due.filter((r: any) =>
      r.events && (!r.events.event_date || new Date(r.events.event_date).getTime() > now),
    );

    if (active.length > 0) {
      await supabase.from('notifications').insert(
        active.map((r: any) => ({
          recipient_username: r.username,
          type: 'event_reminder',
          title: `Starting soon: ${r.events.title}`,
          body: `${r.events.location} · ${r.events.time}`,
          data: { eventId: r.event_id },
        })),
      );

      const { data: profiles } = await supabase
        .from('profiles')
        .select('username, push_token')
        .in('username', [...new Set(active.map((r: any) => r.username))]);
      const tokens = new Map((profiles ?? []).map((p) => [p.username, p.push_token]));

      const messages = active
        .filter((r: any) => tokens.get(r.username))
        .map((r: any) => ({
          to: tokens.get(r.username),
          title: `Starting soon: ${r.events.title}`,
          body: `${r.events.location} · ${r.events.time}`,
          data: { eventId: r.event_id },
          sound: 'default',
          priority: 'high',
        }));

      // Expo accepts up to 100 messages per request
      for (let i = 0; i < messages.length; i += 100) {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate',
          },
          body: JSON.stringify(messages.slice(i, i + 100)),
        });
      }
    }

    // Mark everything due as sent — including skipped past-start reminders,
    // so they are never retried
    await supabase
      .from('event_reminders')
      .update({ sent: true })
      .in('id', due.map((r: any) => r.id));

    return json({ processed: due.length, sent: active.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    return json({ error: message }, 500);
  }
});
