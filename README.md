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

## Accounts

Three ways in. The first sends nothing at all, which is the point.

**Email and a password.** What the sign-in screen leads with, and what anyone
other than the author needs. A password is typed once and travels with the
person: it works on a second phone, a laptop and a friend's browser without a
message being sent, and it does not queue behind a mailer that allows two
messages an hour. Sign-up and sign-in are the same form with a toggle; a
forgotten password falls back to the emailed link, which is the only time an
inbox is involved.

Changing it lives in Settings, behind "Change my password". It asks for the
current one before accepting a new one: a session cookie is something a borrowed
or unlocked phone already has, while the old password is something only the
owner knows, so without that check a phone left on a bench would be enough to
lock its owner out for good.

This needs two project settings, both under **Authentication**: the **Email**
provider on, and **Confirm email** *off*. With confirmations on, Supabase
withholds the session until a link is opened, which puts the inbox back in front
of every new account and hands the mailer's cap the power to stop sign-ups
entirely. `supabase/config.toml` sets `enable_confirmations = false` so local
development matches. The address is for recovery; the password is the
credential.

If a project's dashboard cannot be reached to set those — which happens when the
project was provisioned through the Vercel marketplace rather than created on
Supabase directly — the symptom is a `400 Email signups are disabled` or
`422 Email logins are disabled` line in Authentication → Logs, on every attempt,
no matter how many times the toggle appears to be saved. The way out is a
project whose dashboard you own: apply the migrations to it, move the rows
across, and repoint `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
at it. Accounts can be seeded straight into `auth.users` with
`crypt(<password>, gen_salt('bf'))`, an `email_confirmed_at`, and a matching
`auth.identities` row — GoTrue looks accounts up through the identity, so
without that row a password sign-in fails on an account that otherwise looks
complete.

**Start without an email.** For someone who wants to try the app before
deciding anything. Supabase issues an anonymous
user, which is a real row in `auth.users`, so every row level security policy here — all of
them keyed on `auth.uid() = user_id` — applies unchanged. No address, no link to open, no
confirmation. The trade is real and the screen says it: the session lives in that browser,
so clearing its data or picking up another phone loses the account. Settings offers a field
to attach an email whenever they want, which turns the anonymous user into a permanent one
without touching a row of their data.

This needs one switch in the Supabase dashboard, under **Authentication → Sign In / Up →
Anonymous sign-ins**. With it off, the button returns a message saying so rather than
failing silently. Anonymous users are free on the free tier; if the app is ever abused to
mint accounts in bulk, the same screen has a Captcha option.

**Magic link**, for someone coming back on a new device. Three things break it, and the
project's own auth log (Supabase dashboard → Logs → Auth) names which one every time. Read
it before changing anything: each failure below is a distinct line there.

`422 Email logins are disabled` — the Email provider is switched off under **Authentication
→ Sign In / Up → Email**. Nothing is sent, nothing is retryable, and the sign-in screen now
says exactly this rather than "we could not send the link".

`429 email rate limit exceeded` — Supabase's built-in mailer is capped at a couple of
messages an hour per project and is explicitly not for production. This is the usual cause
of "it worked yesterday and not today": the third attempt in an hour silently sends
nothing. The real fix is custom SMTP under **Authentication → Emails → SMTP Settings**;
Resend's free tier (3,000 a month) and Brevo's (300 a day) both cover an app this size at
no cost. Until then the screen tells the athlete to wait rather than to keep pressing.

`403 Email link is invalid or has expired` / `One-time token not found` — the token was
already spent. Either the link was opened in a browser other than the one that asked for it
(PKCE: exchanging the code needs a verifier cookie held by the *requesting* browser, which a
mail app's built-in browser does not have), or a mail scanner followed the link before the
athlete did. A single GET spends it either way.

The durable answer to that last one is the **six-digit code**, which the check-email screen
now offers behind "the link did not work?". It is verified from the browser the athlete is
already sitting in, so there is no verifier to be missing, and no scanner can spend it by
looking at it. It needs the code to actually be in the email: under **Authentication →
Emails → Magic Link**, the template must include `{{ .Token }}`. The default template is
link-only, so add a line such as

```html
<p>Or enter this code: <strong>{{ .Token }}</strong></p>
```

Also worth checking once: **Redirect URLs** must include `https://<domain>/**`. A link whose
redirect is not on that list is sent to the Site URL instead, which looks exactly like
clicking the link and nothing happening.

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
  history of disordered eating. The athlete logs what they ate against that target
  (`intake.ts`), with one-tap repeats built from their own history. Entries are their own
  words and their own numbers: the brief named USDA FoodData Central and Open Food Facts,
  neither is reachable from this environment, and inventing macros for a named food would
  be fabricating a nutritional claim, so the app asks rather than guesses.
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
