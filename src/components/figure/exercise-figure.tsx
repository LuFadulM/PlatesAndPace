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

// Shared starting positions. Side view unless noted: the athlete faces right.
const SEATED: Pose = { head: [40, 18], neck: [40, 28], hip: [46, 56], shoulderL: [40, 32], elbowL: [42, 44], handL: [46, 54], shoulderR: [40, 32], elbowR: [42, 44], handR: [46, 54], kneeL: [62, 56], footL: [62, 80], kneeR: [62, 56], footR: [62, 80] }
const SUPINE: Pose = { head: [16, 62], neck: [24, 62], hip: [52, 64], shoulderL: [28, 62], elbowL: [34, 66], handL: [40, 70], shoulderR: [28, 62], elbowR: [34, 66], handR: [40, 70], kneeL: [66, 52], footL: [76, 70], kneeR: [66, 52], footR: [76, 70] }
const PLANK_TOP: Pose = { head: [14, 46], neck: [22, 48], hip: [56, 54], shoulderL: [26, 48], elbowL: [26, 62], handL: [26, 78], shoulderR: [26, 48], elbowR: [26, 62], handR: [26, 78], kneeL: [72, 62], footL: [86, 74], kneeR: [72, 62], footR: [86, 74] }
const HINGE: Pose = { head: [70, 40], neck: [66, 46], hip: [40, 56], shoulderL: [64, 48], elbowL: [62, 62], handL: [60, 76], shoulderR: [64, 48], elbowR: [62, 62], handR: [60, 76], kneeL: [46, 74], footL: [50, 92], kneeR: [46, 74], footR: [50, 92] }
const SQUAT_BOTTOM: Pose = { head: [52, 30], neck: [52, 40], hip: [42, 62], shoulderL: [52, 44], elbowL: [42, 50], handL: [44, 44], shoulderR: [52, 44], elbowR: [62, 50], handR: [60, 44], kneeL: [62, 74], footL: [52, 92], kneeR: [62, 74], footR: [52, 92] }
const JUMP_TOP: Pose = { head: [50, 4], neck: [50, 14], hip: [50, 42], shoulderL: [50, 18], elbowL: [42, 8], handL: [40, 0], shoulderR: [50, 18], elbowR: [58, 8], handR: [60, 0], kneeL: [48, 58], footL: [46, 72], kneeR: [52, 58], footR: [54, 72] }

