'use client'

import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Fades a block in the first time it scrolls into view. Progressive: the
 * markup renders visible for crawlers and for readers with reduced motion;
 * the observer only ever adds the shown state.
 */
export function Reveal({ children, className = '', delay = 0, as: Tag = 'div' }: { children: ReactNode; className?: string; delay?: 0 | 1 | 2 | 3; as?: 'div' | 'li' | 'section' }) {
  const ref = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      node.dataset.shown = 'true'
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            node.dataset.shown = 'true'
            observer.disconnect()
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.1 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const delayClass = delay ? ` reveal-delay-${delay}` : ''
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Component = Tag as any
  return (
    <Component ref={ref} className={`reveal${delayClass} ${className}`}>
      {children}
    </Component>
  )
}
