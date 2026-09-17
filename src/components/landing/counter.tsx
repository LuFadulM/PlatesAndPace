'use client'

import { useEffect, useRef, useState } from 'react'

/** Counts up from zero the first time it is seen; renders the final value without JS or with reduced motion. */
export function Counter({ value, className = '' }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement | null>(null)
  const [shown, setShown] = useState(value)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      observer.disconnect()
      const start = performance.now()
      const duration = 1400
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration)
        const eased = 1 - Math.pow(1 - t, 3)
        setShown(Math.round(value * eased))
        if (t < 1) requestAnimationFrame(step)
      }
      setShown(0)
      requestAnimationFrame(step)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [value])

  return <span ref={ref} className={`tabular-nums ${className}`}>{shown}</span>
}
