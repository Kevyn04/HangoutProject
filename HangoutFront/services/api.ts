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

export async function deleteEvent(id: number): Promise<void> {
  const response: Response = await fetch(`${BASE_URL}/events/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) throw new Error('Failed to delete event');
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