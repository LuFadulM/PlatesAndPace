# Plates & Pace — Architecture & Build Plan

Multi-user, bilingual (EN/ES), installable training app that turns a questionnaire into a
concrete workout for every calendar day, and keeps adapting it from logged results.

**Status: awaiting your confirmation before any code is written.** See
[§0 Blocker](#0-blocker-the-prototype-is-not-in-this-repo) first — one input is missing.

---

## 0. Blocker: the prototype is not in this repo

The brief says "In this folder is `plates-and-pace.html`". It is not. The repository
contains a single commit (`1335b7b Initial commit`) with only `README.md`, on both `main`
and `claude/tender-pasteur-ahgvof`. Nothing matching `*plates*` exists anywhere on the
container filesystem either.

That file is the source of truth for five things I cannot invent faithfully:

| Prototype asset | Why it matters | What happens without it |
| --- | --- | --- |
| Exercise library (names, cues, mistakes, muscle/equipment tags) | Seeds `EXERCISES` and both message files | I author ~70 exercises from scratch; your names/cues are lost |
| Animated SVG figures — pose engine + `ANIM` | The visual signature of the app | I write a new keyframe pose engine; it will not look like yours |
| Load & RPE autoregulation constants | Starting-strength ratios, step sizes | I use the ratios in §6.4, which are reasonable but not yours |
| Periodization + running-pace tables | Week shapes, pace multipliers | I use §6.6/§6.7, derived from the brief's formulas |
| Visual identity specifics | Exact hex values, spacing, type scale | I use the palette in §9, inferred from your description |

**What I need:** commit `plates-and-pace.html` to this branch, or paste it, or attach it.
**If you can't:** say "build without it" and I will treat §6 and §9 of this plan as the
specification and port nothing. Everything else in this plan is unaffected either way —
the architecture, schema, screens and milestones stand on the brief alone.

---

## 1. Product shape

- **Accounts.** Email magic link + Google. Each user owns a private profile, plan and logs.
- **Onboarding.** 9-step bilingual questionnaire, versioned, editable later.
- **Engine.** Pure TypeScript. Questionnaire + logs → a dated session for every day of a block.
- **Daily loop.** Readiness check → warm-up → log sets (kg/reps/RPE) → finisher/run → finish.
- **Adaptation.** Within-session (±5% on RPE miss), session-to-session (e1RM), week-to-week
  (coach review), block-to-block (re-calibration).
- **Social.** Groups share display name, weekly sessions done and streak. Nothing else, ever.
- **Offline.** Logging works with no network and syncs when it returns.

### The owner's account, as a worked example

Hybrid athlete, Bogotá, gym Mon–Fri, runs Tue (easy) / Thu (intervals) / Sat (long),
3 km in 20:00. The engine reads that as: 5-day split (§6.2), hybrid goal shape (§6.3),
5K-equivalent pace 6:52/km via Riegel (§6.7), legs kept light on Thu and Fri so Saturday's
long run is fresh (§6.3), `America/Bogota` for every date computation (§5).

Every other profile flows through the identical code path with different inputs — §11.3
pins that down with three contrasting fixtures.

---

## 2. Stack

| Concern | Choice | Note |
| --- | --- | --- |
| Framework | Next.js 15 (App Router) + TypeScript strict | Server Components for reads, Server Actions for writes |
| Styling | Tailwind CSS v4 | Design tokens as CSS variables (§9) |
| Backend | Supabase — Auth, Postgres, RLS | Local dev via Supabase CLI |
| i18n | next-intl, locale-prefixed routes `/en`, `/es` | §4 |
| Dates | `date-fns` v4 + `@date-fns/tz` (`TZDate`) | IANA zones, no UTC assumptions (§5) |
| Data | TanStack Query v5 + Server Actions | Optimistic writes, offline outbox (§8) |
| Validation | Zod | One schema per questionnaire step, reused client + server |
| Charts | Recharts | Progress screen |
| PWA | Serwist (`@serwist/next`) | Manifest, icons, offline shell |
| Unit tests | Vitest | Domain engine, i18n parity, dates |
| E2E | Playwright, 390×844 viewport | Both locales (§11.4) |
| Hosting | Vercel | Preview per PR |

### Repository layout

```
├── messages/{en,es}.json          # every string in the product
├── supabase/
│   ├── migrations/                # numbered SQL, checked in
│   └── seed.sql                   # demo user + sample block
├── src/
│   ├── app/[locale]/              # (auth) (onboarding) today plan run progress library group settings
│   ├── components/                # presentational, no data fetching
│   ├── domain/                    # THE ENGINE — pure, zero imports from app/ or supabase
│   │   ├── dates/                 # tz-correct today, week strip, block calendar
│   │   ├── profile/               # questionnaire types, derived athlete model
│   │   ├── strength/              # splits, slots, selection, loads, autoreg, periodization
│   │   ├── running/               # riegel, paces, progressions, hr zones
│   │   ├── review/                # weekly coach review
│   │   ├── nutrition/             # protein, calories, water
│   │   └── exercises/             # library data + animation keyframes
│   ├── lib/                       # supabase clients, query keys, offline outbox
│   └── types/database.ts          # generated from schema
├── e2e/                           # Playwright specs
└── PLAN.md
```

**The one architectural rule:** `src/domain` imports nothing from `src/app`, `src/lib` or
`@supabase/*`. It takes plain objects and returns plain objects. That is what makes the
engine testable in isolation and what keeps plan generation identical on server, client and
in a test runner.

---

## 3. Data flow

```
questionnaire_answers (versioned JSON)
        │
        ▼
  AthleteModel  ◄── body_measurements, injuries, equipment, schedule
        │
        ├──► generatePlan(model, seed) ──► plans + planned_sessions (one row per date)
        │
   set_logs / run_logs / session_logs
        │
        ├──► autoregulate() ──► next session's loads (§6.5)
        ├──► weeklyReview() ──► next week's volume (§6.8)
        └──► e1RM history ──► Progress charts, next block's calibration
```

Plans are **materialized**: `generatePlan` writes a `planned_sessions` row per calendar day
so the calendar, offline cache and history are all simple reads. Loads inside a session are
resolved at open time from the latest logs, so a session generated four weeks ago still
shows current weights.

Editing the questionnaire regenerates **future** sessions only. Past sessions and all logs
are immutable history.

Determinism: `generatePlan` takes an explicit seed (`user_id` + block number) and uses a
seeded PRNG for every tiebreak. Same input, same plan — which is what makes §11.3 testable.

---

## 4. Internationalization

- Every string lives in `messages/en.json` / `messages/es.json`. Exercise names, form cues,
  common mistakes, coach messages, validation errors, auth emails, voice cues. No literals
  in components — an ESLint rule (`no-literal-string` scoped to `src/app` and
  `src/components`) enforces it.
- Spanish is natural Latin American Spanish (`tú`, "pesas", "descanso", "series"), not a
  gloss of the English.
- `Intl` for all dates, numbers and units: `martes, 15 de septiembre` / `Tuesday, 15 September`.
- Locale resolution: URL prefix → profile → `Accept-Language` → `en`. Switching writes to
  `profiles.locale` and redirects to the mirrored route.
- **Build gate:** `i18n.test.ts` walks both trees and fails on any key present in one file
  and missing in the other, on any empty string, and on ICU placeholder sets that differ
  between locales (`{count}` in `en` but not in `es`).

---

## 5. Dates — the part that must be exactly right

Every "today" is `TZDate` in `profile.timezone`, never `new Date()` compared in UTC. One
module, `domain/dates`, owns this; nothing else calls date constructors.

```ts
todayInZone(zone: string, now = new Date()): PlainDate   // { y, m, d }
startOfPlanWeek(date: PlainDate): PlainDate              // Monday of that week
weekStrip(today: PlainDate): PlainDate[]                 // Mon..Sun containing today
relativeDayLabel(date, today): 'today' | 'tomorrow' | 'yesterday' | null
```

Dates are stored as `date` columns (`YYYY-MM-DD`), never `timestamptz`. A session belongs to
a calendar day in the user's zone, not to an instant.

Unit tests must cover:

1. `2026-09-15T21:00` in `America/Bogota` (= `2026-09-16T02:00Z`) is **Tuesday 15 September**
   when the process runs with `TZ=UTC`, `TZ=Asia/Tokyo` and `TZ=America/Bogota`.
2. Month boundary: `2026-09-30T23:30` Bogotá is 30 September, not 1 October.
3. Year boundary: `2026-12-31T22:00` Bogotá is 31 December.
4. DST: `2026-03-29` in `Europe/Madrid` (spring forward) and `2026-11-01` in
   `America/New_York` (fall back) produce 7-day week strips with no duplicate or missing day.
5. `startOfPlanWeek` on a Sunday returns the **preceding** Monday.

CI runs the whole unit suite twice, under `TZ=UTC` and `TZ=Pacific/Kiritimati` (UTC+14), so
a latent UTC assumption cannot pass.

---

## 6. The plan-generation engine

### 6.1 Athlete model

Questionnaire answers are normalized once into an `AthleteModel`: units → metric internally
(kg/cm; display converts), birth date → age, experience → tier, injuries → a set of banned
movement patterns, equipment → a set of available implements, health flags → `conservativeMode`.

Guards, applied before anything else:
- Age < 16 → registration blocked with a clear explanation.
- Age 16–17 → `noDeficit = true`, `maxRpe = 8`, no AMRAP or 1RM testing.
- Any PAR-Q "yes" → medical-clearance notice + `conservativeMode = true` (§6.4, §6.9).

### 6.2 Split by gym days

| Days | Split |
| --- | --- |
| 2 | Full body A / B |
| 3 | Full body A / B / C — or Push / Pull / Legs if experience ≥ 1–3 years |
| 4 | Upper / Lower / Upper / Lower |
| 5 | Lower A · Upper A · Glutes+Lower B · Upper B · Full body |
| 6 | Push / Pull / Legs ×2 |

Sessions are placed on the user's chosen gym days; run days come from their run selections
with the long run on its own chosen day.

### 6.3 Goal shapes the programming

| Goal | Rep bands | Structure |
| --- | --- | --- |
| Get strong | 3–6 on primaries | Top set + back-offs, long rest (3 min) |
| Build muscle | 6–15 | More volume, 90 s rest, last set to RPE 9 |
| Lose fat | 8–15 | Supersets, circuits, conditioning finisher |
| Fit & firm | 6–12 | Balanced, moderate rest |
| Run faster/further | 6–12, fewer lower sets | Lower-body sets capped on hard run days |
| Hybrid | Mixed | Hard days separated; legs light the day before the long run |

Hybrid/running interference rules: on an interval or long-run day, lower-body hard sets ≤ 4
and no heavy squat/deadlift pattern; the day **before** the long run drops lower-body
primaries to RPE ≤ 7.

### 6.4 Volume and exercise selection

Weekly hard sets per muscle group:

| Experience | Sets/muscle/week |
| --- | --- |
| None / < 1 year | 8–12 |
| 1–3 years | 12–16 |
| 3+ years | 14–20 |

Focus areas get **+4 sets** (hard cap 22). `conservativeMode` multiplies targets by 0.8.

Each session template is a list of **slots** — `{ role, pattern, targetMuscle, sets, repBand,
rpeTarget, supersetGroup? }`. Selection fills each slot from the library by:

1. Filter by available equipment.
2. Drop anything whose `contraindications` intersect the user's injuries (knee → no deep
   lunges/leg extension under load; low back → no barbell deadlift/good morning, swap to
   hip thrust and chest-supported row; shoulder → no behind-neck/upright row, swap to
   neutral-grip press; etc.).