const POSES: Record<AnimationId, [Pose, Pose]> = {
  // ------------------------------------------------------------ squats --
  squat: [
    { ...STAND, bar: true, handL: [42, 26], handR: [58, 26], elbowL: [40, 34], elbowR: [60, 34] },
    { ...SQUAT_BOTTOM, bar: true },
  ],
  front_squat: [
    { ...STAND, bar: true, elbowL: [58, 32], handL: [54, 24], elbowR: [58, 32], handR: [54, 24] },
    { ...SQUAT_BOTTOM, bar: true, elbowL: [60, 50], handL: [56, 42], elbowR: [60, 50], handR: [56, 42] },
  ],
  goblet_squat: [
    { ...STAND, elbowL: [48, 40], handL: [56, 30], elbowR: [48, 40], handR: [56, 30] },
    { ...SQUAT_BOTTOM, elbowL: [50, 56], handL: [58, 46], elbowR: [50, 56], handR: [58, 46] },
  ],
  hack_squat: [
    // Leaning back on the sled, feet forward on the platform.
    { head: [40, 22], neck: [44, 30], hip: [52, 56], shoulderL: [44, 34], elbowL: [38, 30], handL: [40, 24], shoulderR: [44, 34], elbowR: [38, 30], handR: [40, 24], kneeL: [60, 72], footL: [56, 92], kneeR: [60, 72], footR: [56, 92] },
    { head: [44, 34], neck: [48, 42], hip: [56, 66], shoulderL: [48, 46], elbowL: [42, 42], handL: [44, 36], shoulderR: [48, 46], elbowR: [42, 42], handR: [44, 36], kneeL: [70, 76], footL: [56, 92], kneeR: [70, 76], footR: [56, 92] },
  ],
  leg_press: [
    // Reclined in the seat, pushing the platform up and away.
    { head: [26, 40], neck: [32, 44], hip: [46, 62], shoulderL: [34, 46], elbowL: [40, 56], handL: [46, 62], shoulderR: [34, 46], elbowR: [40, 56], handR: [46, 62], kneeL: [56, 42], footL: [66, 48], kneeR: [56, 42], footR: [66, 48] },
    { head: [26, 40], neck: [32, 44], hip: [46, 62], shoulderL: [34, 46], elbowL: [40, 56], handL: [46, 62], shoulderR: [34, 46], elbowR: [40, 56], handR: [46, 62], kneeL: [66, 46], footL: [82, 38], kneeR: [66, 46], footR: [82, 38] },
  ],
  leg_extension: [
    { ...SEATED },
    { ...SEATED, footL: [84, 54], footR: [84, 54] },
  ],
  split_squat: [
    // Rear foot on the bench behind.
    { ...STAND, kneeL: [46, 72], footL: [44, 92], kneeR: [62, 76], footR: [74, 72] },
    { head: [50, 24], neck: [50, 34], hip: [50, 64], shoulderL: [50, 38], elbowL: [50, 52], handL: [50, 64], shoulderR: [50, 38], elbowR: [50, 52], handR: [50, 64], kneeL: [40, 78], footL: [44, 92], kneeR: [64, 84], footR: [74, 72] },
  ],
  step_up: [
    { ...STAND, kneeR: [62, 66], footR: [66, 78] },
    { head: [60, 2], neck: [60, 12], hip: [60, 42], shoulderL: [60, 16], elbowL: [60, 30], handL: [60, 42], shoulderR: [60, 16], elbowR: [60, 30], handR: [60, 42], kneeL: [56, 62], footL: [50, 78], kneeR: [64, 60], footR: [66, 78] },
  ],
  lunge: [
    { ...STAND, footL: [40, 92], kneeL: [44, 72], footR: [64, 92], kneeR: [58, 72] },
    { head: [50, 18], neck: [50, 28], hip: [50, 60], shoulderL: [50, 32], elbowL: [50, 46], handL: [50, 58], shoulderR: [50, 32], elbowR: [50, 46], handR: [50, 58], kneeL: [34, 74], footL: [34, 92], kneeR: [66, 80], footR: [72, 92] },
  ],
  // ------------------------------------------------------------- hinge --
  hinge: [
    { ...STAND, bar: true, elbowL: [50, 40], handL: [50, 54], elbowR: [50, 40], handR: [50, 54] },
    { ...HINGE, bar: true },
  ],
  deadlift: [
    // Bar on the floor, then stood up with it.
    { head: [66, 44], neck: [62, 50], hip: [40, 60], shoulderL: [64, 52], elbowL: [62, 68], handL: [60, 86], shoulderR: [64, 52], elbowR: [62, 68], handR: [60, 86], kneeL: [46, 76], footL: [50, 92], kneeR: [46, 76], footR: [50, 92], bar: true },
    { ...STAND, bar: true, elbowL: [50, 40], handL: [50, 56], elbowR: [50, 40], handR: [50, 56] },
  ],
  leg_curl: [
    // Face down on the bench, heels curling toward the glutes.
    { head: [16, 52], neck: [24, 54], hip: [54, 56], shoulderL: [28, 54], elbowL: [30, 62], handL: [30, 70], shoulderR: [28, 54], elbowR: [30, 62], handR: [30, 70], kneeL: [72, 58], footL: [88, 60], kneeR: [72, 58], footR: [88, 60] },
    { head: [16, 52], neck: [24, 54], hip: [54, 56], shoulderL: [28, 54], elbowL: [30, 62], handL: [30, 70], shoulderR: [28, 54], elbowR: [30, 62], handR: [30, 70], kneeL: [72, 58], footL: [74, 36], kneeR: [72, 58], footR: [74, 36] },
  ],
  nordic: [
    // Kneeling with the feet held, lowering the trunk forward.
    { head: [64, 22], neck: [64, 32], hip: [64, 60], shoulderL: [64, 36], elbowL: [62, 48], handL: [62, 58], shoulderR: [64, 36], elbowR: [62, 48], handR: [62, 58], kneeL: [64, 80], footL: [82, 84], kneeR: [64, 80], footR: [82, 84] },
    { head: [30, 46], neck: [36, 52], hip: [60, 66], shoulderL: [38, 54], elbowL: [30, 62], handL: [22, 70], shoulderR: [38, 54], elbowR: [30, 62], handR: [22, 70], kneeL: [64, 80], footL: [82, 84], kneeR: [64, 80], footR: [82, 84] },
  ],
  // ------------------------------------------------------------ glutes --
  hip_thrust: [
    { head: [22, 50], neck: [30, 52], hip: [56, 64], shoulderL: [32, 52], elbowL: [40, 58], handL: [48, 58], shoulderR: [32, 52], elbowR: [40, 58], handR: [48, 58], kneeL: [70, 56], footL: [78, 84], kneeR: [70, 56], footR: [78, 84], bar: true },
    { head: [22, 50], neck: [30, 52], hip: [56, 48], shoulderL: [32, 52], elbowL: [40, 50], handL: [50, 46], shoulderR: [32, 52], elbowR: [40, 50], handR: [50, 46], kneeL: [70, 52], footL: [78, 84], kneeR: [70, 52], footR: [78, 84], bar: true },
  ],
  bridge: [
    // On the floor, hips lifting to a straight line.
    { head: [14, 70], neck: [22, 70], hip: [52, 72], shoulderL: [26, 70], elbowL: [30, 76], handL: [34, 82], shoulderR: [26, 70], elbowR: [30, 76], handR: [34, 82], kneeL: [64, 54], footL: [72, 74], kneeR: [64, 54], footR: [72, 74] },
    { head: [14, 70], neck: [22, 70], hip: [52, 54], shoulderL: [26, 70], elbowL: [30, 76], handL: [34, 82], shoulderR: [26, 70], elbowR: [30, 76], handR: [34, 82], kneeL: [64, 50], footL: [72, 74], kneeR: [64, 50], footR: [72, 74] },
  ],
  kickback: [
    // Slight lean on the frame, one leg sweeping back and up.
    { head: [44, 14], neck: [46, 24], hip: [50, 52], shoulderL: [46, 28], elbowL: [38, 36], handL: [34, 44], shoulderR: [46, 28], elbowR: [38, 36], handR: [34, 44], kneeL: [50, 72], footL: [50, 92], kneeR: [50, 72], footR: [50, 92] },
    { head: [44, 14], neck: [46, 24], hip: [50, 52], shoulderL: [46, 28], elbowL: [38, 36], handL: [34, 44], shoulderR: [46, 28], elbowR: [38, 36], handR: [34, 44], kneeL: [50, 72], footL: [50, 92], kneeR: [66, 62], footR: [80, 66] },
  ],
  abduction: [
    // Seated, facing you, knees opening against the pads.
    { head: [50, 14], neck: [50, 24], hip: [50, 52], shoulderL: [44, 28], elbowL: [42, 40], handL: [44, 52], shoulderR: [56, 28], elbowR: [58, 40], handR: [56, 52], kneeL: [44, 66], footL: [44, 88], kneeR: [56, 66], footR: [56, 88] },
    { head: [50, 14], neck: [50, 24], hip: [50, 52], shoulderL: [44, 28], elbowL: [42, 40], handL: [44, 52], shoulderR: [56, 28], elbowR: [58, 40], handR: [56, 52], kneeL: [30, 64], footL: [26, 88], kneeR: [70, 64], footR: [74, 88] },
  ],
  calf_raise: [
    { ...STAND },
    { head: [50, 6], neck: [50, 16], hip: [50, 46], shoulderL: [50, 20], elbowL: [50, 34], handL: [50, 46], shoulderR: [50, 20], elbowR: [50, 34], handR: [50, 46], kneeL: [50, 66], footL: [50, 86], kneeR: [50, 66], footR: [50, 86] },
  ],
  // ------------------------------------------------------------- chest --
  horizontal_push: [
    // On the bench, head left, pressing straight up.
    { head: [16, 58], neck: [24, 58], hip: [54, 58], shoulderL: [28, 58], elbowL: [28, 46], handL: [28, 34], shoulderR: [28, 58], elbowR: [28, 46], handR: [28, 34], kneeL: [66, 66], footL: [72, 84], kneeR: [66, 66], footR: [72, 84], bar: true },
    { head: [16, 58], neck: [24, 58], hip: [54, 58], shoulderL: [28, 58], elbowL: [34, 52], handL: [28, 50], shoulderR: [28, 58], elbowR: [34, 52], handR: [28, 50], kneeL: [66, 66], footL: [72, 84], kneeR: [66, 66], footR: [72, 84], bar: true },
  ],
  incline_press: [
    // Bench at 30 degrees, pressing up and slightly back.
    { head: [20, 38], neck: [28, 44], hip: [54, 62], shoulderL: [30, 46], elbowL: [34, 42], handL: [40, 30], shoulderR: [30, 46], elbowR: [34, 42], handR: [40, 30], kneeL: [66, 70], footL: [72, 88], kneeR: [66, 70], footR: [72, 88], bar: true },
    { head: [20, 38], neck: [28, 44], hip: [54, 62], shoulderL: [30, 46], elbowL: [38, 54], handL: [32, 46], shoulderR: [30, 46], elbowR: [38, 54], handR: [32, 46], kneeL: [66, 70], footL: [72, 88], kneeR: [66, 70], footR: [72, 88], bar: true },
  ],
  seated_press: [
    // Chest press machine: seated, handles pushed forward.
    { ...SEATED, elbowL: [40, 42], handL: [48, 36], elbowR: [40, 42], handR: [48, 36] },
    { ...SEATED, elbowL: [52, 36], handL: [66, 34], elbowR: [52, 36], handR: [66, 34] },
  ],
  push_up: [
    { ...PLANK_TOP },
    { head: [14, 60], neck: [22, 62], hip: [56, 66], shoulderL: [26, 62], elbowL: [18, 72], handL: [26, 80], shoulderR: [26, 62], elbowR: [18, 72], handR: [26, 80], kneeL: [72, 72], footL: [86, 80], kneeR: [72, 72], footR: [86, 80] },
  ],
  fly: [
    // Standing at the cables, facing you, arms sweeping together.
    { ...STAND, elbowL: [30, 32], handL: [18, 36], elbowR: [70, 32], handR: [82, 36] },
    { ...STAND, elbowL: [40, 36], handL: [48, 40], elbowR: [60, 36], handR: [52, 40] },
  ],
  fly_lying: [
    // On the bench, arms opening wide then closing over the chest.
    { ...SUPINE, elbowL: [22, 46], handL: [12, 42], elbowR: [34, 46], handR: [44, 42] },
    { ...SUPINE, elbowL: [26, 48], handL: [26, 36], elbowR: [30, 48], handR: [30, 36] },
  ],
  // --------------------------------------------------------- shoulders --
  vertical_push: [
    { ...STAND, elbowL: [40, 30], handL: [42, 22], elbowR: [60, 30], handR: [58, 22], bar: true },
    { ...STAND, elbowL: [44, 14], handL: [44, 4], elbowR: [56, 14], handR: [56, 4], bar: true },
  ],
  pike_push_up: [
    // Hips high, head lowering toward the floor.
    { head: [24, 56], neck: [30, 52], hip: [56, 30], shoulderL: [32, 50], elbowL: [28, 62], handL: [24, 76], shoulderR: [32, 50], elbowR: [28, 62], handR: [24, 76], kneeL: [70, 52], footL: [82, 74], kneeR: [70, 52], footR: [82, 74] },
    { head: [20, 70], neck: [28, 62], hip: [56, 32], shoulderL: [30, 58], elbowL: [20, 68], handL: [24, 76], shoulderR: [30, 58], elbowR: [20, 68], handR: [24, 76], kneeL: [70, 52], footL: [82, 74], kneeR: [70, 52], footR: [82, 74] },
  ],
  lateral_raise: [
    { ...STAND },
    { ...STAND, elbowL: [32, 30], handL: [16, 28], elbowR: [68, 30], handR: [84, 28] },
  ],
  face_pull: [
    // Rope at face height, pulled back with the elbows high.
    { ...STAND, elbowL: [60, 28], handL: [72, 28], elbowR: [60, 28], handR: [72, 28] },
    { ...STAND, elbowL: [42, 22], handL: [54, 26], elbowR: [42, 22], handR: [54, 26] },
  ],
  rear_delt_fly: [
    { ...HINGE, elbowL: [62, 60], handL: [60, 72], elbowR: [62, 60], handR: [60, 72] },
    { ...HINGE, elbowL: [66, 44], handL: [72, 34], elbowR: [66, 44], handR: [72, 34] },
  ],
  // -------------------------------------------------------------- back --
  horizontal_pull: [
    { head: [66, 34], neck: [62, 40], hip: [40, 56], shoulderL: [60, 42], elbowL: [58, 58], handL: [56, 74], shoulderR: [60, 42], elbowR: [58, 58], handR: [56, 74], kneeL: [46, 74], footL: [50, 92], kneeR: [46, 74], footR: [50, 92], bar: true },
    { head: [66, 34], neck: [62, 40], hip: [40, 56], shoulderL: [60, 42], elbowL: [50, 50], handL: [54, 56], shoulderR: [60, 42], elbowR: [50, 50], handR: [54, 56], kneeL: [46, 74], footL: [50, 92], kneeR: [46, 74], footR: [50, 92], bar: true },
  ],
  one_arm_row: [
    // One hand braced on the bench, the other rowing to the hip.
    { head: [30, 32], neck: [36, 38], hip: [58, 48], shoulderL: [36, 40], elbowL: [34, 52], handL: [32, 64], shoulderR: [36, 40], elbowR: [40, 52], handR: [42, 66], kneeL: [58, 70], footL: [58, 92], kneeR: [58, 70], footR: [58, 92] },
    { head: [30, 32], neck: [36, 38], hip: [58, 48], shoulderL: [36, 40], elbowL: [34, 52], handL: [32, 64], shoulderR: [36, 40], elbowR: [48, 44], handR: [48, 54], kneeL: [58, 70], footL: [58, 92], kneeR: [58, 70], footR: [58, 92] },
  ],
  seated_row: [
    { head: [40, 18], neck: [40, 28], hip: [40, 56], shoulderL: [40, 32], elbowL: [50, 40], handL: [62, 44], shoulderR: [40, 32], elbowR: [50, 40], handR: [62, 44], kneeL: [56, 52], footL: [66, 66], kneeR: [56, 52], footR: [66, 66] },
    { head: [40, 18], neck: [40, 28], hip: [40, 56], shoulderL: [40, 32], elbowL: [34, 44], handL: [46, 44], shoulderR: [40, 32], elbowR: [34, 44], handR: [46, 44], kneeL: [56, 52], footL: [66, 66], kneeR: [56, 52], footR: [66, 66] },
  ],
  lat_pulldown: [
    // Seated, facing you, bar pulled to the upper chest.
    { head: [50, 14], neck: [50, 24], hip: [50, 54], shoulderL: [44, 30], elbowL: [40, 18], handL: [40, 6], shoulderR: [56, 30], elbowR: [60, 18], handR: [60, 6], kneeL: [44, 66], footL: [44, 88], kneeR: [56, 66], footR: [56, 88], bar: true },
    { head: [50, 14], neck: [50, 24], hip: [50, 54], shoulderL: [44, 30], elbowL: [36, 40], handL: [42, 30], shoulderR: [56, 30], elbowR: [64, 40], handR: [58, 30], kneeL: [44, 66], footL: [44, 88], kneeR: [56, 66], footR: [56, 88], bar: true },
  ],
  vertical_pull: [
    { ...STAND, elbowL: [42, 12], handL: [40, 2], elbowR: [58, 12], handR: [60, 2], kneeL: [48, 74], kneeR: [52, 74], bar: true },
    { head: [50, 4], neck: [50, 14], hip: [50, 44], shoulderL: [50, 18], elbowL: [38, 12], handL: [40, 2], shoulderR: [50, 18], elbowR: [62, 12], handR: [60, 2], kneeL: [48, 66], footL: [46, 84], kneeR: [52, 66], footR: [54, 84], bar: true },
  ],
  inverted_row: [
    // Hanging under a low bar, heels down, chest pulled to the bar.
    { head: [14, 60], neck: [22, 58], hip: [54, 62], shoulderL: [26, 58], elbowL: [26, 44], handL: [26, 30], shoulderR: [26, 58], elbowR: [26, 44], handR: [26, 30], kneeL: [72, 68], footL: [88, 76], kneeR: [72, 68], footR: [88, 76], bar: true },
    { head: [14, 44], neck: [22, 44], hip: [54, 52], shoulderL: [26, 44], elbowL: [32, 36], handL: [26, 30], shoulderR: [26, 44], elbowR: [32, 36], handR: [26, 30], kneeL: [72, 60], footL: [88, 76], kneeR: [72, 60], footR: [88, 76], bar: true },
  ],
  superman: [
    // Face down, arms and legs lifting off the floor together.
    { head: [14, 62], neck: [22, 62], hip: [54, 64], shoulderL: [26, 62], elbowL: [18, 62], handL: [8, 62], shoulderR: [26, 62], elbowR: [18, 62], handR: [8, 62], kneeL: [70, 64], footL: [88, 64], kneeR: [70, 64], footR: [88, 64] },
    { head: [12, 50], neck: [22, 54], hip: [54, 64], shoulderL: [26, 54], elbowL: [16, 50], handL: [6, 44], shoulderR: [26, 54], elbowR: [16, 50], handR: [6, 44], kneeL: [70, 60], footL: [88, 50], kneeR: [70, 60], footR: [88, 50] },
  ],
  // -------------------------------------------------------------- arms --
  curl: [
    { ...STAND },
    { ...STAND, elbowL: [50, 40], handL: [58, 28], elbowR: [50, 40], handR: [58, 28] },
  ],
  pushdown: [
    { ...STAND, elbowL: [50, 40], handL: [58, 32], elbowR: [50, 40], handR: [58, 32] },
    { ...STAND, elbowL: [50, 40], handL: [58, 52], elbowR: [50, 40], handR: [58, 52] },
  ],
  overhead_extension: [
    { ...STAND, elbowL: [54, 18], handL: [42, 24], elbowR: [54, 18], handR: [42, 24] },
    { ...STAND, elbowL: [54, 16], handL: [54, 2], elbowR: [54, 16], handR: [54, 2] },
  ],
  dip: [
    // Hands on the bench behind, hips dropping between the arms.
    { head: [40, 26], neck: [40, 36], hip: [42, 60], shoulderL: [40, 40], elbowL: [30, 50], handL: [26, 62], shoulderR: [40, 40], elbowR: [30, 50], handR: [26, 62], kneeL: [58, 66], footL: [70, 84], kneeR: [58, 66], footR: [70, 84] },
    { head: [40, 38], neck: [40, 48], hip: [42, 70], shoulderL: [40, 52], elbowL: [26, 50], handL: [26, 62], shoulderR: [40, 52], elbowR: [26, 50], handR: [26, 62], kneeL: [58, 72], footL: [70, 84], kneeR: [58, 72], footR: [70, 84] },
  ],
  skull_crusher: [
    // On the bench, upper arms vertical, forearms hinging back over the head.
    { ...SUPINE, elbowL: [28, 46], handL: [28, 32], elbowR: [28, 46], handR: [28, 32], bar: true },
    { ...SUPINE, elbowL: [28, 46], handL: [14, 40], elbowR: [28, 46], handR: [14, 40], bar: true },
  ],
  extension: [
    { ...STAND, elbowL: [50, 40], handL: [58, 30], elbowR: [50, 40], handR: [58, 30] },
    { ...STAND, elbowL: [50, 40], handL: [54, 54], elbowR: [50, 40], handR: [54, 54] },
  ],
  // -------------------------------------------------------------- core --
  plank: [
    { head: [14, 52], neck: [22, 54], hip: [56, 60], shoulderL: [26, 54], elbowL: [28, 70], handL: [30, 84], shoulderR: [26, 54], elbowR: [28, 70], handR: [30, 84], kneeL: [72, 70], footL: [86, 84], kneeR: [72, 70], footR: [86, 84] },
    { head: [14, 50], neck: [22, 52], hip: [56, 58], shoulderL: [26, 52], elbowL: [28, 68], handL: [30, 84], shoulderR: [26, 52], elbowR: [28, 68], handR: [30, 84], kneeL: [72, 68], footL: [86, 84], kneeR: [72, 68], footR: [86, 84] },
  ],
  side_plank: [
    // On one forearm, the other arm reaching up, hips held high.
    { head: [16, 40], neck: [24, 44], hip: [54, 52], shoulderL: [26, 46], elbowL: [24, 62], handL: [22, 74], shoulderR: [26, 46], elbowR: [30, 32], handR: [34, 20], kneeL: [72, 60], footL: [88, 70], kneeR: [72, 60], footR: [88, 70] },
    { head: [16, 42], neck: [24, 46], hip: [54, 58], shoulderL: [26, 48], elbowL: [24, 62], handL: [22, 74], shoulderR: [26, 48], elbowR: [30, 34], handR: [34, 22], kneeL: [72, 64], footL: [88, 70], kneeR: [72, 64], footR: [88, 70] },
  ],
  dead_bug: [
    // On the back, opposite arm and leg reaching away.
    { ...SUPINE, elbowL: [26, 50], handL: [26, 38], elbowR: [26, 50], handR: [26, 38], kneeL: [56, 48], footL: [66, 52], kneeR: [56, 48], footR: [66, 52] },
    { ...SUPINE, elbowL: [16, 56], handL: [6, 50], elbowR: [26, 50], handR: [26, 38], kneeL: [56, 48], footL: [66, 52], kneeR: [72, 58], footR: [92, 62] },
  ],
  knee_raise: [
    // Hanging from the bar, knees lifting toward the chest.
    { head: [50, 12], neck: [50, 22], hip: [50, 52], shoulderL: [46, 26], elbowL: [44, 14], handL: [44, 2], shoulderR: [54, 26], elbowR: [56, 14], handR: [56, 2], kneeL: [50, 72], footL: [50, 92], kneeR: [50, 72], footR: [50, 92], bar: true },
    { head: [50, 12], neck: [50, 22], hip: [50, 52], shoulderL: [46, 26], elbowL: [44, 14], handL: [44, 2], shoulderR: [54, 26], elbowR: [56, 14], handR: [56, 2], kneeL: [60, 52], footL: [56, 66], kneeR: [60, 52], footR: [56, 66], bar: true },
  ],
  kneeling_crunch: [
    // Kneeling under the cable, curling the ribs down toward the hips.
    { head: [50, 24], neck: [50, 34], hip: [50, 62], shoulderL: [50, 38], elbowL: [58, 32], handL: [54, 24], shoulderR: [50, 38], elbowR: [58, 32], handR: [54, 24], kneeL: [50, 80], footL: [36, 84], kneeR: [50, 80], footR: [36, 84] },
    { head: [62, 42], neck: [58, 48], hip: [50, 62], shoulderL: [58, 50], elbowL: [64, 48], handL: [60, 42], shoulderR: [58, 50], elbowR: [64, 48], handR: [60, 42], kneeL: [50, 80], footL: [36, 84], kneeR: [50, 80], footR: [36, 84] },
  ],
  pallof: [
    // Side-on to the cable, pressing the handle straight out and holding.
    { ...STAND, elbowL: [50, 40], handL: [58, 36], elbowR: [50, 40], handR: [58, 36] },
    { ...STAND, elbowL: [64, 38], handL: [78, 36], elbowR: [64, 38], handR: [78, 36] },
  ],
  bicycle: [
    // On the back, hands behind the head, pedalling the legs.
    { ...SUPINE, elbowL: [18, 56], handL: [12, 60], elbowR: [18, 56], handR: [12, 60], kneeL: [58, 46], footL: [64, 58], kneeR: [70, 62], footR: [88, 64] },
    { ...SUPINE, elbowL: [18, 56], handL: [12, 60], elbowR: [18, 56], handR: [12, 60], kneeL: [70, 62], footL: [88, 64], kneeR: [58, 46], footR: [64, 58] },
  ],
  crunch: [
    { head: [18, 70], neck: [26, 70], hip: [56, 72], shoulderL: [30, 70], elbowL: [26, 62], handL: [22, 64], shoulderR: [30, 70], elbowR: [26, 62], handR: [22, 64], kneeL: [66, 56], footL: [78, 72], kneeR: [66, 56], footR: [78, 72] },
    { head: [30, 52], neck: [36, 58], hip: [56, 72], shoulderL: [40, 60], elbowL: [34, 52], handL: [30, 50], shoulderR: [40, 60], elbowR: [34, 52], handR: [30, 50], kneeL: [66, 56], footL: [78, 72], kneeR: [66, 56], footR: [78, 72] },
  ],
  carry: [
    { ...STAND, footL: [42, 92], kneeL: [46, 72], footR: [58, 92], kneeR: [54, 72], handL: [46, 56], handR: [54, 56] },
    { ...STAND, footL: [58, 92], kneeL: [54, 72], footR: [42, 92], kneeR: [46, 72], handL: [46, 56], handR: [54, 56] },
  ],
  // ------------------------------------------------------ conditioning --
  jump: [
    { head: [50, 30], neck: [50, 40], hip: [44, 62], shoulderL: [50, 44], elbowL: [40, 54], handL: [34, 64], shoulderR: [50, 44], elbowR: [60, 54], handR: [66, 64], kneeL: [60, 74], footL: [50, 92], kneeR: [60, 74], footR: [50, 92] },
    { ...JUMP_TOP },
  ],
  burpee: [
    { ...PLANK_TOP },
    { ...JUMP_TOP },
  ],
  mountain_climber: [
    { ...PLANK_TOP, kneeL: [50, 64], footL: [46, 76] },
    { ...PLANK_TOP, kneeR: [50, 64], footR: [46, 76] },
  ],
  jumping_jack: [
    { ...STAND },
    { head: [50, 12], neck: [50, 22], hip: [50, 52], shoulderL: [50, 26], elbowL: [36, 16], handL: [40, 4], shoulderR: [50, 26], elbowR: [64, 16], handR: [60, 4], kneeL: [40, 72], footL: [34, 92], kneeR: [60, 72], footR: [66, 92] },
  ],
  swing: [
    // Hinge with the weight swung back between the legs, then snapped to chest height.
    { ...HINGE, elbowL: [58, 62], handL: [52, 74], elbowR: [58, 62], handR: [52, 74] },
    { ...STAND, elbowL: [62, 34], handL: [76, 30], elbowR: [62, 34], handR: [76, 30] },
  ],
  bike: [
    // Seated on the bike, hands on the bars, legs turning over.
    { head: [30, 26], neck: [36, 32], hip: [48, 54], shoulderL: [38, 34], elbowL: [50, 42], handL: [62, 44], shoulderR: [38, 34], elbowR: [50, 42], handR: [62, 44], kneeL: [58, 62], footL: [56, 80], kneeR: [44, 68], footR: [64, 74] },
    { head: [30, 26], neck: [36, 32], hip: [48, 54], shoulderL: [38, 34], elbowL: [50, 42], handL: [62, 44], shoulderR: [38, 34], elbowR: [50, 42], handR: [62, 44], kneeL: [44, 68], footL: [64, 74], kneeR: [58, 62], footR: [56, 80] },
  ],
  rower: [
    // The catch, knees bent and arms long; then the finish, legs straight and handle at the ribs.
    { head: [40, 26], neck: [42, 34], hip: [46, 58], shoulderL: [42, 38], elbowL: [54, 44], handL: [66, 48], shoulderR: [42, 38], elbowR: [54, 44], handR: [66, 48], kneeL: [58, 48], footL: [72, 64], kneeR: [58, 48], footR: [72, 64] },
    { head: [28, 32], neck: [32, 40], hip: [40, 58], shoulderL: [34, 42], elbowL: [30, 52], handL: [40, 48], shoulderR: [34, 42], elbowR: [30, 52], handR: [40, 48], kneeL: [56, 60], footL: [72, 64], kneeR: [56, 60], footR: [72, 64] },
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
