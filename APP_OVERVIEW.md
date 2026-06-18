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

### Events
- Create events with title, location, time, type, and map pin
- Event types: Hangout, Munchies, Secret Location, Sports, Games
- Join / Leave RSVP with persistence via AsyncStorage (source of truth)
- Attendee count + expandable attendee list modal
- "Remind Me 1 Hr Before" local push notification
- **Event Chat** — real-time chat for attendees (`event-chat.tsx`) via Supabase Realtime
- Edit and delete own events
- Red markers on map

### Bubbles
- Create a Bubble with name, description, type, optional secret location + reveal timer
- Join / Leave, End Hangout (host only)
- Purple markers on map (removed from map view — events only shown now)
- Max member cap

### Bubble Detail (`bubble-detail.tsx`)
- **Members tab** — live distance + ETA, per-member location sharing toggle
- **Chat tab** — Supabase Realtime instant messaging (replaced 3s polling)
- **Discussion Mode** — activates automatically when 10+ members, replaces chat tab (`discussion-detail.tsx`)
- Long-press any message → Report Message modal with reason selection
- Blocked users are filtered from members list and chat

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
- Avatar color picker — presets + custom color wheel (`ColorWheelPicker`)
- Profile emoji picker (Bubble Pop style)
- Editable bio
- Stats: followers, following, ratings
- Ratings breakdown (anonymous user rating system)
- Lists of created and joined bubbles

### User Profiles (`user-profile.tsx`)
- View another user's stats, bubbles, events
- Follow / Unfollow
- Anonymous rating with reason
- **Block / Unblock** with confirmation dialog
- **Report user** modal — reasons: Spam, Harassment, Inappropriate Behavior, Fake Profile, Other

### Moderation
- `reports` table — stores all user and message reports
- `blocked_users` table — blocked users hidden from bubble members and chat
- Admin reviews reports in Supabase dashboard

### Push Notifications
- Expo push token saved to `profiles.push_token`
- Apple Developer account active (purchased + activated 2026-05-28)
- EAS credentials configured — Distribution Certificate + Provisioning Profile valid until May 2027
- iPhone + iPad registered as provisioned devices

### Branding & UI
- Custom app icon — white H with location pin on red background (1024x1024)
- Custom splash screen — same icon, red `#dc2626` background
- Animated loading screen — "Loading" text + fluid white wave on red bar (`LoadingScreen.tsx`)
- App name: **Hangout** (renamed from "The Hangout")

### Legal / Store Prep
- Privacy Policy hosted at `docs/privacy.html`
- GitHub Pages URL: `https://kevyn04.github.io/HangoutProject/privacy.html`
- Apple Services ID configured: `com.hangout.thehangout.signin`
- Apple Sign In Key ID: `TFNFJVC526` (expires ~6 months, needs Supabase secret regeneration)

---

## Missing / Not Yet Built

### Core Functionality
- [ ] **Real-time location sharing on map** — users in the same bubble can't see each other's live pins on the map yet; the distance/ETA in the Members tab uses stored coordinates, not true live tracking
- [ ] **Push notifications delivery** — token saving is wired up but actual notification sending (new message, someone joined your bubble, event reminder server-side) is not implemented; Expo Push API calls need to be made from a Supabase Edge Function
- [ ] **Server-side event reminders** — current "Remind Me" uses local notifications only; if the app is killed it may not fire
- [ ] **Bubble expiry / auto-end** — bubbles don't auto-close after a set time; only the host can end manually
- [ ] **Image uploads** — no profile photos, event cover images, or in-chat media sharing
- [ ] **Search** — no global search for users, events, or bubbles by keyword
- [ ] **Notifications inbox** — no in-app notification center; users have no way to see past alerts

### Social Layer
- [ ] **Direct messages (DMs)** — no 1-on-1 private messaging between users
- [ ] **Stories / status** — no ephemeral content layer
- [ ] **Group invites** — no way to explicitly invite a friend to a bubble or event; currently discovery-only
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
- [ ] Onboarding flow — new users land on the Discover tab with no guidance
- [ ] Empty states — many screens have no empty-state illustration or helpful prompt
- [ ] Skeleton loaders are partially implemented; not consistent across all screens
- [ ] Dark mode is hardcoded — no system theme toggle
- [ ] Splash screen background color update (`#dc2626`) pending next rebuild

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