3. Drop the user's explicit exclusions.
4. Drop anything above the user's experience floor (beginners get machines and
   chest-supported variants before free-weight barbell work; no barbell squat/deadlift/bench
   unless they said they know the technique).
5. Score the remainder: focus-area match, exact muscle match, machine bonus for beginners,
   penalty for appearing in the last 7 days (variety).
6. Seeded-PRNG tiebreak.

Users can swap an exercise **for today** (`exercise_preferences.scope='session'`) or
**permanently** (`scope='global'`, excluded from all future selection).

### 6.5 Starting loads and autoregulation

**Starting load** = `bodyweight × ratio(exercise) × sexFactor × experienceFactor`, then
`× 0.85` in conservative mode, then rounded to a real increment:

| Implement | kg | lb |
| --- | --- | --- |
| Barbell | 2.5 | 5 |
| Dumbbell | 2 (1 under 10 kg) | 5 |
| Machine | 5 | 10 |
| Cable | 2.5 | 5 |

**Estimated 1RM** from every logged set:

```
e1RM = kg × (1 + (reps + (10 − RPE)) / 30)
```

The session's e1RM is the max across its sets. The next session's working load inverts the
same formula at the next session's rep and RPE target:

```
load = e1RM / (1 + (targetReps + (10 − targetRpe)) / 30)
```

