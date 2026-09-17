# Plates & Pace

A multi-user, bilingual (English/Spanish) training app that turns a questionnaire into a
concrete workout for every calendar day, and keeps adapting it from logged results.

See [`PLAN.md`](./PLAN.md) for the architecture, the plan-generation rules, the database
schema and the milestone checklist.

## Local setup

```bash
npm install
npm run dev          # http://localhost:3000 → redirects to /en or /es
```

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint, including the no-hard-coded-strings rule |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit suite |
| `npm run test:tz` | The unit suite under `TZ=UTC` and `TZ=Pacific/Kiritimati` |
| `npm run e2e` | Playwright end-to-end suite |

## Languages

Every user-visible string lives in `messages/en.json` and `messages/es.json`. Nothing is
hard-coded — `npm run lint` fails on a literal string in a component, and `npm test` fails
if a key exists in one language but not the other.

Routes are locale-prefixed (`/en`, `/es`). The language is picked from the browser on a
first visit and can be switched at any time.

## Dates

A training day is a calendar date in the athlete's own time zone, never a UTC instant. All
date logic lives in `src/domain/dates` and nothing outside it may construct or compare
`Date` objects for calendar purposes. `npm run test:tz` proves the engine is independent of
the host clock.

## Database

Schema, policies and RPCs live in `supabase/migrations`, applied in filename order.

```bash
supabase start        # local Postgres, Auth, Studio and a mail catcher
supabase db reset     # re-apply every migration, then supabase/seed.sql
```

The seed creates one demo athlete matching the worked example in `PLAN.md` §1 — a hybrid
lifter in Bogotá, five gym days and three runs a week, currently running 3 km in 20:00.

### Privacy is enforced by the schema, not by the UI

Every table carries a `user_id` and four RLS policies keyed on `auth.uid()`. Body data,
health flags, measurements and training logs have no policy and no view that exposes them
to anyone but their owner.

What a group can see comes from a single `SECURITY DEFINER` function,
`group_weekly_summary`, which returns exactly four columns: member id, display name,
sessions completed this week, and streak. There is no query another member can write that
reaches further.

`supabase/tests/rls.test.sql` proves it against a real Postgres: one user cannot read
another's logs, measurements, plans or profile, cannot reach them by primary key, and
cannot insert rows owned by someone else. It runs on every PR.
