import { supabase } from './supabase';

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function signUp(username: string, password: string): Promise<any> {
  const { data: existing } = await supabase
    .from('profiles')
    .select('username')
    .eq('username', username)
    .maybeSingle();

  if (existing) throw new Error('Username already taken');

  const { data, error } = await supabase.auth.signUp({
    email: `${username}@hangout.local`,
    password,
    options: { data: { username } },
  });

  if (error) throw new Error(error.message);

  if (data.user?.identities?.length === 0) {
    throw new Error('Username already taken');
  }

  return { username };
}

export async function signInWithApple(identityToken: string): Promise<void> {
  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: identityToken,
  });
  if (error) throw new Error(error.message);
}

export async function signInWithGoogle(): Promise<'success' | 'cancelled'> {
  const redirectTo = 'thehangout://oauth';

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });

  if (error || !data.url) throw new Error(error?.message ?? 'OAuth failed');

  const { openAuthSessionAsync } = await import('expo-web-browser');
  const result = await openAuthSessionAsync(data.url, redirectTo);

  if (result.type !== 'success') return 'cancelled';

  const url = new URL(result.url);
  const hashParams = new URLSearchParams(url.hash.slice(1));
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');

  if (!accessToken || !refreshToken) throw new Error('No tokens in redirect');

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (sessionError) throw new Error(sessionError.message);
  return 'success';
}

export async function signIn(username: string, password: string): Promise<any> {
  const { error } = await supabase.auth.signInWithPassword({
    email: `${username}@hangout.local`,
    password,
  });

  if (error) throw new Error(error.message);
  return { username };
}

export async function registerPushToken(username: string, token: string): Promise<void> {
  await supabase.from('profiles').update({ push_token: token }).eq('username', username);
}

export async function getMyEvents(username: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('event_attendees')
    .select(`event_id, events(*)`)
    .eq('username', username);

  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => mapEvent(r.events)).filter(Boolean);
}

// ── Events ────────────────────────────────────────────────────────────────────

export async function getEvents(): Promise<any[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapEvent);
}

