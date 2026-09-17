'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { formatDuration, formatPace } from '@/domain/dates'
import type { RunSession } from '@/domain/plan'
import { saveRun } from '@/lib/actions/logs'

interface Segment {
  kind: 'warmup' | 'work' | 'rest' | 'run' | 'walk' | 'steady' | 'cooldown'
  seconds: number
  paceSecPerKm?: number | null
}

/** Turns a planned run into the timed segments the screen counts through. */
export function buildSegments(run: RunSession): Segment[] {
  if (run.runWalk) {
    const segs: Segment[] = [{ kind: 'warmup', seconds: 180 }]
    for (let i = 0; i < run.runWalk.repeats; i += 1) {
      segs.push({ kind: 'run', seconds: run.runWalk.runMinutes * 60 })
      if (run.runWalk.walkMinutes > 0) segs.push({ kind: 'walk', seconds: run.runWalk.walkMinutes * 60 })
    }
    segs.push({ kind: 'cooldown', seconds: 180 })
    return segs
  }
  if (run.intervals) {
    const segs: Segment[] = [{ kind: 'warmup', seconds: 15 * 60 }]
    const workSeconds = Math.round((run.intervals.workMeters / 1000) * run.intervals.paceSecPerKm)
    for (let i = 0; i < run.intervals.reps; i += 1) {
      segs.push({ kind: 'work', seconds: workSeconds, paceSecPerKm: run.intervals.paceSecPerKm })
      if (i < run.intervals.reps - 1) segs.push({ kind: 'rest', seconds: run.intervals.restSec })
    }
    segs.push({ kind: 'cooldown', seconds: 10 * 60 })
    return segs
  }
  if (run.kind === 'threshold') {
    return [
      { kind: 'warmup', seconds: 20 * 60 },
      { kind: 'work', seconds: (run.minutes - 20) * 60, paceSecPerKm: run.paceSecPerKm },
    ]
  }
  return [{ kind: 'steady', seconds: run.minutes * 60, paceSecPerKm: run.paceSecPerKm }]
}

function tone(frequency: number, ms: number) {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = frequency
    gain.gain.value = 0.12
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + ms / 1000)
  } catch {
    // Audio blocked: vibration and voice still fire.
  }
}

export function GuidedRun({ run, date }: { run: RunSession; date: string }) {
  const t = useTranslations('run')
  const tAll = useTranslations()
  const locale = useLocale()
  const router = useRouter()
  const segments = useRef(buildSegments(run)).current
  const total = segments.reduce((s, x) => s + x.seconds, 0)
  const [index, setIndex] = useState(0)
  const [remaining, setRemaining] = useState(segments[0]?.seconds ?? 0)
  const [elapsed, setElapsed] = useState(0)
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const wakeLock = useRef<WakeLockSentinel | null>(null)
  const lastTick = useRef<number>(0)

  const speak = useCallback(
    (text: string) => {
      try {
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.lang = locale === 'es' ? 'es-419' : 'en-US'
        window.speechSynthesis.cancel()
        window.speechSynthesis.speak(utterance)
      } catch {
        // No speech synthesis.
      }
    },
    [locale],
  )

  const cueFor = useCallback(
    (segment: Segment) => {
      const pace = segment.paceSecPerKm ? formatPace(segment.paceSecPerKm, locale) : null
      return pace ? t(`cues.${segment.kind}WithPace`, { pace }) : t(`cues.${segment.kind}`)
    },
    [locale, t],
  )

  useEffect(() => {
    if (!running) return
    lastTick.current = Date.now()
    const id = window.setInterval(() => {
      const now = Date.now()
      const delta = Math.round((now - lastTick.current) / 1000)
      if (delta < 1) return
      lastTick.current = now
      setElapsed((e) => e + delta)
      setRemaining((r) => {
        const next = r - delta
        if (next > 0) {
          if (next <= 3) tone(660, 120)
          return next
        }
        const nextIndex = index + 1
        if (nextIndex >= segments.length) {
          setRunning(false)
          setFinished(true)
          tone(880, 500)
          navigator.vibrate?.([200, 100, 200])
          speak(t('cues.done'))
          return 0
        }
        setIndex(nextIndex)
        tone(880, 250)
        navigator.vibrate?.(300)
        speak(cueFor(segments[nextIndex]!))
        return segments[nextIndex]!.seconds
      })
    }, 250)
    return () => window.clearInterval(id)
  }, [running, index, segments, speak, cueFor, t])

  useEffect(() => {
    if (!running) {
      wakeLock.current?.release().catch(() => undefined)
      wakeLock.current = null
      return
    }
    navigator.wakeLock?.request('screen').then((lock) => { wakeLock.current = lock }).catch(() => undefined)
  }, [running])

  const start = () => {
    setRunning(true)
    speak(cueFor(segments[index]!))
  }

  const segment = segments[index]!
  const colour = segment.kind === 'work' || segment.kind === 'run' ? 'bg-(--color-plate-red)' : segment.kind === 'rest' || segment.kind === 'walk' ? 'bg-(--color-plate-green)' : 'bg-(--color-plate-yellow)'

  return (
    <main className={`fixed inset-0 z-30 flex flex-col items-center justify-between p-6 text-center text-white ${colour}`}>
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest opacity-90">{tAll(run.titleKey)}</p>
        <p className="text-xs opacity-80">{t('segmentOf', { n: index + 1, total: segments.length })} · {formatDuration(total - elapsed, locale)} {t('left')}</p>
      </div>
      <div aria-live="polite" role="timer">
        <p className="font-display text-3xl font-bold">{t(`segments.${segment.kind}`)}</p>
        <p className="font-display text-8xl font-bold tabular-nums">{formatDuration(remaining, locale)}</p>
        {segment.paceSecPerKm && <p className="text-lg">{formatPace(segment.paceSecPerKm, locale)} {t('perKm')}</p>}
      </div>
      <div className="flex w-full max-w-sm flex-col gap-3">
        {finished ? (
          <>
            <p className="font-semibold">{t('finished')}</p>
            <button type="button" onClick={() => { void saveRun({ date, plannedType: run.kind === 'none' ? null : run.kind, minutes: Math.round(elapsed / 60), km: run.km || Math.round((elapsed / (run.paceSecPerKm ?? 420)) * 10) / 10 }).then(() => router.push({ pathname: '/today', query: { date } })) }} className="min-h-12 rounded-xl bg-white font-display text-lg font-bold text-(--color-ink)">{t('saveAndExit')}</button>
          </>
        ) : (
          <>
            <button type="button" onClick={running ? () => setRunning(false) : start} className="min-h-14 rounded-xl bg-white font-display text-xl font-bold text-(--color-ink)">{running ? t('pause') : elapsed > 0 ? t('resume') : t('start')}</button>
            <button type="button" onClick={() => router.push({ pathname: '/today', query: { date } })} className="min-h-11 rounded-xl border border-white/60 font-semibold">{t('exit')}</button>
          </>
        )}
      </div>
    </main>
  )
}