**Within a session:** after each logged set, remaining sets of that exercise adjust ±5% when
RPE misses target by more than 1 (too hard → −5%, too easy → +5%), cumulative adjustment
clamped to ±15%.

**Readiness** (sleep, soreness, energy, each 1–5) produces a multiplier before the session:
score ≥ 12 → load ×1.0, volume ×1.0; 8–11 → ×0.95 / ×1.0; ≤ 7 → ×0.90 and last accessory
slot dropped.

### 6.6 Periodization

A 4-week microcycle, repeated to fill the block:

| Week | Phase | Shape |
| --- | --- | --- |
| 1 | Calibration | Straight sets, RPE 7–8, establish e1RMs |
| 2 | Build | Top set RPE 8.5 + back-off sets at 85% of top |
| 3 | Intensify | RPE 9; drop set or rest-pause on the final slot |
| 4 | Deload | Volume ×0.55, load ×0.90, RPE ≤ 6 |

Blocks of 4 / 6 / 8 / 12 weeks: deload on every 4th week **and** always on the final week
(so a 6-week block deloads in weeks 4 and 6). The next block re-enters calibration with the
updated e1RMs, so loads carry forward.

### 6.7 Running

From a recent run (distance `D1`, time `T1`), **Riegel**: `T2 = T1 × (D2 / D1)^1.06`.
Normalize to a 5K-equivalent, then derive paces as multipliers of 5K pace:

