'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { formatDuration } from '@/domain/dates'

function beep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    gain.gain.value = 0.1
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.2)
  } catch {
    // No audio: vibration below still fires where supported.
  }
  try {
    navigator.vibrate?.(200)
  } catch {
    // Not supported.
  }
}

/**
 * Counts down the rest between sets. Starts on tap, or by itself when
 * `autoStartKey` changes — the session bumps it each time a set is marked done
 * so the athlete never has to reach for the timer mid-workout.
 */
export function RestTimer({ seconds, onDone, autoStartKey = 0 }: { seconds: number; onDone?: () => void; autoStartKey?: number }) {
  const t = useTranslations('today')
  const locale = useLocale()
  const [remaining, setRemaining] = useState<number | null>(null)
  const endAt = useRef<number>(0)

  useEffect(() => {
    if (remaining === null) return
    const id = window.setInterval(() => {
      const left = Math.max(0, Math.round((endAt.current - Date.now()) / 1000))
      setRemaining(left)
      if (left === 0) {
        window.clearInterval(id)
        beep()
        onDone?.()
        setRemaining(null)
      }
    }, 250)
    return () => window.clearInterval(id)
  }, [remaining !== null, onDone]) // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => {
    endAt.current = Date.now() + seconds * 1000
    setRemaining(seconds)
  }

  // Only a change after mount starts the clock: opening another exercise
  // while a key is already set must not begin a rest nobody asked for.
  const seenKey = useRef(autoStartKey)
  useEffect(() => {
    if (autoStartKey === seenKey.current) return
    seenKey.current = autoStartKey
    start()
  }, [autoStartKey]) // eslint-disable-line react-hooks/exhaustive-deps

  return remaining === null ? (
    <button type="button" onClick={start} className="min-h-11 rounded-lg border border-(--color-border) px-3 text-sm font-semibold">
      {t('rest', { time: formatDuration(seconds, locale) })}
    </button>
  ) : (
    <div role="timer" aria-live="polite" className="flex min-h-11 items-center gap-3">
      <span className="font-display text-2xl font-bold tabular-nums">{formatDuration(remaining, locale)}</span>
      <button type="button" onClick={() => setRemaining(null)} className="min-h-11 rounded-lg px-3 text-sm text-(--color-ink-muted)">{t('skipRest')}</button>
    </div>
  )
}