export async function createEvent(event: {
  title: string; location: string; time: string;
  createdBy: string; latitude?: number; longitude?: number;
}): Promise<any> {
  const { data, error } = await supabase
    .from('events')
    .insert({
      title: event.title,
      location: event.location,
      time: event.time,
      created_by: event.createdBy,
      lat: event.latitude,
      lng: event.longitude,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapEvent(data);
}

export async function updateEvent(
  id: number,
  event: { title: string; location: string; time: string; createdBy: string; latitude?: number; longitude?: number }
): Promise<any> {
  const { data, error } = await supabase
    .from('events')
    .update({ title: event.title, location: event.location, time: event.time })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapEvent(data);
}

export async function deleteEvent(id: number, _username: string): Promise<void> {
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function getEventAttendance(
  id: number, viewer?: string
): Promise<{ attendeeCount: number; isAttending: boolean }> {
  const { count } = await supabase
    .from('event_attendees')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', id);

  let isAttending = false;
  if (viewer) {
    const { data } = await supabase
      .from('event_attendees')
      .select('id')
      .eq('event_id', id)
      .eq('username', viewer)
      .maybeSingle();
    isAttending = !!data;
  }

  return { attendeeCount: count ?? 0, isAttending };
}

export async function joinEvent(
  id: number, username: string
): Promise<{ attendeeCount: number; isAttending: boolean }> {
  await supabase.from('event_attendees').insert({ event_id: id, username });
  return getEventAttendance(id, username);
}

export async function leaveEvent(
  id: number, username: string
): Promise<{ attendeeCount: number; isAttending: boolean }> {
  await supabase.from('event_attendees').delete().eq('event_id', id).eq('username', username);
  return getEventAttendance(id, username);
}

// ── Bubbles ───────────────────────────────────────────────────────────────────

export async function getBubbles(): Promise<any[]> {
  const { data, error } = await supabase
    .from('bubbles')
    .select(`*, bubble_member_detail(username)`)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapBubble);
}

export async function createBubble(bubble: {
  name: string; description?: string; createdBy: string; type?: string;
  meetTime?: string; maxMembers?: number; latitude?: number; longitude?: number;
  isSecret?: boolean; revealAt?: string;
}): Promise<any> {
  const { data, error } = await supabase
    .from('bubbles')
    .insert({
      name: bubble.name,
      description: bubble.description,
      created_by: bubble.createdBy,
      type: bubble.type,
      meet_time: bubble.meetTime,
      max_members: bubble.maxMembers,
      lat: bubble.latitude,
      lng: bubble.longitude,
      is_secret: bubble.isSecret ?? false,
      reveal_at: bubble.revealAt,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Auto-join the creator
  await supabase.from('bubble_member_detail').insert({
    bubble_id: data.id,
    username: bubble.createdBy,
  });

  return { ...mapBubble(data), members: [bubble.createdBy] };
}

export async function deleteBubble(id: number, _username: string): Promise<void> {
  const { error } = await supabase.from('bubbles').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function leaveBubble(id: number, username: string): Promise<void> {
  const { error } = await supabase
    .from('bubble_member_detail')
    .delete()
    .eq('bubble_id', id)
    .eq('username', username);
  if (error) throw new Error(error.message);
}

export async function joinBubble(id: number, username: string): Promise<any> {
  const { error } = await supabase
    .from('bubble_member_detail')
    .insert({ bubble_id: id, username });
  if (error) throw new Error(error.message);
  return { bubbleId: id, username };
}

export async function getBubbleMembers(id: number): Promise<any[]> {
  const { data, error } = await supabase
    .from('bubble_member_detail')
    .select('id, bubble_id, username, lat, lng, share_location, channel_id')
    .eq('bubble_id', id);

  if (error) throw new Error(error.message);
  return (data ?? []).map((m) => ({
    id: m.id,
    bubbleId: m.bubble_id,
    username: m.username,
    latitude: m.lat,
    longitude: m.lng,
    shareLocation: m.share_location,
    channelId: m.channel_id ?? 1,
  }));
}

export async function updateMemberLocation(
  id: number, username: string, shareLocation: boolean,
  latitude?: number, longitude?: number,
): Promise<any> {
  const { error } = await supabase
    .from('bubble_member_detail')
    .update({ share_location: shareLocation, lat: latitude, lng: longitude })
    .eq('bubble_id', id)
    .eq('username', username);
  if (error) throw new Error(error.message);
  return { username, shareLocation, latitude, longitude };
}

export async function getBubbleChannels(id: number): Promise<number[]> {
  const { data, error } = await supabase
    .from('bubble_member_detail')
    .select('channel_id')
    .eq('bubble_id', id);

  if (error) throw new Error(error.message);
  const ids = (data ?? []).map((m) => m.channel_id ?? 1);
  return Array.from(new Set(ids)).sort((a, b) => a - b);
}

export async function switchChannel(id: number, username: string, channelId: number): Promise<any> {
  const { error } = await supabase
    .from('bubble_member_detail')
    .update({ channel_id: channelId })
    .eq('bubble_id', id)
    .eq('username', username);
  if (error) throw new Error(error.message);
  return { channelId };
}

// ── Messages ──────────────────────────────────────────────────────────────────

export async function getMessages(id: number, channel: number): Promise<any[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, bubble_id, channel_id, username, message, created_at')
    .eq('bubble_id', id)
    .eq('channel_id', channel)
    .order('created_at', { ascending: true })
    .limit(200);

  if (error) throw new Error(error.message);
  return (data ?? []).map((m) => ({
    id: m.id,
    bubbleId: m.bubble_id,
    channelId: m.channel_id,
    username: m.username,
    message: m.message,
    createdAt: m.created_at,
  }));
}

export async function sendMessage(
  id: number, channelId: number, username: string, message: string,
): Promise<any> {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ bubble_id: id, channel_id: channelId, username, message })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return {
    id: data.id, bubbleId: data.bubble_id, channelId: data.channel_id,
    username: data.username, message: data.message, createdAt: data.created_at,
  };
}

// Typing indicators — ephemeral, handled via Realtime Broadcast in future
export async function notifyTyping(_id: number, _username: string): Promise<void> {}
export async function getTypingUsers(_id: number): Promise<string[]> { return []; }

// ── Pages ─────────────────────────────────────────────────────────────────────

export async function getPages(username?: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('pages')
    .select(`*, page_followers(count)`)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  let followed = new Set<number>();
  if (username) {
    const { data: myFollows } = await supabase
      .from('page_followers')
      .select('page_id')
      .eq('username', username);
    followed = new Set((myFollows ?? []).map((f) => f.page_id));
  }

  return (data ?? []).map((p) => ({
    id: p.id, name: p.name, description: p.description, category: p.category,
    createdBy: p.created_by, avatarColor: p.avatar_color,
    followerCount: p.page_followers?.[0]?.count ?? 0,
    following: followed.has(p.id),
  }));
}

export async function createPage(data: {
  name: string; description?: string; category?: string;
  createdBy: string; avatarColor?: string;
}): Promise<any> {
  const { data: row, error } = await supabase
    .from('pages')
    .insert({
      name: data.name, description: data.description,
      category: data.category, created_by: data.createdBy,
      avatar_color: data.avatarColor,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapPage(row);
}

export async function getPage(id: number, username?: string): Promise<any> {
  const { data, error } = await supabase
    .from('pages')
    .select(`*, page_followers(count)`)
    .eq('id', id)
    .single();

  if (error) throw new Error(error.message);

  let isFollowing = false;
  if (username) {
    const { data: follow } = await supabase
      .from('page_followers')
      .select('id')
      .eq('page_id', id)
      .eq('username', username)
      .maybeSingle();
    isFollowing = !!follow;
  }

  return { ...mapPage(data), followerCount: data.page_followers?.[0]?.count ?? 0, following: isFollowing };
}

export async function toggleFollow(pageId: number, username: string): Promise<any> {
  const { data: existing } = await supabase
    .from('page_followers')
    .select('id')
    .eq('page_id', pageId)
    .eq('username', username)
    .maybeSingle();

  let following: boolean;
  if (existing) {
    await supabase.from('page_followers').delete().eq('id', existing.id);
    following = false;
  } else {
    await supabase.from('page_followers').insert({ page_id: pageId, username });
    following = true;
  }

  const { count } = await supabase
    .from('page_followers')
    .select('*', { count: 'exact', head: true })
    .eq('page_id', pageId);

  return { following, followerCount: count ?? 0 };
}

export async function getPageContent(_pageId: number): Promise<{ events: any[]; bubbles: any[] }> {
  return { events: [], bubbles: [] };
}

export async function getFollowingPages(username: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('page_followers')
    .select(`page_id, pages(*)`)
    .eq('username', username);

  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => mapPage(r.pages)).filter(Boolean);
}

// ── Profile ───────────────────────────────────────────────────────────────────

export async function getProfile(username: string, viewer?: string): Promise<any> {
  const [profileRes, followerRes, followingRes, ratingsRes] = await Promise.all([
    supabase.from('profiles').select('username, bio, avatar_color, profile_emoji').eq('username', username).single(),
    supabase.from('user_follows').select('*', { count: 'exact', head: true }).eq('followee', username),
    supabase.from('user_follows').select('*', { count: 'exact', head: true }).eq('follower', username),
    supabase.from('user_ratings').select('rating').eq('rated_username', username),
  ]);

  if (profileRes.error) throw new Error(profileRes.error.message);

  let isFollowing = false;
  if (viewer) {
    const { data } = await supabase
      .from('user_follows').select('id').eq('follower', viewer).eq('followee', username).maybeSingle();
    isFollowing = !!data;
  }

  const ratings = ratingsRes.data ?? [];
  const avgRating = ratings.length > 0
    ? ratings.reduce((s: number, r: any) => s + r.rating, 0) / ratings.length
    : 0;

  return {
    username: profileRes.data.username,
    bio: profileRes.data.bio ?? '',
    avatarColor: profileRes.data.avatar_color ?? '#7c3aed',
    profileEmoji: profileRes.data.profile_emoji ?? '',
    followerCount: followerRes.count ?? 0,
    followingCount: followingRes.count ?? 0,
    isFollowing,
    averageRating: avgRating,
    ratingCount: ratings.length,
  };
}

export async function updateProfile(
  username: string,
  data: { bio?: string; avatarColor?: string; profileEmoji?: string }
): Promise<any> {
  const update: Record<string, any> = {};
  if (data.bio !== undefined) update.bio = data.bio;
  if (data.avatarColor !== undefined) update.avatar_color = data.avatarColor;
  if (data.profileEmoji !== undefined) update.profile_emoji = data.profileEmoji;

  const { error } = await supabase.from('profiles').update(update).eq('username', username);
  if (error) throw new Error(error.message);
  return { username, ...data };
}

export async function getUserBubbles(username: string): Promise<{ created: any[]; joined: any[] }> {
  const { data: createdRaw } = await supabase
    .from('bubbles')
    .select(`*, bubble_member_detail(username)`)
    .eq('created_by', username)
    .order('created_at', { ascending: false });

  const { data: memberRows } = await supabase
    .from('bubble_member_detail')
    .select('bubble_id')
    .eq('username', username);

  const joinedIds = (memberRows ?? []).map((m) => m.bubble_id);

  const { data: allJoined } = joinedIds.length > 0
    ? await supabase
        .from('bubbles')
        .select(`*, bubble_member_detail(username)`)
        .in('id', joinedIds)
        .neq('created_by', username)
        .order('created_at', { ascending: false })
    : { data: [] };

  return {
    created: (createdRaw ?? []).map(mapBubble),
    joined: (allJoined ?? []).map(mapBubble),
  };
}

export async function toggleUserFollow(username: string, follower: string): Promise<any> {
  const { data: existing } = await supabase
    .from('user_follows')
    .select('id')
    .eq('follower', follower)
    .eq('followee', username)
    .maybeSingle();

  if (existing) {
    await supabase.from('user_follows').delete().eq('id', existing.id);
    return { isFollowing: false };
  } else {
    await supabase.from('user_follows').insert({ follower, followee: username });
    return { isFollowing: true };
  }
}

export async function canRateUser(username: string, raterUsername: string): Promise<any> {
  const [myBubbleRes, existingRatingRes] = await Promise.all([
    supabase.from('bubble_member_detail').select('bubble_id').eq('username', raterUsername),
    supabase.from('user_ratings').select('id').eq('rated_username', username).eq('rater_username', raterUsername).maybeSingle(),
  ]);

  const bubbleIds = (myBubbleRes.data ?? []).map((b) => b.bubble_id);
  let sharedBubble = false;

  if (bubbleIds.length > 0) {
    const { data } = await supabase
      .from('bubble_member_detail')
      .select('id')
      .eq('username', username)
      .in('bubble_id', bubbleIds)
      .limit(1)
      .maybeSingle();
    sharedBubble = !!data;
  }

  return {
    canRate: sharedBubble && !existingRatingRes.data,
    reason: !sharedBubble ? 'No shared bubble' : existingRatingRes.data ? 'Already rated' : undefined,
  };
}

export async function submitRating(
  username: string,
  data: { raterUsername: string; rating: number; reason: string }
): Promise<any> {
  const { error } = await supabase.from('user_ratings').insert({
    rated_username: username,
    rater_username: data.raterUsername,
    rating: data.rating,
    reason: data.reason,
  });
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function getUserRatings(username: string): Promise<any> {
  const { data, error } = await supabase
    .from('user_ratings')
    .select('id, rater_username, rating, reason, bubble_id, created_at')
    .eq('rated_username', username)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  const ratings = data ?? [];
  const avg = ratings.length > 0
    ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length
    : 0;

  return {
    ratings: ratings.map((r) => ({
      id: r.id, raterUsername: r.rater_username, rating: r.rating,
      reason: r.reason, bubbleId: r.bubble_id, createdAt: r.created_at,
    })),
    averageRating: avg,
    ratingCount: ratings.length,
  };
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapEvent(r: any) {
  return {
    id: r.id, title: r.title, location: r.location, time: r.time,
    createdBy: r.created_by, latitude: r.lat, longitude: r.lng,
    createdAt: r.created_at,
  };
}

function mapBubble(r: any) {
  return {
    id: r.id, name: r.name, description: r.description,
    createdBy: r.created_by, type: r.type, meetTime: r.meet_time,
    maxMembers: r.max_members, latitude: r.lat, longitude: r.lng,
    isSecret: r.is_secret, revealAt: r.reveal_at, createdAt: r.created_at,
    members: (r.bubble_member_detail ?? []).map((m: any) => m.username),
  };
}

function mapPage(r: any) {
  if (!r) return null;
  return {
    id: r.id, name: r.name, description: r.description,
    category: r.category, createdBy: r.created_by,
    avatarColor: r.avatar_color, createdAt: r.created_at,
  };
}
