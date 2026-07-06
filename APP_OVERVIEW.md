# Hangout — App Overview

> A social location app for real-world meetups. Think Life360 meets spontaneous hangout planning — users create Bubbles and Events, find people nearby, and connect in real time.

**Stack:** React Native + Expo SDK 54 · Supabase (Postgres + Auth + Realtime) · EAS Build  
**Repo:** github.com/Kevyn04/HangoutProject  
**Frontend path:** `HangoutFront/`

---

## Table of Contents
1. [What the App Does](#what-the-app-does)
2. [Current Features](#current-features)
3. [Missing / Not Yet Built](#missing--not-yet-built)
4. [Ideas to Elevate the App](#ideas-to-elevate-the-app)

---

## What the App Does

Hangout lets you spontaneously organize or discover real-world meetups with people around you. You can drop a **Bubble** (an informal, location-based hangout) or create an **Event** (a more structured gathering with a time and place). Friends, followers, and nearby users can join in, chat, and see each other on a map in real time.

Core loop:
1. Open the app → see what's happening around you on the **Discover** feed or **Map**
2. Join a Bubble or RSVP to an Event
3. Chat with attendees, share your location, and show up

---

## Current Features

### Authentication
- Username + password sign-up and sign-in (synthetic email pattern)
- Apple Sign-In (`signInWithIdToken`) — fully configured with Supabase provider
- Google OAuth (`signInWithOAuth` + `openAuthSessionAsync`)
- `choose-username.tsx` screen for OAuth users who don't have a username yet
- Session persistence via Supabase built-in storage
- Fixed: `createProfile` uses `upsert` to handle repeat OAuth sign-ins without duplicate key error

### Discover / Home Feed (`index.tsx`)
- Three-tab feed: **Following**, **People You May Know**, **Discover**
- `ActivityCard` for bubbles and events
- `PersonCard` for suggested users with a Follow button
- Error banner with retry on load failure
- **Search icon** in header → opens global search screen
- **Bell icon** in header → opens notifications inbox with live unread badge

### Search (`search.tsx`)
- Global search across Users, Events, and Bubbles
- Three tabs with result counts
- Debounced 350ms input, autofocus
- Tap results to navigate directly to profile / event / bubble
- Error state shown on network failure (previously swallowed silently)

### Notifications Inbox (`notifications.tsx`)
- Lists all notifications (bubble joins, event joins, invites, messages)
- Type icons with unread dot indicator
- Tap to navigate to the relevant content
- Mark all as read button
- **Inline invite Accept / Decline** — accepting auto-joins the bubble or event
- Error state + retry on load failure

### Events
- Create events with title, location, time, type, and map pin
- Event types: Hangout, Munchies, Secret Location, Sports, Games
- Join / Leave RSVP — **now trusts DB as source of truth** (AsyncStorage removed)
- Attendee count + expandable attendee list modal
- "Remind Me 1 Hr Before" — **server-side reminder** stored in `event_reminders`, delivered by the `send-event-reminders` Edge Function (pg_cron, every minute) even if the app is killed; persists across visits, tap again to cancel; legacy events without `event_date` fall back to a local notification
- **Event Chat** — real-time chat for attendees (`event-chat.tsx`) via Supabase Realtime
- Edit and delete own events
- Red markers on map
- **Auto-conclude** — `event_date timestamptz` stored alongside human-readable `time`; past events are filtered from all discovery feeds, map, search, and pages automatically; event details shows "This event has ended" banner and disables join/remind once the time passes

### Bubbles
- Create a Bubble with name, description, type, optional secret location + reveal timer
- **Auto-end duration picker** — No limit / 1hr / 2hr / 4hr / 8hr / 24hr; stores `ends_at timestamptz`; concluded bubbles disappear from all feeds and search automatically
- Join / Leave, End Hangout (host only)
- Purple markers on map (removed from map view — events only shown now)
- Max member cap
- **Invite User button** in header → opens invite screen to search + invite a friend directly

### Bubble Detail (`bubble-detail.tsx`)
- **Members tab** — live distance + ETA, per-member location sharing toggle
- **Chat tab** — Supabase Realtime instant messaging (replaced 3s polling)
- **Discussion Mode** — activates automatically when 10+ members, replaces chat tab (`discussion-detail.tsx`)
- Long-press any message → Report Message modal with reason selection
- Blocked users are filtered from members list and chat
- **Bubble existence** — Realtime DELETE subscription replaces 5s poll
- **Member joins/leaves** — Realtime INSERT/DELETE replaces 8s poll
- Location coordinates refresh every 20s (down from 8s)
- Typing indicator poll removed (was a no-op)
- **Auto-conclude** — shows "This bubble has ended" yellow banner when `ends_at` has passed; chat replaced with read-only notice

### Group Invites (`invite-user.tsx`)
- Search for any user by username
- Send bubble or event invites directly
- "Invited ✓" state after sending — prevents double-inviting
- Invitee gets a push notification immediately
- Invites appear in the notifications inbox with Accept / Decline

### Map (`map.tsx`)
- Real MapView with event markers only (bubbles removed for clarity)
- Swipeable bottom sheet for nearby items
- Tap markers to view event/bubble details

### Pages (`pages.tsx` / `page-detail.tsx`)
- Create a Page (like a community or brand profile)
- Discover pages with category filters
- Follow / Unfollow pages
- Page detail: **Events** tab + **Bubbles** tab (populated via `getPageContent`)

### Profile (`profile.tsx`)
- **Profile photo upload** — tap avatar to pick from camera roll; photo stored in Supabase Storage (`avatars` bucket); falls back to color+initial if no photo set
- Avatar color picker — presets + custom color wheel (`ColorWheelPicker`)
- Profile emoji picker (Bubble Pop style)
- Editable bio
- Stats: followers, following, ratings
- Ratings breakdown (anonymous user rating system)
- Lists of created and joined bubbles

### User Profiles (`user-profile.tsx`)
- Shows profile photo if set, falls back to color+initial
- View another user's stats, bubbles, events
- Follow / Unfollow
- **Message button** — opens DM chat directly with that user
- Anonymous rating with reason
- **Block / Unblock** with confirmation dialog
- **Report user** modal — reasons: Spam, Harassment, Inappropriate Behavior, Fake Profile, Other

### Direct Messages (`dms.tsx`, `dm-chat.tsx`)
- **DM inbox** (`/dms`) — conversation list with last message preview, timestamp, and unread count badge
- **DM chat** (`/dm-chat`) — 1-on-1 private chat with Realtime updates; auto-marks messages read on open
- Chat icon in Discover header turns red with unread badge when new DMs arrive
- RLS — users can only read/send messages involving themselves; sender spoofing blocked at DB level
- Messages capped at 1,000 characters

### Moderation
- `reports` table — stores all user and message reports
- `blocked_users` table — blocked users hidden from bubble members and chat
- Admin reviews reports in Supabase dashboard

### Push Notifications
- Expo push token saved to `profiles.push_token`
- **`send-notification` Edge Function deployed** — sends via Expo Push API + writes to `notifications` table
- Fires when someone joins your bubble (`bubble_join`)
- Fires when someone RSVPs to your event (`event_join`)
- Fires when you receive an invite (`invite`)
- Apple Developer account active (purchased + activated 2026-05-28)
- EAS credentials configured — Distribution Certificate + Provisioning Profile valid until May 2027
- iPhone + iPad registered as provisioned devices

### Database — Tables
| Table | Purpose |
|---|---|
| `profiles` | User profiles, push tokens, `avatar_url` for photo storage |
| `bubbles` | Bubble records |
| `bubble_member_detail` | Members, location, channel |
| `chat_messages` | Bubble chat (Realtime) |
| `events` | Event records — `event_date timestamptz` for auto-expiry filtering |
| `event_attendees` | RSVP list |
| `event_messages` | Event chat (Realtime) |
| `pages` | Community/brand pages |
| `page_followers` | Page follow relationships |
| `user_follows` | User follow relationships |
| `user_ratings` | Anonymous ratings |
| `reports` | User + message reports |
| `blocked_users` | Block relationships |
| `notifications` | In-app notification inbox |
| `invites` | Bubble/event invites |
| `discussions` | Bubble discussion threads |
| `discussion_replies` | Replies to discussions |
| `direct_messages` | 1-on-1 DMs between users (Realtime, RLS, read receipts) |
| `event_reminders` | Server-side "Remind Me" rows — scanned every minute by `send-event-reminders` cron |

### Database — Indexes
All performance indexes applied:
- `chat_messages(bubble_id, channel_id, created_at desc)` — critical, fastest-growing table
- `bubble_member_detail(username)`
- `user_follows(followee)`
- `user_ratings(rated_username)`
- `events(created_by)`
- `bubbles(created_by)`
- `event_attendees(username)`
- `notifications(recipient_username, created_at desc)`
- `invites(invitee_username, created_at desc)`
- `direct_messages(sender_username, created_at desc)`
- `direct_messages(recipient_username, created_at desc)`

### Security
All RLS policies audited and tightened:
- `push_token` column revoked from `authenticated` and `anon` roles — only Edge Function (service_role) can read it
- `chat_insert` — now requires `username = my_username()` (was any authenticated user)
- `bmd_insert` — now requires `username = my_username()`
- `attendees_insert` — now requires `username = my_username()`
- `bubbles_insert` — now requires `created_by = my_username()`
- `events_insert` — now requires `created_by = my_username()`
- `pages_insert` — now requires `created_by = my_username()`
- `page_followers_insert` — now requires `username = my_username()`
- `chat_messages` — max 2,000 characters per message constraint
- **`send-notification` Edge Function** — now requires valid Supabase JWT; unauthenticated callers get 401
- **Search filter injection** — user input sanitized before PostgREST `.or()` string interpolation
- **Avatar uploads** — extension whitelist + 5 MB cap client-side; `avatars` bucket enforces same MIME types + size server-side; images re-encoded via `expo-image-manipulator` before upload to strip EXIF and any embedded payloads
- **`UserAvatar` component** — reusable avatar renderer used in profile, user-profile, search, invite screens

### Security — 2026-07-05 adversarial audit (migrations 013 + 014)
Live black-box testing with throwaway attacker/victim accounts found and **fixed** several holes. Root cause of most: repo migrations were never actually applied (created via dashboard), so live RLS had drifted — several tables carried leftover permissive policies under unknown names that OR'd past the intended strict ones.
- **push_token no longer client-readable** — table-level SELECT on `profiles` revoked and re-granted per-column (all columns except `push_token`); previously any logged-in user could read every user's Expo token and push to their device directly. Column-level UPDATE of `push_token` retained so `registerPushToken` still works.
- **Identity-spoofing closed** on `event_attendees`, `event_messages`, `discussions`, `discussion_replies`, `reports`, `blocked_users` — all INSERT policies now require the acting username to equal `my_username()`. Migration 014 drops *all* policies on these tables dynamically then recreates the correct set (defeats the drifted duplicates).
- **`reports` and `blocked_users` no longer world-readable** — SELECT restricted to your own rows (`reporter_username`/`blocker` = `my_username()`); admin review uses the service role, which bypasses RLS.
- **`send-notification` Edge Function rewritten** — no longer trusts client `recipient`/`title`/`body` (was an open phishing/spam channel to any user). It now derives the actor from the JWT, whitelists `type ∈ {bubble_join, event_join, invite}`, verifies the actor's real relationship to the target, generates the message text server-side, and rate-limits to 20 notifications/actor/minute (`notifications.actor_username`).
- **Length caps added** (anti-bloat) — `event_messages` 2000, `discussions` title 200 / body 5000, `discussion_replies` 2000, `profiles.bio` 500, `user_ratings.reason` 500 (chat already capped).
- **Username squatting closed (migration 015)** — `username` is now immutable once set (BEFORE UPDATE trigger `prevent_username_change`); the OAuth NULL→value first-set is still allowed so `choose-username` works.
- **Per-account rate limits (migration 016)** — TestFlight stopgap for open signup. Generic `enforce_rate_limit()` BEFORE INSERT trigger caps: bubbles 10/hr, events 20/hr, DMs 30/min, invites 30/hr, reports 20/hr, follows 60/hr. Generous enough that humans never hit them; makes bot/mass accounts far less useful for spam. Verified: 11th bubble in an hour is rejected.
- **Known residual — open signup:** sign-up still has no CAPTCHA / email-phone verification, so accounts can be created programmatically; the rate limits above blunt the *impact*, which is sufficient for a closed TestFlight beta. Before a public launch, add Cloudflare Turnstile (free) — needs a provider secret + an EAS rebuild (deferred by choice, 2026-07-05).

### Branding & UI
- Custom app icon — white H with location pin on red background (1024x1024)
- Custom splash screen — same icon, red `#dc2626` background
- Animated loading screen — "Loading" text + fluid white wave on red bar (`LoadingScreen.tsx`)
- App name: **Hangout** (renamed from "The Hangout")

### Polish ✅ (2026-06-28)
- **Pull-to-refresh** on all 7 scrollable screens — Discover, My Hangouts, Profile, Pages, Notifications, User Profile, Page Detail
  - Uses `load(silent=true)` pattern: existing content stays visible during refresh (no skeleton flash)
  - Red tint color matches brand on all platforms
- **Error states hardened** — `search.tsx` and `notifications.tsx` previously swallowed errors silently; both now show an offline icon + "Try Again" prompt
- **Skeleton loaders** — consistent across all main screens; all screens use `SkeletonBox` shimmer on first load
- **Onboarding overlay** — shown once on first launch via AsyncStorage (`@hangout/onboarding_done`); 3 swipeable feature slides (Drop a Bubble / Join Events / Find Your Vibe) with scroll-linked animated dots + icon scaling; `components/OnboardingOverlay.tsx`, wired in `_layout.tsx`
- **Privacy consent gate** — mandatory 4th onboarding slide: lists collected data (location, profile, messages) with plain-language explanations, link to hosted Privacy Policy, "Accept & Continue" required to proceed ("Skip" jumps to it, never past it); existing users who onboarded earlier get a consent-only screen on next launch; acceptance timestamp stored in AsyncStorage (`@hangout/privacy_accepted_v1`) and synced to `profiles.privacy_accepted_at` for compliance evidence
- **Empty states** — reusable `EmptyState` component (`components/EmptyState.tsx`) with icon circle + title + subtitle + optional CTA button; replaces all grey italic text on: Discover (3 sections), My Hangouts (bubbles + events), Pages, Profile (created + joined), Notifications, Page Detail (events + bubbles tabs)

### Legal / Store Prep
- Privacy Policy hosted at `docs/privacy.html`
- GitHub Pages URL: `https://kevyn04.github.io/HangoutProject/privacy.html`
- Apple Services ID configured: `com.hangout.thehangout.signin`
- Apple Sign In Key ID: `TFNFJVC526` (expires ~6 months, needs Supabase secret regeneration)

---

## Missing / Not Yet Built

### Core Functionality
- [ ] **Real-time location sharing on map** — distance/ETA in Members tab uses stored coordinates, not true live tracking
- [x] **Server-side event reminders** — `event_reminders` table + `send-event-reminders` Edge Function on a pg_cron every-minute schedule; push fires even if app is killed; tap-to-cancel; state persists ✅
- [x] **Event auto-conclude** — events disappear from feeds/map/search after `event_date` passes; event details shows concluded state ✅
- [x] **Bubble auto-end** — duration picker on create (No limit → 24hr); concluded bubbles filtered from feeds/search; detail shows concluded banner + read-only chat ✅
- [x] **Profile photo uploads** — camera roll picker, Supabase Storage, re-encoded before upload ✅
- [ ] **Event cover images / in-chat media** — no event cover images or media sharing in chat

### Social Layer
- [x] **Direct messages (DMs)** — inbox + real-time 1-on-1 chat; unread badge in Discover header; Message button on profiles ✅
- [ ] **Stories / status** — no ephemeral content layer
- [ ] **Friend/contact suggestions based on location** — "People Nearby" is not location-aware

### Pages / Communities
- [ ] **Page posting** — page owners can't post updates or announcements to followers
- [ ] **Page moderation** — no admin/moderator role for pages
- [ ] **Page analytics** — no follower growth or engagement stats for page owners

### Map
- [ ] **Bubbles on the map** — removed from map view; may need a toggle to show them
- [ ] **Cluster markers** — no clustering when many events are nearby; pins overlap
- [ ] **Map filters** — no way to filter map by event type, distance, or date

### App Store / Production
- [x] Accept Apple Developer agreement
- [x] Run `eas credentials` to link Apple account
- [x] `eas build --platform ios --profile development` — dev build installed on iPhone + iPad
- [ ] Fill out App Privacy nutrition labels in App Store Connect
- [ ] Create app record in App Store Connect
- [ ] `eas build --platform ios --profile production` + `eas submit`
- [ ] TestFlight beta distribution

### Polish
- [x] Onboarding flow — 3-slide overlay on first launch ✅
- [x] Empty states — `EmptyState` component with icon + CTA on all major screens ✅
- [x] Skeleton loaders — consistent `SkeletonBox` shimmer on all main screens ✅
- [x] Pull-to-refresh — all 7 scrollable screens ✅
- [x] Silent error states — search + notifications now surface errors properly ✅
- [ ] Dark mode is hardcoded — no system theme toggle

---

## Ideas to Elevate the App

### Engagement & Retention
- **Vibe Check** — before joining a bubble, show a quick "mood" poll (chill, hype, low-key, etc.) so users self-select into the right energy
- **Streak system** — reward users who hang out consistently (e.g., "Hanging 5 days in a row") with a profile badge
- **Hangout Highlights** — after a bubble ends, the host can post a quick photo recap that lives on the event page for 24 hours
- **"On My Way" status** — one-tap status update that notifies bubble/event members you're en route, with your ETA

### Discovery
- **Heat map layer** — show a density overlay on the map so users can spot where activity is clustering in the city without opening individual pins
- **"Drop In" feature** — ultra-casual one-tap bubble creation (no name, no description — just "I'm here, come hang") for spontaneous moments
- **Trending in your city** — a weekly digest of the most-joined bubbles and events in the user's metro area
- **Interest tags** — users tag themselves (music, food, sports, gaming) and events/bubbles surface to matching users first

### Social Depth
- **Mutual friends indicator** — on user profiles and event attendee lists, show "3 mutuals" so users feel safer joining
- **Invite link** — shareable deep link to a bubble or event that works outside the app (iMessage, Instagram DM, etc.)
- **Crew / Squad feature** — private group of close friends who always see each other's location when they opt in (Life360-style inner circle)
- **Reactions in chat** — emoji react to messages instead of just long-press report

### Monetization (Future)
- **Promoted Events** — businesses or page owners pay to boost an event to the top of Discover in a geographic radius
- **Verified Pages** — blue checkmark for brands/venues, paid tier with analytics and posting tools
- **Hangout Pass** — subscription for power users: unlimited bubble creation, analytics, priority support

### Trust & Safety
- **AI message moderation** — flag toxic messages in real time before they reach the chat (Supabase Edge Function + moderation API)
- **Verified phone number** — optional SMS verification to reduce fake accounts and improve trust signals on profiles
- **Anonymous mode for secret bubbles** — users in a secret location bubble appear as "Anonymous" until the reveal time

### Technical Improvements
- **Offline support** — cache the last-known feed and event list so the app is usable without internet
- **Background location** — opt-in continuous location sharing within a bubble so ETA is always live, not stale
- **Widget** — iOS home screen widget showing your next upcoming event or active bubble count
