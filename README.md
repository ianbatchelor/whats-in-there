# See What's in Here

A household food inventory for every freezer, fridge and cupboard. Tap the sticker on the freezer, photograph the food, confirm. Everyone in the household sees the same list, live.

One Next.js + TypeScript codebase is served on the web (Vercel) and wrapped by Capacitor into the iOS and Android apps. Supabase provides sign-in, Postgres with Row Level Security, private photo storage and realtime sync.

**Status:** Milestone 3 (label photos) of 5. See [docs/adr/0001-foundation.md](docs/adr/0001-foundation.md) for the decisions behind it and the design concepts in [docs/design/concepts.html](docs/design/concepts.html).

## What works today

- Email one-time-code sign-in (no passwords)
- Create a household, name yourself, invite people with a single-use link that expires in 7 days
- Members, owners, removing people, leaving, switching households
- My Places: picture cards for every place, grouped by kind (freezers, attic, garden, wardrobe, garage, shed, boxes and more), with your own names
- Add places, rename them, change their kind or remove them (the newer kinds need migration `20261104000001_more_place_types.sql`)
- Open a place to see a picture header, search, category filters and everything in it, sorted "use first": printed dates within two weeks, then the longest stored
- Snap the label: a photo fills in the name, amount, pack size, brand and printed dates for you to check (needs the `extract-product` Edge Function, see [docs/label-photos.md](docs/label-photos.md))
- Add things by hand: name, how many (items, portions, packs) or how much (g, kg, ml, litres), frozen date, use-by, best-before, brand, notes
- Take out things, including part of a pack, with Undo straight after and a history of who added and took out what
- Bottom tabs on phones (sidebar on desktop): Home, Search (every place at once, showing where each thing is), Add, Activity (who added or took out what) and Household
- A "Use first" list across the household
- Everyone in the household sees changes live
- Stickers: each place has a link (`/l/<code>`) to print as a QR label or write to an NFC sticker from the app, see [docs/nfc-stickers.md](docs/nfc-stickers.md)
- Database for later milestones: sticker codes, private photos, all behind RLS and proven by tests

## Run it locally

Requires Node 22 and pnpm 10.

```bash
pnpm install
cp .env.example .env.local     # fill in your Supabase URL and publishable key
pnpm dev                       # http://localhost:3000
```

Without a Supabase project the app opens on a "needs its database" screen.

## Set up Supabase (once)

1. Create a project at supabase.com, region **London (eu-west-2)**.
2. Apply the migrations in `supabase/migrations/` in order. Either `npx supabase link --project-ref <ref>` then `npx supabase db push`, or paste each file into the SQL editor.
3. **Authentication → Emails**: in both the **Magic link or OTP** and **Confirm sign up** templates, make the body show the code, for example `<p>Your See What's in Here code is {{ .Token }}</p>`. New users get the Confirm sign up email the first time. The app asks for the code rather than following a link, which works reliably inside the native apps. Code length (6 to 10 digits) is set under Authentication → Sign In / Providers → Email.
4. **Authentication → URL configuration**: set the Site URL to your web address (`NEXT_PUBLIC_APP_URL`).
5. Copy the project URL and publishable key (Settings → API) into `.env.local`, and into the Vercel project's environment variables.

## Checks

```bash
pnpm lint && pnpm typecheck && pnpm test   # unit tests (Vitest)
pnpm test:db                               # migrations + 51 RLS/integrity checks on PostgreSQL 16
pnpm build                                 # static export to out/
```

`pnpm test:db` uses `$DATABASE_URL` if set, otherwise starts a throwaway local PostgreSQL 16 cluster. It loads a small stand-in for Supabase's `auth` and `storage` schemas (`supabase/tests/00_supabase_shim.sql`) so the same migrations are tested without Docker. CI runs everything on every push.

## Native apps

```bash
pnpm cap:sync            # builds the web app and copies it into ios/ and android/
npx cap open ios         # needs a Mac with Xcode
npx cap open android     # needs Android Studio
```

NFC sticker writing, Universal Links and App Links arrive in Milestone 4 and must be tested on physical phones.

## Deploy the web app

Import the repo into Vercel. It detects Next.js; the build produces a static site. Add the three `NEXT_PUBLIC_*` variables from `.env.example`.

## Layout

```
app/                 screens (all client components; static export)
components/          ui kit, brand, feature components
lib/                 Supabase client, domain logic (dates, quantities, invites), hooks
supabase/migrations  schema, RLS, SQL functions, storage policies
supabase/tests       database tests and the Supabase shim
tests/unit           Vitest
ios/ android/        Capacitor native projects
docs/                decisions and design
```
