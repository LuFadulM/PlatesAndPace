# Hyex — project memory

Hyex (www.hyex.app), formerly Plates & Pace. One app, one repository. Lifting, running and
nutrition are one plan built from one profile: the nutrition side and the cardio side are
not separate codebases, they both live here. The repository directory and the offline
IndexedDB database still carry the old name; renaming either would orphan a phone's
unsynced queue, so they stay.

## Stack (keep it; do not rewrite for taste)

Next.js 15 App Router · React 19 · TypeScript strict (no `any` in `src/domain`) ·
Tailwind v4 with CSS-variable tokens and dark mode · next-intl v4 (`/es` default, `/en`
complete) · Supabase (Auth, Postgres, RLS; every table has `user_id`) · Zod at every
boundary · Serwist PWA · Recharts · Vitest · Playwright at 390 px · Vercel.

## Commands

| Task | Command |
| --- | --- |
| Dev server | `npm run dev` |
| Lint (bare strings, domain purity) | `npm run lint` |
| Types | `npm run typecheck` |
| Unit tests | `npm test` (`npm run test:tz` runs them in two time zones) |
| Build | `npm run build` |
| End to end (needs a local Supabase) | `npm run e2e` |
| Regenerate DB types | `python3 scripts/gen-db-types.py` |

Before every push: typecheck, lint, test, build. One validated push beats three.

## Folder conventions

- `src/domain/**` — the engine. Pure: no framework, no I/O, no `Date.now()` (inject the
  clock). ESLint enforces the import ban. `(profile, history, constraints) => plan`.
  - `profile/` questionnaire schemas → `AthleteModel`
  - `exercises/` library and types; names, cues and mistakes live in `messages/*.json`
  - `strength/` volume landmarks, templates, selection, loads, autoregulation, periodization
  - `running/` paces, zones, progressions, Riegel
  - `nutrition/` BMR, targets, macros, adaptation
  - `plan/` generator, resolve, edit, explain
- `src/lib/actions/*` — Server Actions (`'use server'`; only async exports). Validate with
  Zod, call the domain, write through Supabase, `revalidatePath`.
- `src/lib/data/*` — server-side readers.
- `src/app/[locale]/(app)/*` — signed-in screens. Server Components read; client
  components are dumb renderers over engine output.
- `src/components/*` — UI. `figure/` holds the SVG exercise animations.
- `supabase/migrations/*.sql` — numbered, applied in order; production is recorded in
  `supabase_migrations.schema_migrations`.
- `messages/{en,es}.json` — every user-facing string. `tests/i18n.test.ts` fails the build
  on missing keys or identical untranslated values not on the allow-list.

## Data contracts

Goal, experience, equipment and injury values are stored as strings in
`questionnaire_answers.answers` and snapshotted into `plans.settings`. Renaming one is a
migration. Legacy goal values are normalised on read in `src/domain/profile/types.ts`;
never write them again.

"Today" is a calendar date in the athlete's own time zone. Day-scoped columns are `date`,
never `timestamptz`.

## Glossary (ES / EN)

| ES | EN | Key |
| --- | --- | --- |
| Ganar músculo | Build muscle | `hypertrophy` |
| Fuerza máxima | Max strength | `strength` |
| Perder grasa | Lose fat | `fat_loss` |
| Recomposición | Recomposition | `recomposition` |
| Resistencia / carrera | Endurance / running | `endurance` |
| Rendimiento deportivo | Athletic performance | `athletic_performance` |
| Salud general | General health | `general_health` |
| Movilidad / vuelta a entrenar | Mobility / return to training | `mobility_rehab` |
| Serie | Set | |
| Repeticiones (reps) | Reps | |
| RPE / RIR (reps en reserva) | RPE / RIR (reps in reserve) | RIR = 10 − RPE |
| Carga | Load | stored in kg |
| Descanso | Rest | seconds |
| Serie pesada + respaldo | Top set + back-offs | `top_set_backoff` |
| Descarga | Deload | |
| Calentamiento | Warm-up | |
| Remate | Finisher | |
| Cuádriceps, isquiotibiales, glúteos, pantorrillas | Quads, hamstrings, glutes, calves | |
| Pecho, espalda, hombros, bíceps, tríceps, abdomen | Chest, back, shoulders, biceps, triceps, abs | |
| Rodaje suave / tirada larga / umbral / series | Easy run / long run / threshold / intervals | |
| Ritmo (min/km) | Pace | seconds per km |
| Zona de frecuencia cardíaca | Heart-rate zone | |

