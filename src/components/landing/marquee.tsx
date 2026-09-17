/** A slow, endless ribbon. Pure CSS; the list is doubled so the loop is seamless. */
export function Marquee({ items, label }: { items: readonly string[]; label: string }) {
  const doubled = [...items, ...items]
  return (
    <div aria-label={label} role="marquee" className="overflow-hidden border-y border-(--color-hero-surface) bg-(--color-hero-bg) py-3 text-(--color-hero-ink)">
      <ul className="marquee-track flex w-max gap-8 whitespace-nowrap font-display text-xl font-bold uppercase tracking-wide">
        {doubled.map((item, i) => (
          <li key={`${item}-${i}`} aria-hidden={i >= items.length} className="flex items-center gap-8">
            <span>{item}</span>
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-(--color-accent)" />
          </li>
        ))}
      </ul>
    </div>
  )
}
