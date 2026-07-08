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

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  // A delete that failed must abort the whole run — deleting the auth user
  // while table rows remain would strand orphaned personal data.
  const mustDelete = async (p: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await p;
    if (error) throw new Error(error.message);
  };

  try {
    const { data: profile } = await supabase
      .from('profiles').select('username').eq('id', user.id).maybeSingle();
    const username = profile?.username;

    if (username) {
      // ── Content the user owns — delete children before parents ────────────
      const { data: myBubbles } = await supabase
        .from('bubbles').select('id').eq('created_by', username);
      const bubbleIds = (myBubbles ?? []).map((b) => b.id);
      if (bubbleIds.length) {
        const { data: bubbleDiscussions } = await supabase
          .from('discussions').select('id').in('bubble_id', bubbleIds);
        const dIds = (bubbleDiscussions ?? []).map((d) => d.id);
        if (dIds.length) {
          await mustDelete(supabase.from('discussion_replies').delete().in('discussion_id', dIds));
          await mustDelete(supabase.from('discussions').delete().in('id', dIds));
        }
        await mustDelete(supabase.from('chat_messages').delete().in('bubble_id', bubbleIds));
        await mustDelete(supabase.from('bubble_member_detail').delete().in('bubble_id', bubbleIds));
        await mustDelete(supabase.from('bubbles').delete().in('id', bubbleIds));
      }

      const { data: myEvents } = await supabase
        .from('events').select('id').eq('created_by', username);
      const eventIds = (myEvents ?? []).map((e) => e.id);
      if (eventIds.length) {
        await mustDelete(supabase.from('event_messages').delete().in('event_id', eventIds));
        await mustDelete(supabase.from('event_attendees').delete().in('event_id', eventIds));
        await mustDelete(supabase.from('event_reminders').delete().in('event_id', eventIds));
        await mustDelete(supabase.from('events').delete().in('id', eventIds));
      }

      const { data: myPages } = await supabase
        .from('pages').select('id').eq('created_by', username);
      const pageIds = (myPages ?? []).map((p) => p.id);
      if (pageIds.length) {
        await mustDelete(supabase.from('page_followers').delete().in('page_id', pageIds));
        await mustDelete(supabase.from('pages').delete().in('id', pageIds));
      }

      // Discussions the user started inside other people's bubbles
      const { data: myDiscussions } = await supabase
        .from('discussions').select('id').eq('created_by', username);
      const myDIds = (myDiscussions ?? []).map((d) => d.id);
      if (myDIds.length) {
        await mustDelete(supabase.from('discussion_replies').delete().in('discussion_id', myDIds));
        await mustDelete(supabase.from('discussions').delete().in('id', myDIds));
      }

      // ── The user's rows in shared tables ───────────────────────────────────
      // Separate .eq() deletes instead of .or() — usernames are user-chosen
      // strings and must never be interpolated into a PostgREST filter.
      await mustDelete(supabase.from('discussion_replies').delete().eq('username', username));
      await mustDelete(supabase.from('chat_messages').delete().eq('username', username));
      await mustDelete(supabase.from('bubble_member_detail').delete().eq('username', username));
      await mustDelete(supabase.from('event_messages').delete().eq('username', username));
      await mustDelete(supabase.from('event_attendees').delete().eq('username', username));
      await mustDelete(supabase.from('event_reminders').delete().eq('username', username));
      await mustDelete(supabase.from('page_followers').delete().eq('username', username));
      await mustDelete(supabase.from('user_follows').delete().eq('follower', username));
      await mustDelete(supabase.from('user_follows').delete().eq('followee', username));
      await mustDelete(supabase.from('user_ratings').delete().eq('rater_username', username));
      await mustDelete(supabase.from('user_ratings').delete().eq('rated_username', username));
      await mustDelete(supabase.from('blocked_users').delete().eq('blocker', username));
      await mustDelete(supabase.from('blocked_users').delete().eq('blocked', username));
      await mustDelete(supabase.from('notifications').delete().eq('recipient_username', username));
      await mustDelete(supabase.from('notifications').delete().eq('actor_username', username));
      await mustDelete(supabase.from('invites').delete().eq('inviter_username', username));
      await mustDelete(supabase.from('invites').delete().eq('invitee_username', username));
      await mustDelete(supabase.from('direct_messages').delete().eq('sender_username', username));
      await mustDelete(supabase.from('direct_messages').delete().eq('recipient_username', username));
      // `reports` rows are intentionally retained as a moderation audit trail.
    }

    // ── Avatar, profile row, auth user ───────────────────────────────────────
    await supabase.storage.from('avatars').remove([`${user.id}/avatar`]);
    await mustDelete(supabase.from('profiles').delete().eq('id', user.id));

    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(user.id);
    if (authDeleteError) throw new Error(authDeleteError.message);

    return json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : JSON.stringify(err);
    return json({ error: message }, 500);
  }
});