## Coaching rules the engine must keep

1. Contraindications are enforced at exercise selection. A banned movement never reaches a
   session; it does not merely carry a warning.
2. Beginners start at MEV, advanced lifters at mid-MAV; add about one set per muscle per
   week toward MRV; deload when performance stalls two sessions running, readiness is low
   three days running, joint pain is reported twice on a movement, or MRV is reached.
   `src/domain/strength/deload.ts` implements the stall, readiness and MRV triggers and
   Today offers the easy week; joint pain has no structured input yet, so that trigger is
   still unbuilt.
   Per-session direct volume caps at about 10 sets per muscle. Compounds count 1.0 for the
   primary muscle and 0.5 for secondaries.
3. Intensity by quality: max strength 1–5 reps, RIR 1–3, 180–300 s; hypertrophy 6–12 (5–30
   valid near failure), RIR 0–3, 90–180 s; endurance 15–30, RIR 1–2, 30–60 s; power 1–5 at
   30–60 percent moved fast, RIR 3+, never to failure. Isolation may hit RIR 0–1; heavy
   compounds stay at RIR 1–3; barbell squat and deadlift never go to failure for a
   non-advanced athlete. Minors and flagged athletes never exceed RPE 8.
4. Loads: Epley for reps ≤ 10, low confidence above 12; round to what the athlete's plates
   and dumbbells can make. Progression per exercise: RIR autoregulation for compounds,
   double progression for accessories, percentage in strength blocks, volume across the
   mesocycle.
5. Session order: activation → power → primary compound → secondary compound → accessories →
   isolation → conditioning. Cut from the bottom when over time, and say what was cut.
6. Running: Nes HRmax (211 − 0.64 × age) labelled as an estimate; Karvonen when resting HR
   is known, Friel when LTHR is known; VDOT paces from a recent effort; Riegel predictions
   shown as a range; 80/20 polarised; weekly volume up ≤ 10 percent with every fourth week
   reduced; hard intervals never before a heavy lower-body lift, and lift first when they
   share a day.
7. Nutrition: Mifflin-St Jeor, activity factor, then logged training rather than double
   counting. Fat loss −15 to −25 percent capped at 0.5–1.0 percent bodyweight a week; lean
   gain +5 to +15 percent capped at 0.25–0.5 percent a week; recomposition at maintenance.
   Protein 1.6–2.2 g/kg, top of range in a deficit; fat 0.6–1.0 g/kg; carbs fill and lean
   toward training days; fibre 14 g per 1000 kcal. Adapt from the 14-day weight trend, not
   the formula alone. Never below 1200 kcal (women) or 1500 kcal (men) without a dismissible
   medical warning. No deficit for minors or flagged athletes.
8. Red flags at onboarding gate the plan behind an explicit medical acknowledgement. The app
   gives training and general nutrition guidance, not medical advice; say it once.
9. Never fabricate a physiological claim or a citation. Where evidence is mixed, say so in a
   code comment and pick a defensible default.

## Working agreements

- Small, reviewable commits with descriptive messages. No model identifiers in commits or
  PRs. Draft PRs; drive them to green.
- Named fixture athletes in tests read as documentation: "38-year-old, 3 days a week, home
  dumbbells only, bad left shoulder, wants hypertrophy" must produce a valid,
  contraindication-free, time-budgeted plan.
- The user's own account is the worked example: hybrid athlete in Bogotá, gym Monday to
  Friday with a chosen split, runs Tuesday, Thursday and Saturday.
