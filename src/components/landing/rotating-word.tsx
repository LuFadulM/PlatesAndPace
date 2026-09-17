'use client'

import { useEffect, useState } from 'react'

/** Cycles through words every couple of seconds; holds the first one under reduced motion. */
export function RotatingWord({ words, className = '' }: { words: readonly string[]; className?: string }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = window.setInterval(() => setIndex((i) => (i + 1) % words.length), 2200)
    return () => window.clearInterval(id)
  }, [words.length])

  return (
    <span className={`inline-block ${className}`} aria-live="polite">
      <span key={index} className="word-in inline-block">{words[index]}</span>
    </span>
  )
}
