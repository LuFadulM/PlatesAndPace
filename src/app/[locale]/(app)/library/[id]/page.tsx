import Image from 'next/image'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { ExerciseFigure } from '@/components/figure/exercise-figure'
import { photoUrl, type CatalogueRow } from '@/domain/exercises/catalogue'
import { progressionsOf, regressionsOf, substitutesFor, type SubstituteQuery } from '@/domain/exercises/graph'
import { findExercise } from '@/domain/exercises/library'
import { materialsOf, type ExerciseDefinition } from '@/domain/exercises/types'
import { todayInZone } from '@/domain/dates'
import { buildAthleteModel, patternsForInjury } from '@/domain/profile/athlete'
import type { InjuryArea } from '@/domain/profile/types'
import { isLocale } from '@/i18n/routing'
import { Link } from '@/i18n/navigation'
import { catalogueRowFor, getCatalogueRow, getCatalogueSteps } from '@/lib/data/catalogue'
import { getActiveAnswers, getProfile } from '@/lib/data/profile'

const INJURY_AREAS: InjuryArea[] = ['knees', 'lower_back', 'shoulders', 'hips', 'wrists', 'neck']

/** The athlete's own constraints, so substitutes are ones they can actually do. */
async function constraintsFor(): Promise<SubstituteQuery> {
  try {
    const [profile, answers] = await Promise.all([getProfile(), getActiveAnswers()])
    if (!profile || !answers) return { equipment: 'full_gym' }
    const model = buildAthleteModel(answers, todayInZone(profile.timezone))
    return { equipment: model.equipment, unavailableMachines: model.unavailableMachines, bannedPatterns: model.bannedPatterns, avoidIds: model.avoidExerciseIds, maxDifficulty: model.tier }
  } catch {
    return { equipment: 'full_gym' }
  }
}

export default async function ExercisePage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  if (!isLocale(locale)) notFound()
  setRequestLocale(locale)
  const curated = findExercise(id)
  const open = curated ? undefined : getCatalogueRow(id)
  if (!curated && !open) notFound()
  const t = await getTranslations('library')
  return (
    <main className="flex flex-col gap-4 px-4 py-6">
      <Link href="/library" className="text-sm font-semibold text-(--color-plate-blue)">← {t('backToLibrary')}</Link>
      {curated ? <Curated exercise={curated} locale={locale} constraints={await constraintsFor()} /> : <Open row={open!} locale={locale} />}
      <p className="text-xs text-(--color-ink-muted)">{t('attribution')}</p>
    </main>
  )
}

function Photos({ row, name, t }: { row: CatalogueRow | undefined; name: string; t: Awaited<ReturnType<typeof getTranslations<'library'>>> }) {
  if (!row || row.images.length === 0) return null
  return (
    <div className="grid grid-cols-2 gap-2">
      {row.images.map((path, i) => (
        <Image key={path} src={photoUrl(path)} alt={t('photoAlt', { name, n: i + 1 })} width={360} height={360} unoptimized className="aspect-square w-full rounded-xl object-cover" />
      ))}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-(--color-border) bg-(--color-surface) px-3 py-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-(--color-ink-muted)">{label}</span>
      <span className="text-sm">{children}</span>
    </div>
  )
}

