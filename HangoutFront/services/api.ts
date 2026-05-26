import { API_BASE_URL } from "@/constants";
const BASE_URL = API_BASE_URL;

export async function getEvents(): Promise<any> {
  const response: Response = await fetch(`${BASE_URL}/events`);
  if (!response.ok) throw new Error('Failed to fetch events');
  return response.json();
}

export async function createEvent(event: {
  title: string;
  location: string;
  time: string;
  createdBy: string;
  latitude?: number;
  longitude?: number;
}): Promise<any> {
  const response: Response = await fetch(`${BASE_URL}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
  if (!response.ok) throw new Error('Failed to create event');
  return response.json();
}

export async function updateEvent(
  id: number,
  event: { title: string; location: string; time: string; createdBy: string; latitude?: number; longitude?: number }
): Promise<any> {
  const response: Response = await fetch(`${BASE_URL}/events/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
  if (!response.ok) throw new Error('Failed to update event');
  return response.json();
}

export async function deleteEvent(id: number, username: string): Promise<void> {
  const response: Response = await fetch(`${BASE_URL}/events/${id}?username=${encodeURIComponent(username)}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete event');
}

export async function getEventAttendance(id: number, viewer?: string): Promise<{ attendeeCount: number; isAttending: boolean }> {
  const url = viewer
    ? `${BASE_URL}/events/${id}/attendance?viewer=${encodeURIComponent(viewer)}`
    : `${BASE_URL}/events/${id}/attendance`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch attendance');
  return response.json();
}

export async function joinEvent(id: number, username: string): Promise<{ attendeeCount: number; isAttending: boolean }> {
  const response = await fetch(`${BASE_URL}/events/${id}/attend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  if (!response.ok) throw new Error('Failed to join event');
  return response.json();
}

export async function leaveEvent(id: number, username: string): Promise<{ attendeeCount: number; isAttending: boolean }> {
  const response = await fetch(`${BASE_URL}/events/${id}/attend/${encodeURIComponent(username)}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to leave event');
  return response.json();
}

export async function signUp(username: string, password: string): Promise<any> {
  const response: Response = await fetch(`${BASE_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Sign up failed');
  return data;
}

export async function getBubbles(): Promise<any> {
  const response: Response = await fetch(`${BASE_URL}/bubbles`);
  if (!response.ok) throw new Error('Failed to fetch bubbles');
  return response.json();
}

export async function deleteBubble(id: number, username: string): Promise<void> {
  const response: Response = await fetch(`${BASE_URL}/bubbles/${id}?username=${encodeURIComponent(username)}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to delete bubble');
}

export async function leaveBubble(id: number, username: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/bubbles/${id}/members/${encodeURIComponent(username)}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to leave bubble');
}

export async function createBubble(bubble: {
  name: string;
  description?: string;
  createdBy: string;
  type?: string;
  meetTime?: string;
  maxMembers?: number;
  latitude?: number;
  longitude?: number;
  isSecret?: boolean;
  revealAt?: string;
}): Promise<any> {
  const response: Response = await fetch(`${BASE_URL}/bubbles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bubble),
  });
  if (!response.ok) throw new Error('Failed to create bubble');
  return response.json();
}

export async function joinBubble(id: number, username: string): Promise<any> {
  const response: Response = await fetch(`${BASE_URL}/bubbles/${id}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  if (!response.ok) throw new Error('Failed to join bubble');
  return response.json();
}

export async function getBubbleMembers(id: number): Promise<any[]> {
  const response: Response = await fetch(`${BASE_URL}/bubbles/${id}/members`);
  if (!response.ok) throw new Error('Failed to fetch members');
  return response.json();
}

export async function updateMemberLocation(
  id: number,
  username: string,
  shareLocation: boolean,
  latitude?: number,
  longitude?: number,
): Promise<any> {
  const response: Response = await fetch(`${BASE_URL}/bubbles/${id}/location`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, shareLocation, latitude, longitude }),
  });
  if (!response.ok) throw new Error('Failed to update location');
  return response.json();
}

export async function notifyTyping(id: number, username: string): Promise<void> {
  await fetch(`${BASE_URL}/bubbles/${id}/typing`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  }).catch(() => {});
}

export async function getTypingUsers(id: number): Promise<string[]> {
  try {
    const response = await fetch(`${BASE_URL}/bubbles/${id}/typing`);
    if (!response.ok) return [];
    return response.json();
  } catch { return []; }
}

export async function getBubbleChannels(id: number): Promise<number[]> {
  const response: Response = await fetch(`${BASE_URL}/bubbles/${id}/channels`);
  if (!response.ok) throw new Error('Failed to fetch channels');
  return response.json();
}

export async function switchChannel(id: number, username: string, channelId: number): Promise<any> {
  const response: Response = await fetch(`${BASE_URL}/bubbles/${id}/channel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, channelId }),
  });
  if (!response.ok) throw new Error('Failed to switch channel');
  return response.json();
}

