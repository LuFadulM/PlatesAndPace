'use client'

import { useEffect, useState } from 'react'
import type { AnimationId } from '@/domain/exercises/types'

/**
 * A stick-figure athlete drawn from joint positions, animated between two
 * poses with SMIL so no JavaScript runs per frame. Each animation is a pair of
 * poses; the figure morphs A → B → A on a loop.
 *
 * Honour `prefers-reduced-motion`: the figure then holds pose A.
 */
type Joint = readonly [number, number]

interface Pose {
  head: Joint
  neck: Joint
  hip: Joint
  shoulderL: Joint
  elbowL: Joint
  handL: Joint
  shoulderR: Joint
  elbowR: Joint
  handR: Joint
  kneeL: Joint
  footL: Joint
  kneeR: Joint
  footR: Joint
  /** Optional implement drawn between the hands. */
  bar?: boolean
}

// Canvas is 100 × 100; y grows downward. Poses are side-on unless noted.
const STAND: Pose = { head: [50, 12], neck: [50, 22], hip: [50, 52], shoulderL: [50, 26], elbowL: [50, 40], handL: [50, 52], shoulderR: [50, 26], elbowR: [50, 40], handR: [50, 52], kneeL: [50, 72], footL: [50, 92], kneeR: [50, 72], footR: [50, 92] }