function Related({ title, items, tEx }: { title: string; items: ExerciseDefinition[]; tEx: (key: string) => string }) {
  if (items.length === 0) return null
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <ul className="flex flex-col gap-2">
        {items.map((e) => (
          <li key={e.id}>
            <Link href={`/library/${e.id}`} className="flex min-h-12 items-center gap-3 rounded-xl border border-(--color-border) bg-(--color-surface) px-3">
              <ExerciseFigure animation={e.animation} title={tEx(`${e.id}.name`)} className="h-10 w-10 shrink-0 text-(--color-ink)" />
              <span className="font-semibold">{tEx(`${e.id}.name`)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

async function Curated({ exercise, locale, constraints }: { exercise: ExerciseDefinition; locale: 'en' | 'es'; constraints: SubstituteQuery }) {
  const [t, tEx, tM, tT, tInj] = await Promise.all([
    getTranslations('library'),
    getTranslations('exercises'),
    getTranslations('muscles'),
    getTranslations('taxonomy'),
    getTranslations('onboarding.steps.injuries'),
  ])
  void locale
  const name = tEx(`${exercise.id}.name`)
  const photos = catalogueRowFor(exercise.mediaId)
  const injuries = INJURY_AREAS.filter((area) => patternsForInjury(area).some((p) => exercise.patterns.includes(p)))
  const tempo = exercise.tempo === 'hold' ? t('tempoHold') : exercise.tempo === 'X' ? t('tempoExplosive') : exercise.tempo.split('').join('-')
  const substitutes = substitutesFor(exercise.id, constraints).slice(0, 6)
  return (
    <>
      <header className="flex items-center gap-3">
        <ExerciseFigure animation={exercise.animation} title={name} className="h-24 w-24 shrink-0 text-(--color-ink)" />
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold break-words">{name}</h1>
          <p className="text-xs text-(--color-ink-muted)">{tEx(`${exercise.id}.aliases`)}</p>
          <p className="mt-1 text-xs font-semibold text-(--color-plate-blue)">{t('sourceAuthored')}</p>
        </div>
      </header>
      <Photos row={photos} name={name} t={t} />
      <div className="grid grid-cols-2 gap-2">
        <Row label={t('primaryMuscle')}>{tM(exercise.primary)}</Row>
        <Row label={t('alsoWorks')}>{exercise.secondary.length > 0 ? exercise.secondary.map((m) => tM(m)).join(', ') : '—'}</Row>
        <Row label={t('material')}>{materialsOf(exercise).map((m) => tT(`material.${m}`)).join(', ')}</Row>
        <Row label={t('level')}>{tT(`difficulty.${exercise.minTier}`)}</Row>
        <Row label={tT(`purpose.${exercise.purpose}`)}>{tT(`movement.${exercise.movement}`)} · {tT(`type.${exercise.type}`)}</Row>
        <Row label={t('tempo')}>{tempo}<span className="block text-xs text-(--color-ink-muted)">{t('tempoHint')}</span></Row>
      </div>
      <section className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-bold">{t('steps')}</h2>
        <ol className="list-decimal pl-5 text-sm">
          {(['step1', 'step2', 'step3'] as const).map((k) => <li key={k}>{tEx(`${exercise.id}.${k}`)}</li>)}
        </ol>
      </section>
      <section className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-bold">{t('cues')}</h2>
        <ul className="list-disc pl-5 text-sm">
          {(['cue1', 'cue2', 'cue3'] as const).map((k) => <li key={k}>{tEx(`${exercise.id}.${k}`)}</li>)}
        </ul>
      </section>
      <section className="flex flex-col gap-1">
        <h2 className="font-display text-lg font-bold">{t('mistakes')}</h2>
        <ul className="list-disc pl-5 text-sm text-(--color-plate-red)">
          {(['mistake1', 'mistake2'] as const).map((k) => <li key={k}>{tEx(`${exercise.id}.${k}`)}</li>)}
        </ul>
      </section>
      <Row label={t('breathing')}>{tT(`breathing.${exercise.breathing}`)}</Row>
      {injuries.length > 0 && <Row label={t('avoidIf')}>{injuries.map((a) => tInj(a)).join(', ')}</Row>}
      {substitutes.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg font-bold">{t('substitutes')}</h2>
          <p className="text-xs text-(--color-ink-muted)">{t('substitutesHint')}</p>
          <Related title="" items={substitutes} tEx={tEx} />
        </section>
      )}
      <Related title={t('easier')} items={regressionsOf(exercise.id)} tEx={tEx} />
      <Related title={t('harder')} items={progressionsOf(exercise.id)} tEx={tEx} />
    </>
  )
}

async function Open({ row, locale }: { row: CatalogueRow; locale: 'en' | 'es' }) {
  const [t, tEx, tM, tT] = await Promise.all([getTranslations('library'), getTranslations('exercises'), getTranslations('muscles'), getTranslations('taxonomy')])
  const name = locale === 'es' ? row.nameEs : row.name
  const steps = getCatalogueSteps(row.id)
  const twin = row.curated ? findExercise(row.curated) : undefined
  return (
    <>
      <header className="min-w-0">
        <h1 className="font-display text-2xl font-bold break-words">{name}</h1>
        {locale === 'es' && !row.nameEsReviewed && <p className="text-xs text-(--color-ink-muted)">{t('openName', { name: row.name })}</p>}
        <p className="mt-1 text-xs font-semibold text-(--color-ink-muted)">{t('sourceOpen')}</p>
      </header>
      <Photos row={row} name={name} t={t} />
      <div className="grid grid-cols-2 gap-2">
        <Row label={t('primaryMuscle')}>{tM(row.group)}<span className="block text-xs text-(--color-ink-muted)">{row.muscles.join(', ')}</span></Row>
        <Row label={t('alsoWorks')}>{row.secondary.length > 0 ? row.secondary.map((m) => tM(m)).join(', ') : '—'}</Row>
        <Row label={t('material')}>{tT(`material.${row.material}`)}</Row>
        <Row label={t('level')}>{tT(`difficulty.${row.difficulty}`)}</Row>
        <Row label={tT(`purpose.${row.purpose}`)}>{tT(`type.${row.type}`)}</Row>
      </div>
      {twin && (
        <Link href={`/library/${twin.id}`} className="flex min-h-12 items-center gap-3 rounded-xl border border-(--color-plate-blue) bg-(--color-surface) px-3 font-semibold text-(--color-plate-blue)">
          {t('curatedTwin')}: {tEx(`${twin.id}.name`)}
        </Link>
      )}
      {steps.length > 0 && (
        <section className="flex flex-col gap-1">
          <h2 className="font-display text-lg font-bold">{t('steps')}</h2>
          {locale === 'es' && <p className="text-xs text-(--color-ink-muted)">{t('openSteps')}</p>}
          <ol className="list-decimal pl-5 text-sm" lang="en">
            {steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </section>
      )}
    </>
  )
}
