import type { Units } from '@/domain/profile/types'

const KG_PER_LB = 0.45359237

/** A stored kilogram load in the athlete's unit, to the half kilo or whole pound. */
export const displayLoad = (kg: number, units: Units): number => (units === 'imperial' ? Math.round(kg / KG_PER_LB) : Math.round(kg * 2) / 2)
export const unitLabel = (units: Units): string => (units === 'imperial' ? 'lb' : 'kg')
export const toKg = (value: number, units: Units): number => (units === 'imperial' ? value * KG_PER_LB : value)
