import { defineRouting } from 'next-intl/routing'

export const locales = ['en', 'es'] as const
export type Locale = (typeof locales)[number]
export const defaultLocale: Locale = 'es'

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'always',
})

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value)
}