| Pace | × 5K pace |
| --- | --- |
| Interval | 0.97 |
| Threshold | 1.06 |
| Easy | 1.30 |
| Long run | 1.35 |

*(3 km in 20:00 → 5K equivalent ≈ 34:22 → 6:52/km; easy ≈ 8:56/km, threshold ≈ 7:17/km,
intervals ≈ 6:40/km. Recomputed exactly in code, not from this table.)*

- **Goal pace** comes from the target race (5K/10K/21K) and, if set, the race date — the
  block's interval and threshold work migrates toward goal pace as the race approaches.
- **Can't run continuously:** run/walk progression starting from their stated continuous
  minutes, e.g. 8 × (1 min run / 2 min walk), adding run time weekly until 30 min continuous.
- **Long run** grows ≤ 10% per week, with a recovery week every 3rd–4th week that cuts it 25%.
- **HR zones** from `HRmax = 208 − 0.7 × age`: Z1 < 68%, Z2 68–78%, Z3 78–87%, Z4 87–93%,
  Z5 93–100%.
- Logging a faster run or time trial recomputes every pace for the remaining sessions.

### 6.8 Weekly coach review

Runs on the user's Monday. Compares planned vs completed and RPE trend:

| Condition | Action | Message |
| --- | --- | --- |
| Completion < 60% | Next week volume ×0.85 | "Tough week — I've trimmed it so you can finish it." |
| Median RPE ≥ target + 1.5 | Volume ×0.90, load hold | "You were grinding. Same weights, less volume." |
| Completion ≥ 90% and median RPE ≤ target − 1 | +1 set per focus muscle, loads +2.5% | "That looked easy. Stepping it up." |
| Otherwise | Unchanged | Progress summary |

Surfaced as a short "Coach's weekly review" card on Today, translated, never a raw number dump.

### 6.9 Nutrition estimates

Protein g/kg bodyweight: fat loss 2.0 · muscle 1.8 · strength 1.8 · fit & firm 1.6 ·
hybrid 1.8 · running 1.5.

