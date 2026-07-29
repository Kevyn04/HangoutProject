import { supabase } from './supabase';

export type ActivityItem = {
  id: string;
  type: 'bubble_created' | 'event_created' | 'event_attending';
  username: string;
  createdAt: string;
  bubble?: { id: number; name: string; type?: string; members: string[]; description?: string; isSecret: boolean };
  event?: { id: number; title: string; location: string; time: string; createdBy: string };
};

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function signUp(username: string, password: string, captchaToken?: string): Promise<any> {
  const { data: existing } = await supabase
    .from('profiles')
    .select('username')
    .eq('username', username)
    .maybeSingle();

  if (existing) throw new Error('Username already taken');

  const { data, error } = await supabase.auth.signUp({
    email: `${username}@hangout.local`,
    password,
    options: { data: { username }, captchaToken },
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

export async function signIn(username: string, password: string, captchaToken?: string): Promise<any> {
  const { error } = await supabase.auth.signInWithPassword({
    email: `${username}@hangout.local`,
    password,
    options: { captchaToken },
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
    .or(futureEventsFilter())
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapEvent);
}

export async function getEventById(id: number): Promise<any> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw new Error(error.message);
  return mapEvent(data);
}

export async function createEvent(event: {
  title: string; location: string; time: string;
  createdBy: string; latitude?: number; longitude?: number; type?: string;
  eventDateISO?: string; coverUrl?: string;
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
      type: event.type ?? null,
      event_date: event.eventDateISO ?? null,
      cover_url: event.coverUrl ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return mapEvent(data);
}

export async function updateEvent(
  id: number,
  event: { title: string; location: string; time: string; createdBy: string; latitude?: number; longitude?: number; coverUrl?: string }
): Promise<any> {
  const update: Record<string, any> = { title: event.title, location: event.location, time: event.time };
  if (event.coverUrl !== undefined) update.cover_url = event.coverUrl;
  const { data, error } = await supabase
    .from('events')
    .update(update)
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

export async function getEventAttendees(id: number): Promise<string[]> {
  const { data, error } = await supabase
    .from('event_attendees')
    .select('username')
    .eq('event_id', id)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.username);
}

export async function getEventAttendance(
  id: number, viewer?: string
): Promise<{ attendeeCount: number; isAttending: boolean }> {
  const { data, error } = await supabase
    .from('event_attendees')
    .select('username')
    .eq('event_id', id);

  if (error) throw new Error(error.message);

  const usernames = (data ?? []).map((r) => r.username as string);
  return {
    attendeeCount: usernames.length,
    isAttending: viewer ? usernames.includes(viewer) : false,
  };
}

export async function joinEvent(
  id: number, username: string
): Promise<{ attendeeCount: number; isAttending: boolean }> {
  const { error } = await supabase
    .from('event_attendees')
    .upsert({ event_id: id, username }, { onConflict: 'event_id,username', ignoreDuplicates: true });
  if (error) throw new Error(error.message);

  // Notify event creator (fire-and-forget)
  const { data: event } = await supabase
    .from('events').select('created_by, title').eq('id', id).single();
  if (event && event.created_by !== username) {
    sendPushNotification(
      event.created_by, 'event_join',
      "Someone RSVP'd to your event!",
      `${username} is going to "${event.title}"`,
      { eventId: id },
    );
  }

  return getEventAttendance(id, username);
}

export async function leaveEvent(
  id: number, username: string
): Promise<{ attendeeCount: number; isAttending: boolean }> {
  const { error } = await supabase.from('event_attendees').delete().eq('event_id', id).eq('username', username);
  if (error) throw new Error(error.message);
  return getEventAttendance(id, username);
}

// ── Privacy Consent ───────────────────────────────────────────────────────────

// Fire-and-forget: stamps the profile with when the user accepted the privacy
// policy. Only sets it once — keeps the original acceptance time.
export function recordPrivacyConsent(username: string, acceptedAtISO: string): void {
  supabase
    .from('profiles')
    .update({ privacy_accepted_at: acceptedAtISO })
    .eq('username', username)
    .is('privacy_accepted_at', null)
    .then(() => {}, () => {});
}

// ── Event Reminders (server-side, delivered by send-event-reminders cron) ────

export async function setEventReminder(
  eventId: number, username: string, remindAtISO: string
): Promise<void> {
  const { error } = await supabase
    .from('event_reminders')
    .upsert(
      { event_id: eventId, username, remind_at: remindAtISO },
      { onConflict: 'event_id,username', ignoreDuplicates: true },
    );
  if (error) throw new Error(error.message);
}

export async function cancelEventReminder(eventId: number, username: string): Promise<void> {
  const { error } = await supabase
    .from('event_reminders')
    .delete()
    .eq('event_id', eventId)
    .eq('username', username);
  if (error) throw new Error(error.message);
}

export async function hasEventReminder(eventId: number, username: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('event_reminders')
    .select('id')
    .eq('event_id', eventId)
    .eq('username', username)
    .eq('sent', false)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

// ── Bubbles ───────────────────────────────────────────────────────────────────

export async function getBubbles(): Promise<any[]> {
  const { data, error } = await supabase
    .from('bubbles')
    .select(`*, bubble_member_detail(username)`)
    .or(futureBubblesFilter())
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapBubble);
}

export async function getBubbleById(id: number): Promise<any | null> {
  const { data, error } = await supabase
    .from('bubbles')
    .select(`*, bubble_member_detail(username)`)
    .eq('id', id)
    .single();

  if (error) return null;
  return mapBubble(data);
}

export async function createBubble(bubble: {
  name: string; description?: string; createdBy: string; type?: string;
  meetTime?: string; maxMembers?: number; latitude?: number; longitude?: number;
  isSecret?: boolean; revealAt?: string; endsAt?: string;
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
      ends_at: bubble.endsAt,
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

  // Notify bubble creator (fire-and-forget)
  const { data: bubble } = await supabase
    .from('bubbles').select('created_by, name').eq('id', id).single();
  if (bubble && bubble.created_by !== username) {
    sendPushNotification(
      bubble.created_by, 'bubble_join',
      'Someone joined your bubble!',
      `${username} just joined "${bubble.name}"`,
      { bubbleId: id },
    );
  }

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
    .select('id, bubble_id, channel_id, username, message, image_url, created_at')
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
    imageUrl: m.image_url ?? null,
    createdAt: m.created_at,
  }));
}

export async function sendMessage(
  id: number, channelId: number, username: string, message: string, imageUrl?: string,
): Promise<any> {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({ bubble_id: id, channel_id: channelId, username, message, image_url: imageUrl ?? null })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return {
    id: data.id, bubbleId: data.bubble_id, channelId: data.channel_id,
    username: data.username, message: data.message, imageUrl: data.image_url ?? null,
    createdAt: data.created_at,
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

export async function getPageContent(pageId: number): Promise<{ events: any[]; bubbles: any[] }> {
  const { data: page, error: pageError } = await supabase
    .from('pages')
    .select('created_by')
    .eq('id', pageId)
    .single();

  if (pageError || !page) return { events: [], bubbles: [] };

  const [eventsRes, bubblesRes] = await Promise.all([
    supabase
      .from('events')
      .select('*')
      .eq('created_by', page.created_by)
      .or(futureEventsFilter())
      .order('created_at', { ascending: false }),
    supabase
      .from('bubbles')
      .select('*, bubble_member_detail(username)')
      .eq('created_by', page.created_by)
      .order('created_at', { ascending: false }),
  ]);

  return {
    events: (eventsRes.data ?? []).map(mapEvent),
    bubbles: (bubblesRes.data ?? []).map(mapBubble),
  };
}

export async function getFollowingPages(username: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('page_followers')
    .select(`page_id, pages(*)`)
    .eq('username', username);

  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => mapPage(r.pages)).filter(Boolean);
}

// ── Page Posts / Moderation / Analytics ───────────────────────────────────────

export type PagePost = {
  id: number;
  pageId: number;
  username: string;
  content: string;
  createdAt: string;
};

export async function getPagePosts(pageId: number): Promise<PagePost[]> {
  const { data, error } = await supabase
    .from('page_posts')
    .select('*')
    .eq('page_id', pageId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id, pageId: r.page_id, username: r.username,
    content: r.content, createdAt: r.created_at,
  }));
}

export async function createPagePost(pageId: number, username: string, content: string): Promise<void> {
  const { error } = await supabase
    .from('page_posts')
    .insert({ page_id: pageId, username, content });
  if (error) throw new Error(error.message);
}

export async function deletePagePost(id: number): Promise<void> {
  const { error } = await supabase.from('page_posts').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function getPageModerators(pageId: number): Promise<string[]> {
  const { data, error } = await supabase
    .from('page_moderators')
    .select('username')
    .eq('page_id', pageId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.username);
}

export async function addPageModerator(pageId: number, username: string, addedBy: string): Promise<void> {
  const { error } = await supabase
    .from('page_moderators')
    .insert({ page_id: pageId, username, added_by: addedBy });
  if (error) throw new Error(error.message);
}

export async function removePageModerator(pageId: number, username: string): Promise<void> {
  const { error } = await supabase
    .from('page_moderators')
    .delete()
    .eq('page_id', pageId)
    .eq('username', username);
  if (error) throw new Error(error.message);
}

export type PageAnalytics = {
  followerCount: number;
  gained7d: number;
  gained30d: number;
  postCount: number;
};

export async function getPageAnalytics(pageId: number): Promise<PageAnalytics> {
  const now = Date.now();
  const iso7d = new Date(now - 7 * 24 * 3600 * 1000).toISOString();
  const iso30d = new Date(now - 30 * 24 * 3600 * 1000).toISOString();

  const [total, last7, last30, posts] = await Promise.all([
    supabase.from('page_followers').select('*', { count: 'exact', head: true }).eq('page_id', pageId),
    supabase.from('page_followers').select('*', { count: 'exact', head: true }).eq('page_id', pageId).gt('created_at', iso7d),
    supabase.from('page_followers').select('*', { count: 'exact', head: true }).eq('page_id', pageId).gt('created_at', iso30d),
    supabase.from('page_posts').select('*', { count: 'exact', head: true }).eq('page_id', pageId),
  ]);

  return {
    followerCount: total.count ?? 0,
    gained7d: last7.count ?? 0,
    gained30d: last30.count ?? 0,
    postCount: posts.count ?? 0,
  };
}

// ── Profile ───────────────────────────────────────────────────────────────────

const IMAGE_ALLOWED_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg',
  png: 'image/png', webp: 'image/webp',
  heic: 'image/heic', heif: 'image/heif',
};
const IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

// Shared upload pipeline: validates the extension, re-encodes through the
// pixel pipeline (strips EXIF, embedded scripts, polyglot payloads), then
// uploads pure-pixel JPEG to the given bucket path.
async function uploadImage(
  localUri: string, bucket: string, path: string,
  resize: { width: number; height?: number }, upsert: boolean,
): Promise<string> {
  const rawExt = localUri.split('.').pop()?.toLowerCase() ?? '';
  if (!IMAGE_ALLOWED_MIME[rawExt]) throw new Error('Only JPG, PNG, WebP, or HEIC images are allowed.');

  const { manipulateAsync, SaveFormat } = await import('expo-image-manipulator');
  const clean = await manipulateAsync(
    localUri,
    [{ resize }],
    { compress: 0.85, format: SaveFormat.JPEG }
  );

  const response = await fetch(clean.uri);
  const blob = await response.blob();

  if (blob.size > IMAGE_MAX_BYTES) throw new Error('Image must be under 5 MB.');

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, blob, { upsert, contentType: 'image/jpeg' });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

async function requireUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

// Extract the in-bucket object path from a Supabase public URL, e.g.
// https://xxx.supabase.co/storage/v1/object/public/stories/<uid>/<file>.jpg?t=123
// -> "<uid>/<file>.jpg". Returns null if the URL doesn't belong to the bucket.
function storagePathFromPublicUrl(url: string | null | undefined, bucket: string): string | null {
  if (!url) return null;
  const marker = `/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return url.slice(i + marker.length).split('?')[0];
}

export async function uploadAvatar(localUri: string): Promise<string> {
  const uid = await requireUserId();
  return uploadImage(localUri, 'avatars', `${uid}/avatar`, { width: 400, height: 400 }, true);
}

export async function uploadEventCover(localUri: string): Promise<string> {
  const uid = await requireUserId();
  return uploadImage(localUri, 'event-covers', `${uid}/${Date.now()}.jpg`, { width: 1200 }, false);
}

export async function uploadChatImage(localUri: string): Promise<string> {
  const uid = await requireUserId();
  return uploadImage(localUri, 'chat-media', `${uid}/${Date.now()}.jpg`, { width: 1200 }, false);
}

export async function getProfile(username: string, viewer?: string): Promise<any> {
  const [profileRes, followerRes, followingRes, ratingsRes] = await Promise.all([
    supabase.from('profiles').select('username, bio, avatar_color, profile_emoji, avatar_url, pronouns').eq('username', username).single(),
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
    avatarUrl: profileRes.data.avatar_url ?? null,
    pronouns: profileRes.data.pronouns ?? null,
    followerCount: followerRes.count ?? 0,
    followingCount: followingRes.count ?? 0,
    isFollowing,
    averageRating: avgRating,
    ratingCount: ratings.length,
  };
}

export async function updateProfile(
  username: string,
  data: { bio?: string; avatarColor?: string; profileEmoji?: string; avatarUrl?: string; pronouns?: string | null }
): Promise<any> {
  const update: Record<string, any> = {};
  if (data.bio !== undefined) update.bio = data.bio;
  if (data.avatarColor !== undefined) update.avatar_color = data.avatarColor;
  if (data.profileEmoji !== undefined) update.profile_emoji = data.profileEmoji;
  if (data.avatarUrl !== undefined) update.avatar_url = data.avatarUrl;
  if (data.pronouns !== undefined) update.pronouns = data.pronouns;

  const { error } = await supabase.from('profiles').update(update).eq('username', username);
  if (error) throw new Error(error.message);
  return { username, ...data };
}

// Permanently deletes the account server-side (delete-account Edge Function
// wipes all rows + avatar + auth user), then clears the local session.
export async function deleteMyAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke('delete-account');
  if (error) throw new Error('Account deletion failed. Please try again.');
  // The auth user no longer exists — a server sign-out would 401, so only
  // clear the session stored on this device.
  await supabase.auth.signOut({ scope: 'local' });
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

// ── Feed ──────────────────────────────────────────────────────────────────────

// Fire-and-forget: stamps the profile with a coarse last-known position.
// Rounded to 2 decimals (~1.1 km) before it ever leaves the device.
export function updateMyCoarseLocation(username: string, latitude: number, longitude: number): void {
  const coarse = (v: number) => Math.round(v * 100) / 100;
  supabase
    .from('profiles')
    .update({
      last_lat: coarse(latitude),
      last_lng: coarse(longitude),
      location_updated_at: new Date().toISOString(),
    })
    .eq('username', username)
    .then(() => {}, () => {});
}

// Users active nearby in the last 7 days. Server returns distance only —
// never coordinates (nearby_users is SECURITY DEFINER).
export async function getNearbyUsers(
  latitude: number, longitude: number
): Promise<Array<{ username: string; distanceKm: number }>> {
  const { data, error } = await supabase.rpc('nearby_users', {
    my_lat: latitude, my_lng: longitude,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({ username: r.username, distanceKm: r.distance_km }));
}

export async function getSuggestedUsers(
  username: string,
  coords?: { latitude: number; longitude: number },
): Promise<Array<{ username: string; mutualBubbles: number; distanceKm?: number }>> {
  const [membershipsRes, followsRes, nearby] = await Promise.all([
    supabase.from('bubble_member_detail').select('bubble_id').eq('username', username),
    supabase.from('user_follows').select('followee').eq('follower', username),
    coords
      ? getNearbyUsers(coords.latitude, coords.longitude).catch(() => [] as Array<{ username: string; distanceKm: number }>)
      : Promise.resolve([] as Array<{ username: string; distanceKm: number }>),
  ]);

  const followedSet = new Set((followsRes.data ?? []).map((f: any) => f.followee));
  const bubbleIds = (membershipsRes.data ?? []).map((m: any) => m.bubble_id);

  const counts: Record<string, number> = {};
  if (bubbleIds.length > 0) {
    const { data: coMembers } = await supabase
      .from('bubble_member_detail')
      .select('username')
      .in('bubble_id', bubbleIds)
      .neq('username', username);
    for (const { username: u } of coMembers ?? []) {
      if (!followedSet.has(u)) counts[u] = (counts[u] ?? 0) + 1;
    }
  }

  const distances = new Map(
    nearby
      .filter((n) => n.username !== username && !followedSet.has(n.username))
      .map((n) => [n.username, n.distanceKm] as const)
  );

  const usernames = new Set([...Object.keys(counts), ...distances.keys()]);
  return Array.from(usernames)
    .map((u) => ({
      username: u,
      mutualBubbles: counts[u] ?? 0,
      distanceKm: distances.get(u),
    }))
    .sort((a, b) =>
      b.mutualBubbles - a.mutualBubbles
      || (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
    )
    .slice(0, 12);
}

export async function getTrendingBubbles(): Promise<any[]> {
  const { data, error } = await supabase
    .from('bubbles')
    .select('*, bubble_member_detail(username)')
    .or(futureBubblesFilter())
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) throw new Error(error.message);
  return (data ?? [])
    .map(mapBubble)
    .sort((a: any, b: any) => b.members.length - a.members.length)
    .slice(0, 6);
}

export async function getPopularEvents(): Promise<any[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*, event_attendees(count)')
    .or(futureEventsFilter())
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) throw new Error(error.message);
  if (!data?.length) return [];

  return data
    .map((e: any) => ({ ...mapEvent(e), attendeeCount: e.event_attendees?.[0]?.count ?? 0 }))
    .sort((a: any, b: any) => b.attendeeCount - a.attendeeCount)
    .slice(0, 6);
}

// ── Activity Feeds ────────────────────────────────────────────────────────────

export async function getFollowingFeed(username: string): Promise<ActivityItem[]> {
  const { data: follows } = await supabase
    .from('user_follows')
    .select('followee')
    .eq('follower', username);

  const followed = (follows ?? []).map((f: any) => f.followee);
  if (!followed.length) return [];

  const [bubblesRes, eventsRes, attendRes] = await Promise.all([
    supabase
      .from('bubbles')
      .select('*, bubble_member_detail(username)')
      .in('created_by', followed)
      .or(futureBubblesFilter())
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('events')
      .select('*')
      .in('created_by', followed)
      .or(futureEventsFilter())
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('event_attendees')
      .select('username, event_id, created_at, events(*)')
      .in('username', followed)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const items: ActivityItem[] = [
    ...(bubblesRes.data ?? []).map((b: any) => ({
      id: `bc_${b.id}`,
      type: 'bubble_created' as const,
      username: b.created_by,
      createdAt: b.created_at,
      bubble: mapBubble(b),
    })),
    ...(eventsRes.data ?? []).map((e: any) => ({
      id: `ec_${e.id}`,
      type: 'event_created' as const,
      username: e.created_by,
      createdAt: e.created_at,
      event: mapEvent(e),
    })),
    ...(attendRes.data ?? [])
      .filter((a: any) => a.events)
      .map((a: any) => ({
        id: `ea_${a.username}_${a.event_id}`,
        type: 'event_attending' as const,
        username: a.username,
        createdAt: a.created_at,
        event: mapEvent(a.events),
      })),
  ];

  return items
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 30);
}

export async function getSuggestedFeed(username: string): Promise<ActivityItem[]> {
  // Get users who share bubbles with you but you don't follow yet
  const [membershipsRes, followsRes] = await Promise.all([
    supabase.from('bubble_member_detail').select('bubble_id').eq('username', username),
    supabase.from('user_follows').select('followee').eq('follower', username),
  ]);

  const bubbleIds = (membershipsRes.data ?? []).map((m: any) => m.bubble_id);
  const followedSet = new Set((followsRes.data ?? []).map((f: any) => f.followee));

  if (!bubbleIds.length) return [];

  const { data: coMembers } = await supabase
    .from('bubble_member_detail')
    .select('username')
    .in('bubble_id', bubbleIds)
    .neq('username', username);

  const suggested = [...new Set((coMembers ?? []).map((m: any) => m.username))]
    .filter((u) => !followedSet.has(u))
    .slice(0, 20);

  if (!suggested.length) return [];

  const [bubblesRes, eventsRes] = await Promise.all([
    supabase
      .from('bubbles')
      .select('*, bubble_member_detail(username)')
      .in('created_by', suggested)
      .or(futureBubblesFilter())
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('events')
      .select('*')
      .in('created_by', suggested)
      .or(futureEventsFilter())
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  const items: ActivityItem[] = [
    ...(bubblesRes.data ?? []).map((b: any) => ({
      id: `sbc_${b.id}`,
      type: 'bubble_created' as const,
      username: b.created_by,
      createdAt: b.created_at,
      bubble: mapBubble(b),
    })),
    ...(eventsRes.data ?? []).map((e: any) => ({
      id: `sec_${e.id}`,
      type: 'event_created' as const,
      username: e.created_by,
      createdAt: e.created_at,
      event: mapEvent(e),
    })),
  ];

  return items
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 30);
}

export async function getDiscoverFeed(excludeUsername?: string): Promise<ActivityItem[]> {
  const [bubblesRes, eventsRes] = await Promise.all([
    supabase
      .from('bubbles')
      .select('*, bubble_member_detail(username)')
      .or(futureBubblesFilter())
      .order('created_at', { ascending: false })
      .limit(25),
    supabase
      .from('events')
      .select('*')
      .or(futureEventsFilter())
      .order('created_at', { ascending: false })
      .limit(25),
  ]);

  const items: ActivityItem[] = [
    ...(bubblesRes.data ?? [])
      .filter((b: any) => b.created_by !== excludeUsername)
      .map((b: any) => ({
        id: `dbc_${b.id}`,
        type: 'bubble_created' as const,
        username: b.created_by,
        createdAt: b.created_at,
        bubble: mapBubble(b),
      })),
    ...(eventsRes.data ?? [])
      .filter((e: any) => e.created_by !== excludeUsername)
      .map((e: any) => ({
        id: `dec_${e.id}`,
        type: 'event_created' as const,
        username: e.created_by,
        createdAt: e.created_at,
        event: mapEvent(e),
      })),
  ];

  return items
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 30);
}

// ── Moderation ────────────────────────────────────────────────────────────────

export async function reportUser(
  reporter: string, reported: string, reason: string
): Promise<void> {
  const { error } = await supabase.from('reports').insert({
    reporter_username: reporter, reported_username: reported, type: 'user', reason,
  });
  if (error) throw new Error(error.message);
}

export async function reportMessage(
  reporter: string, messageId: number, bubbleId: number, reason: string
): Promise<void> {
  const { error } = await supabase.from('reports').insert({
    reporter_username: reporter, reported_message_id: messageId,
    bubble_id: bubbleId, type: 'message', reason,
  });
  if (error) throw new Error(error.message);
}

export async function blockUser(blocker: string, blocked: string): Promise<void> {
  await supabase.from('blocked_users').insert({ blocker, blocked });
}

export async function unblockUser(blocker: string, blocked: string): Promise<void> {
  await supabase.from('blocked_users').delete().eq('blocker', blocker).eq('blocked', blocked);
}

export async function getIsBlocked(blocker: string, blocked: string): Promise<boolean> {
  const { data } = await supabase
    .from('blocked_users').select('id')
    .eq('blocker', blocker).eq('blocked', blocked).maybeSingle();
  return !!data;
}

export async function getBlockedUsers(username: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('blocked_users').select('blocked').eq('blocker', username);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.blocked);
}

// ── Event Messages ────────────────────────────────────────────────────────────

export async function getEventMessages(eventId: number) {
  const { data, error } = await supabase
    .from('event_messages').select('*').eq('event_id', eventId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id, username: r.username, message: r.message,
    imageUrl: r.image_url ?? null, createdAt: r.created_at,
  }));
}

export async function sendEventMessage(eventId: number, username: string, message: string, imageUrl?: string) {
  const { error } = await supabase
    .from('event_messages').insert({ event_id: eventId, username, message, image_url: imageUrl ?? null });
  if (error) throw new Error(error.message);
}

// ── Discussions ───────────────────────────────────────────────────────────────

export async function getDiscussions(bubbleId: number) {
  const { data, error } = await supabase
    .from('discussions')
    .select('id, title, body, created_by, created_at, discussion_replies(count)')
    .eq('bubble_id', bubbleId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: any) => ({
    id: r.id, title: r.title, body: r.body,
    createdBy: r.created_by, createdAt: r.created_at,
    replyCount: r.discussion_replies?.[0]?.count ?? 0,
  }));
}

export async function createDiscussion(bubbleId: number, title: string, body: string, createdBy: string) {
  const { error } = await supabase
    .from('discussions').insert({ bubble_id: bubbleId, title, body, created_by: createdBy });
  if (error) throw new Error(error.message);
}

export async function getDiscussionReplies(discussionId: number) {
  const { data, error } = await supabase
    .from('discussion_replies').select('*').eq('discussion_id', discussionId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id, username: r.username, content: r.content, createdAt: r.created_at,
  }));
}

export async function addDiscussionReply(discussionId: number, username: string, content: string) {
  const { error } = await supabase
    .from('discussion_replies').insert({ discussion_id: discussionId, username, content });
  if (error) throw new Error(error.message);
}

// ── Stories ───────────────────────────────────────────────────────────────────

export type Story = {
  id: number;
  username: string;
  imageUrl: string;
  caption: string | null;
  createdAt: string;
  expiresAt: string;
};

export type StoryGroup = {
  username: string;
  stories: Story[];
};

// Active (unexpired) stories grouped per user; the viewer's own group first,
// then most recently updated. Blocked users are filtered out.
export async function getActiveStories(viewer: string): Promise<StoryGroup[]> {
  const [storiesRes, blocked] = await Promise.all([
    supabase
      .from('stories')
      .select('*')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true }),
    getBlockedUsers(viewer).catch(() => [] as string[]),
  ]);

  if (storiesRes.error) throw new Error(storiesRes.error.message);
  const blockedSet = new Set(blocked);

  const groups = new Map<string, Story[]>();
  for (const r of storiesRes.data ?? []) {
    if (blockedSet.has(r.username)) continue;
    const story: Story = {
      id: r.id, username: r.username, imageUrl: r.image_url,
      caption: r.caption ?? null, createdAt: r.created_at, expiresAt: r.expires_at,
    };
    const arr = groups.get(r.username);
    if (arr) arr.push(story);
    else groups.set(r.username, [story]);
  }

  return Array.from(groups.entries())
    .map(([username, stories]) => ({ username, stories }))
    .sort((a, b) => {
      if (a.username === viewer) return -1;
      if (b.username === viewer) return 1;
      const aLast = a.stories[a.stories.length - 1].createdAt;
      const bLast = b.stories[b.stories.length - 1].createdAt;
      return new Date(bLast).getTime() - new Date(aLast).getTime();
    });
}

export async function postStory(username: string, localUri: string, caption?: string): Promise<void> {
  const uid = await requireUserId();
  const imageUrl = await uploadImage(localUri, 'stories', `${uid}/${Date.now()}.jpg`, { width: 1080 }, false);
  const { error } = await supabase
    .from('stories')
    .insert({ username, image_url: imageUrl, caption: caption?.trim() || null });
  if (error) throw new Error(error.message);
}

export async function deleteStory(id: number): Promise<void> {
  // Grab the file path before deleting the row, otherwise the image lingers in
  // Storage (and keeps costing) with nothing pointing at it.
  const { data: story } = await supabase
    .from('stories').select('image_url').eq('id', id).maybeSingle();

  const { error } = await supabase.from('stories').delete().eq('id', id);
  if (error) throw new Error(error.message);

  const path = storagePathFromPublicUrl(story?.image_url, 'stories');
  if (path) await supabase.storage.from('stories').remove([path]);
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapEvent(r: any) {
  return {
    id: r.id, title: r.title, location: r.location, time: r.time,
    createdBy: r.created_by, latitude: r.lat, longitude: r.lng,
    createdAt: r.created_at, type: r.type ?? null,
    eventDate: r.event_date ?? null,
    coverUrl: r.cover_url ?? null,
  };
}

function futureEventsFilter() {
  return `event_date.is.null,event_date.gt.${new Date().toISOString()}`;
}

function mapBubble(r: any) {
  return {
    id: r.id, name: r.name, description: r.description,
    createdBy: r.created_by, type: r.type, meetTime: r.meet_time,
    maxMembers: r.max_members, latitude: r.lat, longitude: r.lng,
    isSecret: r.is_secret, revealAt: r.reveal_at, createdAt: r.created_at,
    endsAt: r.ends_at ?? null,
    members: (r.bubble_member_detail ?? []).map((m: any) => m.username),
  };
}

function futureBubblesFilter() {
  const now = new Date().toISOString();
  return `ends_at.is.null,ends_at.gt.${now}`;
}

function mapPage(r: any) {
  if (!r) return null;
  return {
    id: r.id, name: r.name, description: r.description,
    category: r.category, createdBy: r.created_by,
    avatarColor: r.avatar_color, createdAt: r.created_at,
  };
}

// ── Push Notifications ────────────────────────────────────────────────────────

export function sendPushNotification(
  recipientUsername: string,
  type: string,
  title: string,
  body: string,
  data?: Record<string, any>,
): void {
  supabase.functions.invoke('send-notification', {
    body: { recipient_username: recipientUsername, type, title, body, data },
  }).catch(() => {});
}

// ── Notifications ─────────────────────────────────────────────────────────────

export async function getNotifications(username: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('recipient_username', username)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []).map((n) => ({
    id: n.id, type: n.type, title: n.title, body: n.body,
    data: n.data, read: n.read, createdAt: n.created_at,
  }));
}

export async function markNotificationRead(id: number): Promise<void> {
  await supabase.from('notifications').update({ read: true }).eq('id', id);
}

export async function markAllNotificationsRead(username: string): Promise<void> {
  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('recipient_username', username)
    .eq('read', false);
}

export async function getUnreadNotificationCount(username: string): Promise<number> {
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_username', username)
    .eq('read', false);
  return count ?? 0;
}

// ── Search ────────────────────────────────────────────────────────────────────

// Strip characters that break PostgREST .or() filter string parsing.
// % and _ are ILIKE wildcards; , . ( ) are PostgREST syntax characters.
function sanitizeSearchQuery(q: string): string {
  return q.replace(/[%_,().]/g, '').trim();
}

export async function searchUsers(query: string, _viewer?: string): Promise<any[]> {
  const safe = sanitizeSearchQuery(query);
  if (!safe) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('username, bio, avatar_color, profile_emoji, avatar_url')
    .ilike('username', `%${safe}%`)
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []).map((u) => ({
    username: u.username,
    bio: u.bio ?? '',
    avatarColor: u.avatar_color ?? '#7c3aed',
    profileEmoji: u.profile_emoji ?? '',
    avatarUrl: u.avatar_url ?? null,
  }));
}

export async function searchEvents(query: string): Promise<any[]> {
  const safe = sanitizeSearchQuery(query);
  if (!safe) return [];
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .or(`title.ilike.%${safe}%,location.ilike.%${safe}%`)
    .or(futureEventsFilter())
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapEvent);
}

export async function searchBubbles(query: string): Promise<any[]> {
  const safe = sanitizeSearchQuery(query);
  if (!safe) return [];
  const { data, error } = await supabase
    .from('bubbles')
    .select('*, bubble_member_detail(username)')
    .or(`name.ilike.%${safe}%,description.ilike.%${safe}%`)
    .or(futureBubblesFilter())
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapBubble);
}

// ── Invites ───────────────────────────────────────────────────────────────────

export async function sendInvite(
  inviterUsername: string,
  inviteeUsername: string,
  bubbleId?: number,
  eventId?: number,
): Promise<void> {
  const { error } = await supabase.from('invites').insert({
    inviter_username: inviterUsername,
    invitee_username: inviteeUsername,
    bubble_id: bubbleId ?? null,
    event_id:  eventId  ?? null,
  });
  if (error) throw new Error(error.message);

  // Build notification content
  let title = `${inviterUsername} invited you!`;
  let body  = 'You have a new invite.';
  let data: Record<string, any> = {};

  if (bubbleId) {
    const { data: bubble } = await supabase
      .from('bubbles').select('name').eq('id', bubbleId).single();
    if (bubble) { title = `${inviterUsername} invited you to a bubble!`; body = `Join "${bubble.name}"`; data = { bubbleId }; }
  } else if (eventId) {
    const { data: event } = await supabase
      .from('events').select('title').eq('id', eventId).single();
    if (event) { title = `${inviterUsername} invited you to an event!`; body = `Join "${event.title}"`; data = { eventId }; }
  }

  sendPushNotification(inviteeUsername, 'invite', title, body, data);
}

export async function getMyInvites(username: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('invites')
    .select('*, bubbles(name), events(title)')
    .eq('invitee_username', username)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    inviterUsername: r.inviter_username,
    inviteeUsername: r.invitee_username,
    bubbleId:   r.bubble_id,
    eventId:    r.event_id,
    bubbleName: r.bubbles?.name  ?? null,
    eventTitle: r.events?.title  ?? null,
    status:     r.status,
    createdAt:  r.created_at,
  }));
}

export async function respondToInvite(id: number, status: 'accepted' | 'declined'): Promise<void> {
  const { error } = await supabase.from('invites').update({ status }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function getUnreadInviteCount(username: string): Promise<number> {
  const { count } = await supabase
    .from('invites')
    .select('*', { count: 'exact', head: true })
    .eq('invitee_username', username)
    .eq('status', 'pending');
  return count ?? 0;
}

// ── Direct Messages ───────────────────────────────────────────────────────────

export type DmConversation = {
  partner: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
};

export type DmMessage = {
  id: number;
  senderUsername: string;
  recipientUsername: string;
  content: string;
  read: boolean;
  createdAt: string;
};

export async function getDMConversations(myUsername: string): Promise<DmConversation[]> {
  const { data, error } = await supabase
    .from('direct_messages')
    .select('*')
    .or(`sender_username.eq.${myUsername},recipient_username.eq.${myUsername}`)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  const convMap = new Map<string, DmConversation>();
  for (const row of data ?? []) {
    const partner = row.sender_username === myUsername ? row.recipient_username : row.sender_username;
    if (!convMap.has(partner)) {
      convMap.set(partner, {
        partner,
        lastMessage: row.content,
        lastMessageAt: row.created_at,
        unreadCount: (!row.read && row.recipient_username === myUsername) ? 1 : 0,
      });
    } else if (!row.read && row.recipient_username === myUsername) {
      convMap.get(partner)!.unreadCount++;
    }
  }

  return Array.from(convMap.values());
}

export async function getDMMessages(myUsername: string, partner: string): Promise<DmMessage[]> {
  const { data, error } = await supabase
    .from('direct_messages')
    .select('*')
    .or(
      `and(sender_username.eq.${myUsername},recipient_username.eq.${partner}),` +
      `and(sender_username.eq.${partner},recipient_username.eq.${myUsername})`
    )
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    id: r.id,
    senderUsername: r.sender_username,
    recipientUsername: r.recipient_username,
    content: r.content,
    read: r.read,
    createdAt: r.created_at,
  }));
}

export async function sendDM(senderUsername: string, recipientUsername: string, content: string): Promise<DmMessage> {
  const { data, error } = await supabase
    .from('direct_messages')
    .insert({ sender_username: senderUsername, recipient_username: recipientUsername, content })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return {
    id: data.id,
    senderUsername: data.sender_username,
    recipientUsername: data.recipient_username,
    content: data.content,
    read: data.read,
    createdAt: data.created_at,
  };
}

export async function markDMsRead(myUsername: string, partnerUsername: string): Promise<void> {
  await supabase
    .from('direct_messages')
    .update({ read: true })
    .eq('recipient_username', myUsername)
    .eq('sender_username', partnerUsername)
    .eq('read', false);
}

export async function getUnreadDMCount(myUsername: string): Promise<number> {
  const { count } = await supabase
    .from('direct_messages')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_username', myUsername)
    .eq('read', false);
  return count ?? 0;
}