const POSES: Record<AnimationId, [Pose, Pose]> = {
  squat: [
    { ...STAND, bar: true, handL: [42, 26], handR: [58, 26], elbowL: [40, 34], elbowR: [60, 34] },
    { head: [52, 30], neck: [52, 40], hip: [42, 62], shoulderL: [52, 44], elbowL: [42, 50], handL: [44, 44], shoulderR: [52, 44], elbowR: [62, 50], handR: [60, 44], kneeL: [62, 74], footL: [52, 92], kneeR: [62, 74], footR: [52, 92], bar: true },
  ],
  hinge: [
    { ...STAND, bar: true, elbowL: [50, 40], handL: [50, 54], elbowR: [50, 40], handR: [50, 54] },
    { head: [70, 40], neck: [66, 46], hip: [40, 56], shoulderL: [64, 48], elbowL: [62, 62], handL: [60, 76], shoulderR: [64, 48], elbowR: [62, 62], handR: [60, 76], kneeL: [46, 74], footL: [50, 92], kneeR: [46, 74], footR: [50, 92], bar: true },
  ],
  lunge: [
    { ...STAND, footL: [40, 92], kneeL: [44, 72], footR: [64, 92], kneeR: [58, 72] },
    { head: [50, 18], neck: [50, 28], hip: [50, 60], shoulderL: [50, 32], elbowL: [50, 46], handL: [50, 58], shoulderR: [50, 32], elbowR: [50, 46], handR: [50, 58], kneeL: [34, 74], footL: [34, 92], kneeR: [66, 80], footR: [72, 92] },
  ],
  horizontal_push: [
    // Lying on a bench, drawn from the side: head left, feet right.
    { head: [16, 58], neck: [24, 58], hip: [54, 58], shoulderL: [28, 58], elbowL: [28, 46], handL: [28, 34], shoulderR: [28, 58], elbowR: [28, 46], handR: [28, 34], kneeL: [66, 66], footL: [72, 84], kneeR: [66, 66], footR: [72, 84], bar: true },
    { head: [16, 58], neck: [24, 58], hip: [54, 58], shoulderL: [28, 58], elbowL: [34, 52], handL: [28, 50], shoulderR: [28, 58], elbowR: [34, 52], handR: [28, 50], kneeL: [66, 66], footL: [72, 84], kneeR: [66, 66], footR: [72, 84], bar: true },
  ],
  vertical_push: [
    { ...STAND, elbowL: [40, 30], handL: [42, 22], elbowR: [60, 30], handR: [58, 22], bar: true },
    { ...STAND, elbowL: [44, 14], handL: [44, 4], elbowR: [56, 14], handR: [56, 4], bar: true },
  ],
  horizontal_pull: [
    { head: [66, 34], neck: [62, 40], hip: [40, 56], shoulderL: [60, 42], elbowL: [58, 58], handL: [56, 74], shoulderR: [60, 42], elbowR: [58, 58], handR: [56, 74], kneeL: [46, 74], footL: [50, 92], kneeR: [46, 74], footR: [50, 92], bar: true },
    { head: [66, 34], neck: [62, 40], hip: [40, 56], shoulderL: [60, 42], elbowL: [50, 50], handL: [54, 56], shoulderR: [60, 42], elbowR: [50, 50], handR: [54, 56], kneeL: [46, 74], footL: [50, 92], kneeR: [46, 74], footR: [50, 92], bar: true },
  ],
  vertical_pull: [
    { ...STAND, elbowL: [42, 12], handL: [40, 2], elbowR: [58, 12], handR: [60, 2], kneeL: [48, 74], kneeR: [52, 74], bar: true },
    { head: [50, 4], neck: [50, 14], hip: [50, 44], shoulderL: [50, 18], elbowL: [38, 12], handL: [40, 2], shoulderR: [50, 18], elbowR: [62, 12], handR: [60, 2], kneeL: [48, 66], footL: [46, 84], kneeR: [52, 66], footR: [54, 84], bar: true },
  ],
  curl: [
    { ...STAND },
    { ...STAND, elbowL: [50, 40], handL: [58, 28], elbowR: [50, 40], handR: [58, 28] },
  ],
  extension: [
    { ...STAND, elbowL: [50, 40], handL: [58, 30], elbowR: [50, 40], handR: [58, 30] },
    { ...STAND, elbowL: [50, 40], handL: [54, 54], elbowR: [50, 40], handR: [54, 54] },
  ],
  lateral_raise: [
    { ...STAND },
    { ...STAND, elbowL: [32, 30], handL: [16, 28], elbowR: [68, 30], handR: [84, 28] },
  ],
  hip_thrust: [
    { head: [22, 50], neck: [30, 52], hip: [56, 64], shoulderL: [32, 52], elbowL: [40, 58], handL: [48, 58], shoulderR: [32, 52], elbowR: [40, 58], handR: [48, 58], kneeL: [70, 56], footL: [78, 84], kneeR: [70, 56], footR: [78, 84], bar: true },
    { head: [22, 50], neck: [30, 52], hip: [56, 48], shoulderL: [32, 52], elbowL: [40, 50], handL: [50, 46], shoulderR: [32, 52], elbowR: [40, 50], handR: [50, 46], kneeL: [70, 52], footL: [78, 84], kneeR: [70, 52], footR: [78, 84], bar: true },
  ],
  plank: [
    { head: [14, 52], neck: [22, 54], hip: [56, 60], shoulderL: [26, 54], elbowL: [28, 70], handL: [30, 84], shoulderR: [26, 54], elbowR: [28, 70], handR: [30, 84], kneeL: [72, 70], footL: [86, 84], kneeR: [72, 70], footR: [86, 84] },
    { head: [14, 50], neck: [22, 52], hip: [56, 58], shoulderL: [26, 52], elbowL: [28, 68], handL: [30, 84], shoulderR: [26, 52], elbowR: [28, 68], handR: [30, 84], kneeL: [72, 68], footL: [86, 84], kneeR: [72, 68], footR: [86, 84] },
  ],
  crunch: [
    { head: [18, 70], neck: [26, 70], hip: [56, 72], shoulderL: [30, 70], elbowL: [26, 62], handL: [22, 64], shoulderR: [30, 70], elbowR: [26, 62], handR: [22, 64], kneeL: [66, 56], footL: [78, 72], kneeR: [66, 56], footR: [78, 72] },
    { head: [30, 52], neck: [36, 58], hip: [56, 72], shoulderL: [40, 60], elbowL: [34, 52], handL: [30, 50], shoulderR: [40, 60], elbowR: [34, 52], handR: [30, 50], kneeL: [66, 56], footL: [78, 72], kneeR: [66, 56], footR: [78, 72] },
  ],
  calf_raise: [
    { ...STAND },
    { head: [50, 6], neck: [50, 16], hip: [50, 46], shoulderL: [50, 20], elbowL: [50, 34], handL: [50, 46], shoulderR: [50, 20], elbowR: [50, 34], handR: [50, 46], kneeL: [50, 66], footL: [50, 86], kneeR: [50, 66], footR: [50, 86] },
  ],
  carry: [
    { ...STAND, footL: [42, 92], kneeL: [46, 72], footR: [58, 92], kneeR: [54, 72], handL: [46, 56], handR: [54, 56] },
    { ...STAND, footL: [58, 92], kneeL: [54, 72], footR: [42, 92], kneeR: [46, 72], handL: [46, 56], handR: [54, 56] },
  ],
  jump: [
    { head: [50, 30], neck: [50, 40], hip: [44, 62], shoulderL: [50, 44], elbowL: [40, 54], handL: [34, 64], shoulderR: [50, 44], elbowR: [60, 54], handR: [66, 64], kneeL: [60, 74], footL: [50, 92], kneeR: [60, 74], footR: [50, 92] },
    { head: [50, 4], neck: [50, 14], hip: [50, 42], shoulderL: [50, 18], elbowL: [42, 8], handL: [40, 0], shoulderR: [50, 18], elbowR: [58, 8], handR: [60, 0], kneeL: [48, 58], footL: [46, 72], kneeR: [52, 58], footR: [54, 72] },
  ],
  cardio: [
    { ...STAND, footL: [38, 92], kneeL: [40, 70], footR: [62, 88], kneeR: [60, 70], elbowL: [58, 36], handL: [64, 30], elbowR: [42, 36], handR: [36, 30] },
    { ...STAND, footL: [62, 88], kneeL: [60, 70], footR: [38, 92], kneeR: [40, 70], elbowL: [42, 36], handL: [36, 30], elbowR: [58, 36], handR: [64, 30] },
  ],
}

