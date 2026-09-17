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

export function RestTimer({ seconds, onDone }: { seconds: number; onDone?: () => void }) {
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
