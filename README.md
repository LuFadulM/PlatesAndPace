# Hyex

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
`demo-password` (email `demo@hyex.local`).

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
3. Still in Supabase → Authentication → Email Templates, point both **Confirm signup** and
   **Magic Link** at the app's callback instead of Supabase's redirect page. Replace the
   link's `href` in each template with:

   ```
   {{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email
   ```

   The app's callback verifies the token itself, so the link works in whichever browser
   opens it — a mail app's built-in browser included. The default template relies on a
   cookie set by the browser that requested the link, and fails with "code verifier
   should be non-empty" anywhere else.
4. Supabase's built-in mailer allows two emails per hour per project, which is fine for
   one person testing and nothing more. Before inviting people, add your own SMTP under
   Authentication → SMTP Settings (Resend, Postmark and Gmail all work) and raise the
   email rate limit under Authentication → Rate Limits. The sign-in screen tells the
   athlete when the limit is hit rather than reporting a broken mail server.
5. Import the repository into Vercel. `vercel.json` pins the Next.js preset.
6. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the Vercel project's
   environment variables (Production and Preview).
7. In Vercel → Settings → Deployment Protection, set **Vercel Authentication** to *Disabled*
   or *Only Preview Deployments*. Left on for production it shows every visitor
   "This request was blocked · 403".
8. Push to `main`. CI runs lint, types, build, the unit suite in two time zones, the RLS
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

## The engine, in one page

Everything the app prescribes comes from `src/domain`, which is pure and tested; the
screens only render it. The rules are written out in `CLAUDE.md`; in short:

- **Eight goals**, each with its own programming signature (`src/domain/strength/goals.ts`):
  muscle, strength, fat loss, recomposition, endurance, athletic performance, general
  health, mobility or a return to training. A secondary goal ("I also run") fits beside it.
- **Volume from landmarks** (`volume.ts`): each muscle has MV, MEV, MAV and MRV; a beginner
  starts at MEV, an advanced lifter inside the adaptive range, each week adds a set, the
  deload halves. The generator keeps a weekly ledger per muscle, credits secondaries by half,
  caps a session at ten direct sets per muscle, and never exceeds the athlete's time: every
  cut is recorded and shown.
- **Effort**: the phase sets an RPE target; the goal, the athlete and the movement cap it.
  Compounds never reach failure; big barbell lifts stay two reps shy for anyone not yet
  advanced; minors and flagged athletes never pass RPE 8. Reps in reserve are shown.
- **Loads** (`loads.ts`, `progression.ts`, `plan/resolve.ts`): bodyweight ratios to start,
  then the estimated max from logged sets with a confidence flag; plate math rounds every
  barbell load to what the rack can hold; the main lifts progress by RPE and max, the
  accessories by double progression.
- **Running** (`src/domain/running`): VDOT paces from a recent effort, zones by lactate
  threshold, heart-rate reserve or percent of max, 80/20 polarised weeks, long runs growing at
  most a tenth a week with every fourth week reduced, and lift-first days. The baseline is
  learned, not frozen: every logged run of three kilometres or more can pull it faster, never
  slower, by at most five percent at a time (`baseline.ts`). Run sessions re-derive their
  targets when opened, each kind holding whatever the generator treated as fixed.
- **Food** (`src/domain/nutrition`): Mifflin-St Jeor, macros, carbohydrate leaning toward
  training days, deficits and surpluses capped at a safe weekly rate, and a target that
  adapts to the two-week weight trend. Never a deficit for minors, flagged athletes or a
  history of disordered eating.
- **The week reviews itself** (`src/domain/review`): on the athlete's Monday the engine
  compares what was planned against what happened and how hard it felt, then scales the week
  ahead. The cut is taken against the session total and spent from the bottom up, so
  accessories give way before the opening compound and a reduction always reduces something.
- **Backing off early** (`strength/deload.ts`): a block deloads every fourth week, and sooner
  when a compound has stalled across three sessions, readiness has been poor three days
  running, a muscle has reached MRV, or a movement has hurt twice. Today names the reason and
  offers the easy week; taking it is the athlete's call.
- **The plan explains itself** (`plan/explain.ts`): every decision above is a numbered line
  on the Plan page, in both languages.

`src/domain/plan/__tests__/athletes.test.ts` is the fixture suite: named athletes, each of
whom must get a valid plan.

## The exercise library

Two sources, one browser at `/library`.

- **Coached** (`src/domain/exercises/library.ts`, 129 movements): everything the engine can
  program. Each row carries the four filter axes the brief asks for (muscle, purpose, type
  and material) plus force vector, plane, difficulty, tempo, breathing, stimulus-to-fatigue
  and the contraindicated patterns. Names, aliases, three cues, two common mistakes and
  three execution steps live in `messages/{en,es}.json`, so both languages are complete or
  the build fails.
- **Open catalogue** (`src/data/catalogue.json`, 876 rows): imported from
  [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (public domain, Unlicense)
  by `python3 scripts/import-catalogue.py`, mapped onto the same taxonomy. Photos are served
  from that repository. Its step-by-step instructions exist in English only and the UI says
  so. Spanish names are built from a term glossary and every one is flagged
  `nameEsReviewed: false` until a person checks it.

The substitution graph (`src/domain/exercises/graph.ts`) answers "the rack is busy" and "my
shoulder hurts": authored regression and progression edges, plus substitutes computed from
the taxonomy and filtered by the athlete's equipment, unavailable machines, banned patterns
and experience. Search folds accents and reads both languages, so *press de banca*, *bench
press* and *RDL* all land on the same row.

`wger`, USDA FoodData Central and Open Food Facts were unreachable from the build sandbox;
only free-exercise-db was imported. No reference site was scraped.

## What was built without the prototype

The brief referenced a single-user prototype, `plates-and-pace.html`, that never reached the
repository. The exercise library (`src/domain/exercises/library.ts`, now 129 movements) and the
SVG figure animations (`src/components/figure`) were authored for this app instead. If the
original turns up, its library and poses drop into those two places without touching the
engine.
