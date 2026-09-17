# Plates & Pace

A multi-user, bilingual (English / Spanish) training app, installable on phones. Answer a
questionnaire and get a concrete workout for every calendar day — lifting, running, or both —
that adapts to how each session actually went.

See [`PLAN.md`](./PLAN.md) for the architecture, the plan-generation rules, the schema and the
milestone checklist.

## Stack

Next.js 15 (App Router) · TypeScript strict · Tailwind v4 · Supabase (Auth, Postgres, RLS) ·
next-intl · Serwist (PWA) · Zod · Recharts · Vitest · Playwright · Vercel.

## Local setup

```bash
npm install
cp .env.example .env.local        # then fill in the two Supabase values below
supabase start                    # local Postgres, Auth, mail catcher (needs Docker)
supabase db reset                 # applies every migration, then supabase/seed.sql
npm run dev                       # http://localhost:3000 → /en or /es
```

`supabase start` prints the API URL and anon key. Put them in `.env.local`:

| Variable | Where it comes from |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `supabase status` locally; Project Settings → API in production |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | same |
| `SUPABASE_SERVICE_ROLE_KEY` | only for the e2e suite, never for the app |
| `SUPABASE_AUTH_GOOGLE_CLIENT_ID` / `_SECRET` | optional; enables Google sign-in |

Both `NEXT_PUBLIC_*` values are safe in the browser: Row Level Security decides what every
request may read and write, not the key. The app builds and serves its public pages with no
Supabase configured at all.

Magic-link emails sent locally land in the mail catcher at http://localhost:54324.

The seed creates one demo athlete matching the worked example in `PLAN.md` §1 — a hybrid
lifter in Bogotá, five gym days and three runs a week, 3 km in 20:00 — with the password
`demo-password` (email `demo@platesandpace.local`).

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Development server / production build / serve the build |
| `npm run lint` | ESLint, including the no-hard-coded-strings rule and the domain-purity rule |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit suite (dates, engine, i18n parity, outbox, routing) |
| `npm run test:tz` | The unit suite under `TZ=UTC` and `TZ=Pacific/Kiritimati` |
| `npm run e2e` | Playwright at 390 px in both languages; needs a running Supabase |
| `python3 scripts/gen-db-types.py` | Regenerates `src/types/database.ts` from a live schema |

## Database and migrations

Schema, policies and RPCs live in `supabase/migrations`, applied in filename order by
`supabase db reset` locally and `supabase db push` against a linked project.

```bash
supabase link --project-ref <ref>   # once
supabase db push                    # applies pending migrations to production
```

Privacy is enforced by the schema, not the UI. Every table carries a `user_id` and four RLS
policies keyed on `auth.uid()`. The only cross-user surface is the `group_weekly_summary`
function, which returns display name, sessions done this week and streak — nothing else.
`supabase/tests/rls.test.sql` proves it against a real Postgres on every PR.

## Deployment (Vercel + Supabase)

1. Create a Supabase project and run `supabase db push` against it.
2. In Supabase → Authentication → URL Configuration, set **Site URL** to
   `https://<domain>` and add `https://<domain>/**` under **Redirect URLs** (add
   `https://*-<team>.vercel.app/**` too if you want magic links from preview deployments).
   The callback carries query parameters, so an exact `/auth/callback` entry does not match;
   and a link whose redirect is not on this list is silently sent to the Site URL instead,
   which looks like "I clicked the link and nothing happened".
3. Import the repository into Vercel. `vercel.json` pins the Next.js preset.
4. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the Vercel project's
   environment variables (Production and Preview).
5. In Vercel → Settings → Deployment Protection, set **Vercel Authentication** to *Disabled*
   or *Only Preview Deployments*. Left on for production it shows every visitor
   "This request was blocked · 403".
6. Push to `main`. CI runs lint, types, build, the unit suite in two time zones, the RLS
   suite and the e2e suite; Vercel deploys the merge.

For Google sign-in, create an OAuth client in Google Cloud, add the Supabase callback URL
it prints, enable the provider in Supabase → Authentication → Providers, and set the two
`SUPABASE_AUTH_GOOGLE_*` values.

## Inviting people

Anyone can sign up at `/en/sign-in` or `/es/sign-in` with their email; there are no
passwords. To train together, one person creates a group under **Group**, then shares either
the 6-character code or the invite link (`/<locale>/join/<CODE>`). Members see each other's
display name, sessions completed this week and streak — never weights, body data, health
answers or logs.

## Languages

Every user-visible string lives in `messages/en.json` and `messages/es.json`. `npm run lint`
fails on a literal string in a component, and `npm test` fails if a key exists in one
language but not the other, if ICU placeholders differ, or if a long English string is left
sitting in the Spanish catalogue. The language is picked from the browser on a first visit,
switchable in Settings, and saved to the profile.

## Dates

"Today" is always the calendar date in the athlete's own time zone, never a UTC instant.
All date logic lives in `src/domain/dates`, and `npm run test:tz` proves the engine is
independent of the host clock.

## What was built without the prototype

The brief referenced a single-user prototype, `plates-and-pace.html`, that never reached the
repository. The exercise library (`src/domain/exercises/library.ts`, 70 exercises) and the
SVG figure animations (`src/components/figure`) were authored for this app instead. If the
original turns up, its library and poses drop into those two places without touching the
engine.
