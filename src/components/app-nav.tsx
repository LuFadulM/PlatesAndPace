'use client'

import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'

const TABS = [
  { href: '/today', key: 'today' },
  { href: '/plan', key: 'plan' },
  { href: '/progress', key: 'progress' },
  { href: '/library', key: 'library' },
  { href: '/settings', key: 'settings' },
] as const

export function AppNav() {
  const t = useTranslations('nav')
  const pathname = usePathname()

  return (
    <nav
      aria-label={t('primary')}
      className="fixed inset-x-0 bottom-0 z-20 border-t border-(--color-border) bg-(--color-surface) pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-md">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`)
          return (
            <li key={tab.key} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold uppercase tracking-wide ${
                  active ? 'text-(--color-plate-blue)' : 'text-(--color-ink-muted)'
                }`}
              >
                <span aria-hidden="true" className={`h-1.5 w-6 rounded-full ${active ? 'bg-(--color-plate-blue)' : 'bg-transparent'}`} />
                {t(tab.key)}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