Calories: Mifflin–St Jeor BMR (`10w + 6.25h − 5a + 5` male / `− 161` female; "prefer not to
say" uses the midpoint) × activity factor (1.375 at 2–3 sessions/week → 1.725 at 6+) × goal
adjustment (fat loss −20%, muscle +10%, else maintenance).

Floors: never below 1200 kcal (female) / 1500 kcal (male), never a deficit under 18 or in
conservative mode. Water: 35 ml/kg + 500 ml per training hour.

Every number is labeled an estimate, with the disclaimer in §12.

---

## 7. Database

All tables carry `user_id uuid references auth.users on delete cascade` and RLS
`using (auth.uid() = user_id)` for select/insert/update/delete, unless noted.

| Table | Columns (beyond id/user_id/timestamps) |
| --- | --- |
| `profiles` | `display_name`, `locale`, `timezone`, `units`, `sex`, `birth_date`, `height_cm`, `health_flags jsonb`, `conservative_mode bool` |
| `body_measurements` | `date`, `weight_kg`, `waist_cm` |
| `questionnaire_answers` | `version int`, `answers jsonb`, `active bool` |
| `plans` | `block int`, `start_date date`, `weeks int`, `settings jsonb` (snapshot) |
| `planned_sessions` | `plan_id`, `date`, `type` (gym/run/rest), `content jsonb` |
| `session_logs` | `planned_session_id`, `date`, `readiness jsonb`, `done bool`, `notes` |
| `set_logs` | `session_log_id`, `exercise_id`, `set_index`, `kg`, `reps`, `rpe`, `done bool` |
| `run_logs` | `date`, `planned_type`, `minutes`, `km`, `avg_pace_s_per_km` |
| `exercise_preferences` | `slot_key`, `from_exercise_id`, `to_exercise_id`, `scope` (session/global), `date` |
| `groups` | `name`, `owner_id` |
| `group_members` | `group_id`, `user_id`, `role` (owner/member), `share_details bool` |
| `group_invites` | `group_id`, `code char(6) unique`, `expires_at`, `created_by` |

**Group visibility.** `group_members` and `groups` are readable by fellow members via a
`SECURITY DEFINER` helper (`is_group_member(gid, uid)`) that avoids recursive RLS. Member
stats come **only** from a `SECURITY DEFINER` RPC, `group_weekly_summary(group_id)`,
returning `{ user_id, display_name, sessions_done_this_week, streak_days }` — and nothing
else. Body data, set logs, measurements and health flags are unreachable across users by
construction: there is no policy and no view that exposes them. `share_details` opt-in
extends the RPC's columns, not the table policies.

**Account deletion** cascades from `auth.users`. **Export** is an RPC returning one JSON
document of every row the user owns.

Types are generated into `src/types/database.ts` via `supabase gen types typescript` and
checked in, with a CI job failing if they drift from the migrations.

`seed.sql` creates a demo user matching the owner's profile (hybrid, Bogotá, 3 km in 20:00)
plus a generated block and two weeks of plausible logs, so `supabase start && npm run dev`
lands on a populated Today screen.

---

## 8. Offline and PWA

- Serwist service worker: precache the app shell, stale-while-revalidate for library and
  plan data, network-only for auth.
- Writes (set logs, readiness, session completion, run logs) go through an **outbox**: write
  to IndexedDB → optimistic TanStack Query update → attempt sync → retry with backoff on
  reconnect. UI shows a small "saved offline" pill.
- Conflict rule: last-write-wins per `(session_log_id, exercise_id, set_index)`; a set logged
  offline never overwrites a newer online log of the same set.
- Manifest + maskable icons + `display: standalone`, installable on iOS and Android.
- Refresh mid-session loses nothing — session draft state lives in IndexedDB, not React state.

---

## 9. Screens and visual identity

**Identity** (carried from the prototype description; exact hexes to be confirmed against
`plates-and-pace.html` once it's available):

| Token | Role |
| --- | --- |
| `--bg` cool grey | Page background |
| `--ink` near-black | Body text |
| `--plate-blue` | Weights / gym sessions |
| `--plate-yellow` | Runs |
| `--plate-green` | Completed |
| `--plate-red` | Today |

Barlow Condensed for headings, Barlow for body. Dark mode via `prefers-color-scheme` with a
manual override. Mobile first, 44px minimum tap targets, visible focus rings, labelled
controls, `prefers-reduced-motion` disables the SVG figure animation and all transitions.

| Screen | Contents |
| --- | --- |
| **Today** | Date with Today/Tomorrow/Yesterday, 7-day strip, session title, one-line coach intent; collapsible readiness / warm-up / fuel; exercise rows (`A`, `B`, `C1/C2`, name, "4 × 8, 45 kg", `0/4`) expanding to set logging; rest timer; finisher; run card; Finish session |
| **Plan** | Month grid for the whole block, gym/run markers, today highlighted, table for the selected week |
| **Guided run** | Full-screen interval timer, beeps, vibration, voice cues in the user's language, wake lock |
| **Progress** | Sessions/week, streak, e1RM per lift, weekly volume per muscle, run distance & pace trends, bodyweight & waist |
| **Library** | Animated figures, cues, common mistakes, filters by muscle and equipment |
| **Group** | Members, weekly sessions done, streaks, invite link + 6-char code |
| **Settings** | Edit questionnaire (regenerates future sessions, keeps history), language, units, timezone, export, delete account, disclaimer, privacy link |

---

## 10. CI/CD

GitHub Actions on every PR: install → lint → typecheck → `vitest` under `TZ=UTC` **and**
`TZ=Pacific/Kiritimati` → i18n parity test → generated-types drift check → `supabase start` +
migrations + `playwright test`. Vercel preview per PR; production deploy from `main` with
Supabase production env vars.

---

## 11. Test plan

**11.1 Dates** — the five cases in §5, each under three `TZ` settings.

**11.2 Engine units** — split selection per gym-day count; volume targets per experience;
injury filtering (a knee-injury profile never receives a loaded lunge); equipment filtering
(a dumbbell-only profile never receives a machine); load rounding to every increment;
e1RM round-trip; within-session ±5% clamping; deload week placement for 4/6/8/12; Riegel
against known equivalents; 10% long-run cap; HR zones; Mifflin–St Jeor and calorie floors;
under-18 guards.

**11.3 Different profiles, different plans** — snapshot three fixtures and assert they differ
in split, exercise selection and loads:
1. 25-year-old beginner woman · 3 gym days · dumbbells only · fat loss
2. 40-year-old intermediate man · 4 days · full gym · strength
3. Hybrid runner · 5 gym days + 3 runs · 3 km in 20:00 (the owner)

Plus a determinism test: same input twice → identical plan.

**11.4 Playwright, 390×844, both locales**
1. Sign up and complete onboarding **in Spanish**
2. Log a workout end to end
3. A high logged RPE lowers the next session's load; a low one raises it
4. Join a group with a 6-character invite code
5. User B cannot read user A's logs (direct API attempt returns no rows)
6. The calendar shows the correct "today" for a browser clocked to `America/Bogota` at 21:00

---

## 12. Privacy and safety

- Body, health and log data is never exposed to another user — enforced by RLS and by the
  group RPC returning only name, weekly count and streak (§7).
- PAR-Q "yes" → clear medical-clearance recommendation before hard training + conservative mode.
- Under 18 → no calorie deficit, no max-effort sets.
- Disclaimer shown in onboarding and permanently in Settings, both languages: general
  training guidance, not medical advice.
- Privacy page in both languages: what's stored, who can see it, how to export, how to delete.

---

## 13. Milestones

- [ ] **M0 — Plan** *(this document)* · Confirm, and resolve §0.
- [ ] **M1 — Foundation** · Next.js + TS strict + Tailwind, next-intl with `/en` `/es`, ESLint no-literal-string, CI green on an empty app.
- [ ] **M2 — Supabase** · Local stack, migrations for every table in §7, RLS policies, group RPC, generated types, seed script.
- [ ] **M3 — Auth** · Magic link + Google, session middleware, locale-aware auth emails, delete account, export JSON.
- [ ] **M4 — Domain: dates** · §5 module and its full test matrix. *(Nothing else starts until this is green.)*
- [ ] **M5 — Domain: strength** · Splits, slots, selection, loads, autoregulation, periodization + §11.2 tests.
- [ ] **M6 — Domain: running + nutrition + review** · §6.7–6.9 + tests, then the three-profile fixtures of §11.3.
- [ ] **M7 — Onboarding** · 9 steps, Zod per step, progress bar, both languages, writes `questionnaire_answers` and triggers generation.
- [ ] **M8 — Today + logging** · Session view, set logging, rest timer, readiness, finish; offline outbox (§8).
- [ ] **M9 — Plan, Progress, Library** · Month calendar, Recharts, exercise library with animated figures (§0 dependency).
- [ ] **M10 — Guided run + Groups + Settings** · Interval timer with voice/vibration/wake lock; create/join/leave/remove; questionnaire editing with history preserved.
- [ ] **M11 — PWA + hardening** · Manifest, icons, service worker, install prompt, dark mode, a11y pass, `prefers-reduced-motion`.
- [ ] **M12 — E2E + ship** · The six Playwright specs in §11.4, full suite green, Vercel deploy, README (setup, env vars, migrations, deployment, inviting people).

---

## 14. Decisions I need from you

1. **The prototype file** (§0) — provide it, or tell me to build without it.
2. **Block length default** — I'll use 8 weeks unless you'd rather start at 4.
3. **Supabase project** — should I create one via the Supabase integration, or will you
   provide the URL and keys for an existing project?
4. **Vercel project** — same question: create it, or deploy into one you already own?
5. **Google sign-in** — needs a Google OAuth client ID/secret configured in Supabase. I can
   build and test with magic link alone and leave Google behind a config flag until you add
   credentials. Say if you'd rather block on it.

Answer 1 (and ideally 2–5) and I'll start at M1.