function limbs(p: Pose): string {
  const seg = (a: Joint, b: Joint) => `M${a[0]} ${a[1]} L${b[0]} ${b[1]}`
  return [
    seg(p.neck, p.hip),
    seg(p.neck, p.shoulderL), seg(p.shoulderL, p.elbowL), seg(p.elbowL, p.handL),
    seg(p.neck, p.shoulderR), seg(p.shoulderR, p.elbowR), seg(p.elbowR, p.handR),
    seg(p.hip, p.kneeL), seg(p.kneeL, p.footL),
    seg(p.hip, p.kneeR), seg(p.kneeR, p.footR),
  ].join(' ')
}

function bar(p: Pose): string {
  if (!p.bar) return 'M0 0 L0 0'
  const cx = (p.handL[0] + p.handR[0]) / 2
  const cy = (p.handL[1] + p.handR[1]) / 2
  return `M${cx - 14} ${cy} L${cx + 14} ${cy}`
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

export function ExerciseFigure({ animation, title, className }: { animation: AnimationId; title: string; className?: string }) {
  const reduced = useReducedMotion()
  const [a, b] = POSES[animation]
  const dur = '1.8s'
  const anim = (from: string, to: string) =>
    reduced ? null : <animate attributeName="d" values={`${from};${to};${from}`} dur={dur} repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" />

  return (
    <svg viewBox="0 0 100 100" role="img" aria-label={title} className={className ?? 'h-24 w-24'}>
      <circle cx={a.head[0]} cy={a.head[1]} r="6" fill="none" stroke="currentColor" strokeWidth="3">
        {!reduced && <animate attributeName="cx" values={`${a.head[0]};${b.head[0]};${a.head[0]}`} dur={dur} repeatCount="indefinite" />}
        {!reduced && <animate attributeName="cy" values={`${a.head[1]};${b.head[1]};${a.head[1]}`} dur={dur} repeatCount="indefinite" />}
      </circle>
      <path d={limbs(a)} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">{anim(limbs(a), limbs(b))}</path>
      <path d={bar(a)} fill="none" stroke="var(--color-plate-blue)" strokeWidth="4" strokeLinecap="round">{anim(bar(a), bar(b))}</path>
    </svg>
  )
}