export async function getMessages(id: number, channel: number): Promise<any[]> {
  const response: Response = await fetch(`${BASE_URL}/bubbles/${id}/messages?channel=${channel}`);
  if (!response.ok) throw new Error('Failed to fetch messages');
  return response.json();
}

export async function sendMessage(
  id: number, channelId: number, username: string, message: string,
): Promise<any> {
  const response: Response = await fetch(`${BASE_URL}/bubbles/${id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channelId, username, message }),
  });
  if (!response.ok) throw new Error('Failed to send message');
  return response.json();
}

export async function signIn(username: string, password: string): Promise<any> {
  const response: Response = await fetch(`${BASE_URL}/auth/signin`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Sign in failed');
  return data;
}

export async function registerPushToken(username: string, token: string): Promise<void> {
  await fetch(`${BASE_URL}/auth/push-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, token }),
  });
}

// ── Pages ──────────────────────────────────────────────────────────────────

export async function getPages(username?: string): Promise<any[]> {
  const url = username ? `${BASE_URL}/pages?username=${encodeURIComponent(username)}` : `${BASE_URL}/pages`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch pages');
  return response.json();
}

export async function createPage(data: {
  name: string; description?: string; category?: string;
  createdBy: string; avatarColor?: string;
}): Promise<any> {
  const response = await fetch(`${BASE_URL}/pages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create page');
  return response.json();
}

export async function getPage(id: number, username?: string): Promise<any> {
  const url = username
    ? `${BASE_URL}/pages/${id}?username=${encodeURIComponent(username)}`
    : `${BASE_URL}/pages/${id}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch page');
  return response.json();
}

export async function toggleFollow(pageId: number, username: string): Promise<any> {
  const response = await fetch(`${BASE_URL}/pages/${pageId}/follow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  if (!response.ok) throw new Error('Failed to toggle follow');
  return response.json();
}

export async function getPageContent(pageId: number): Promise<any> {
  const response = await fetch(`${BASE_URL}/pages/${pageId}/content`);
  if (!response.ok) throw new Error('Failed to fetch page content');
  return response.json();
}

export async function getFollowingPages(username: string): Promise<any[]> {
  const response = await fetch(`${BASE_URL}/pages/following?username=${encodeURIComponent(username)}`);
  if (!response.ok) throw new Error('Failed to fetch following pages');
  return response.json();
}

// ── Profile ────────────────────────────────────────────────────────────────

export async function getProfile(username: string, viewer?: string): Promise<any> {
  const url = viewer
    ? `${BASE_URL}/users/${username}?viewer=${encodeURIComponent(viewer)}`
    : `${BASE_URL}/users/${username}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Failed to fetch profile');
  return response.json();
}

export async function updateProfile(username: string, data: { bio?: string; avatarColor?: string; profileEmoji?: string }): Promise<any> {
  const response = await fetch(`${BASE_URL}/users/${username}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, username }),
  });
  if (!response.ok) throw new Error('Failed to update profile');
  return response.json();
}

export async function getUserBubbles(username: string): Promise<{ created: any[]; joined: any[] }> {
  const response = await fetch(`${BASE_URL}/users/${username}/bubbles`);
  if (!response.ok) throw new Error('Failed to fetch user bubbles');
  return response.json();
}

export async function toggleUserFollow(username: string, follower: string): Promise<any> {
  const response = await fetch(`${BASE_URL}/users/${username}/follow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ follower }),
  });
  if (!response.ok) throw new Error('Failed to toggle follow');
  return response.json();
}

export async function canRateUser(username: string, raterUsername: string): Promise<any> {
  const response = await fetch(
    `${BASE_URL}/users/${username}/can-rate?raterUsername=${encodeURIComponent(raterUsername)}`
  );
  if (!response.ok) throw new Error('Failed to check rating eligibility');
  return response.json();
}

export async function submitRating(username: string, data: {
  raterUsername: string; rating: number; reason: string;
}): Promise<any> {
  const response = await fetch(`${BASE_URL}/users/${username}/rate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to submit rating');
  return response.json();
}

export async function getUserRatings(username: string): Promise<any> {
  const response = await fetch(`${BASE_URL}/users/${username}/ratings`);
  if (!response.ok) throw new Error('Failed to fetch ratings');
  return response.json();
}