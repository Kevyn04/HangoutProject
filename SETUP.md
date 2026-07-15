# Hangout — Dev Machine Setup

How to set up this project on a new machine (e.g. a second laptop). The catch:
a few files you rely on are **gitignored on purpose**, so a plain `git clone`
isn't enough — you also have to recreate them (Part C).

The app lives in `HangoutFront/`. The `HangoutBack/` Spring backend is legacy —
the app is fully on Supabase now, so you don't need Java/Maven.

---

## A. Install tools

1. **Git** — https://git-scm.com (Windows) or `brew install git` (Mac)
2. **Node.js LTS** (v20+) — https://nodejs.org (gives you `npm` + `npx`)
3. **Supabase CLI** — `npm install -g supabase` (or `brew install supabase/tap/supabase`)

EAS/Expo need no global install — use `npx expo` and `npx eas-cli`.

## B. Clone + install

```bash
git clone https://github.com/Kevyn04/HangoutProject.git
cd HangoutProject/HangoutFront
npm install
```

Work inside `HangoutFront/`. The **root** `package.json` is gitignored on
purpose (a bare `package.json` ignore entry once broke EAS build archives) —
its absence after cloning is expected and fine.

## C. Recreate the gitignored files (important)

**1. `HangoutFront/.env`** — not committed. Create it with three values, which
you can copy straight from the `base` profile in `HangoutFront/eas.json`
(already in the repo):

```
EXPO_PUBLIC_SUPABASE_URL=...        # from eas.json base
EXPO_PUBLIC_SUPABASE_ANON_KEY=...   # from eas.json base
EXPO_PUBLIC_TURNSTILE_SITE_KEY=...  # from eas.json base
```

These are public-by-design keys (anon key + Turnstile *site* key), so copying
them is safe. The Turnstile line may be left empty to disable the captcha, but
Supabase-side enforcement must match.

**2. `APP_OVERVIEW.md`** — a **local-only** planning note, deliberately kept out
of git. `git clone` will NOT bring it. Copy it over manually (USB / private
cloud folder / email) if you want it on this machine. Edits to it never sync
through git.

## D. Log the CLIs into your accounts (per-machine)

Logins don't carry over between machines:

```bash
supabase login
supabase link --project-ref zkdrmmpjhdsoeshpcxqi
npx eas-cli login
```

For **git push/pull**, authenticate once: install GitHub CLI
(https://cli.github.com) and run `gh auth login`, or let Git's credential
manager prompt you (use a Personal Access Token as the password).

## E. Run the app

1. Put this machine on the **same Wi-Fi** as your iPhone/iPad.
2. Your devices already have a **dev build installed** — you do NOT need to
   rebuild. Just start the bundler:
   ```bash
   npx expo start --dev-client
   ```
3. Open the **Hangout dev-client app** on the phone; it connects to this
   machine's Metro server and loads the JS.

> A dev client (not plain Expo Go) is required because of the Turnstile WebView
> and other native modules. You only need a fresh `eas build` if you change
> native config or add a native dependency — plain JS changes just reload.

> `constants.ts` has a hardcoded `API_BASE_URL` IP pointing at the old Spring
> backend. It's almost certainly dead code on Supabase — ignore it unless
> something errors referencing `API_BASE_URL`.

## F. Keep two machines in sync

- **Before working:** `git pull` (do this first — it avoids most conflicts)
- **When done:** `git add -A && git commit && git push`
- **Not synced by git:** `.env` and `APP_OVERVIEW.md` — keep them in sync by
  hand if you change them.
- **Cloud-side (auto-shared):** Supabase migrations, deployed Edge Functions,
  and EAS builds — nothing to copy between machines.
