'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatPace, fromISODate, formatWeekdayShort } from '@/domain/dates'
import type { ProgressData } from '@/lib/data/progress'

/**
 * Charts follow the dataviz rules: one form per job, one axis per chart (never
 * dual), series colours in a fixed validated order, thin marks, a hover layer,
 * a legend only when there are two or more series, and a table view under
 * every chart so nothing is colour-alone.
 */
const SERIES = ['var(--color-chart-1)', 'var(--color-chart-2)', 'var(--color-chart-3)', 'var(--color-chart-4)']
const ink = 'var(--color-ink-muted)'
const grid = 'var(--color-border)'
const shortWeek = (iso: string) => `${fromISODate(iso).day}/${fromISODate(iso).month}`

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-(--color-border) bg-(--color-surface) p-4">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  )
}

function DataTable({ caption, head, rows }: { caption: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="mt-2 text-xs">
      <summary className="min-h-11 cursor-pointer text-(--color-ink-muted)">{caption}</summary>
      <table className="mt-1 w-full"><thead><tr>{head.map((h) => <th key={h} scope="col" className="text-left font-semibold">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-(--color-border)">{r.map((c, j) => <td key={j} className="py-1 tabular-nums">{c}</td>)}</tr>)}</tbody></table>
    </details>
  )
}

const tooltipStyle = { contentStyle: { background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, color: 'var(--color-ink)', fontSize: 12 }, labelStyle: { color: 'var(--color-ink)' }, itemStyle: { color: 'var(--color-ink)' } }

export function ProgressCharts({ data }: { data: ProgressData }) {
  const t = useTranslations('progress')
  const tEx = useTranslations('exercises')
  const tM = useTranslations('muscles')
  const locale = useLocale()

  const liftWeeks = [...new Set(data.lifts.flatMap((l) => l.points.map((p) => p.week)))].sort()
  const liftRows = liftWeeks.map((week) => {
    const row: Record<string, string | number> = { week }
    for (const l of data.lifts) row[l.exerciseId] = l.points.find((p) => p.week === week)?.e1rm ?? ''
    return row
  })

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-(--color-border) bg-(--color-surface) p-4"><p className="text-xs uppercase text-(--color-ink-muted)">{t('streak')}</p><p className="font-display text-4xl font-bold">{data.streak}</p></div>
        <div className="rounded-xl border border-(--color-border) bg-(--color-surface) p-4"><p className="text-xs uppercase text-(--color-ink-muted)">{t('thisWeek')}</p><p className="font-display text-4xl font-bold">{data.sessionsPerWeek.at(-1)?.value ?? 0}</p></div>
      </div>

      <Card title={t('sessionsPerWeek')}>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data.sessionsPerWeek} margin={{ left: -20, right: 8 }}>
            <CartesianGrid vertical={false} stroke={grid} />
            <XAxis dataKey="week" tickFormatter={shortWeek} tick={{ fill: ink, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: ink, fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip {...tooltipStyle} labelFormatter={(v) => shortWeek(String(v))} formatter={(v) => [v, t('sessions')]} cursor={{ fill: 'var(--color-surface-2)' }} />
            <Bar dataKey="value" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
        <DataTable caption={t('table')} head={[t('week'), t('sessions')]} rows={data.sessionsPerWeek.map((p) => [shortWeek(p.week), p.value])} />
      </Card>

      {data.lifts.length > 0 && (
        <Card title={t('e1rm')}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={liftRows} margin={{ left: -10, right: 8 }}>
              <CartesianGrid vertical={false} stroke={grid} />
              <XAxis dataKey="week" tickFormatter={shortWeek} tick={{ fill: ink, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: ink, fontSize: 11 }} axisLine={false} tickLine={false} unit=" kg" />
              <Tooltip {...tooltipStyle} labelFormatter={(v) => shortWeek(String(v))} />
              {data.lifts.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: 'var(--color-ink)' }} />}
              {data.lifts.map((l, i) => <Line key={l.exerciseId} type="monotone" dataKey={l.exerciseId} name={tEx(`${l.exerciseId}.name`)} stroke={SERIES[i]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: 'var(--color-surface)' }} connectNulls />)}
            </LineChart>
          </ResponsiveContainer>
          <DataTable caption={t('table')} head={[t('week'), ...data.lifts.map((l) => tEx(`${l.exerciseId}.name`))]} rows={liftRows.map((r) => [shortWeek(String(r.week)), ...data.lifts.map((l) => r[l.exerciseId] ?? '')])} />
        </Card>
      )}

      {data.weeklyVolume.length > 0 && (
        <Card title={t('weeklyVolume')}>
          <ResponsiveContainer width="100%" height={Math.max(180, data.weeklyVolume.length * 40)}>
            <BarChart data={data.weeklyVolume} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid horizontal={false} stroke={grid} />
              <XAxis type="number" allowDecimals={false} tick={{ fill: ink, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="muscle" tickFormatter={(m) => tM(m)} width={90} tick={{ fill: ink, fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} labelFormatter={(m) => tM(String(m))} formatter={(v, name) => [v, name === 'sets' ? t('sets') : name === 'mev' ? t('mev') : t('mrv')]} cursor={{ fill: 'var(--color-surface-2)' }} />
              <Legend wrapperStyle={{ fontSize: 12, color: 'var(--color-ink)' }} formatter={(v) => (v === 'sets' ? t('sets') : v === 'mev' ? t('mev') : t('mrv'))} />
              <Bar dataKey="sets" fill={SERIES[0]} radius={[0, 4, 4, 0]} maxBarSize={14} />
              <Bar dataKey="mev" fill={SERIES[2]} radius={[0, 4, 4, 0]} maxBarSize={6} />
              <Bar dataKey="mrv" fill={SERIES[3]} radius={[0, 4, 4, 0]} maxBarSize={6} />
            </BarChart>
          </ResponsiveContainer>
          <p className="mt-1 text-xs text-(--color-ink-muted)">{t('landmarksHelp')}</p>
          <DataTable caption={t('table')} head={[t('muscle'), t('sets'), t('mev'), t('mrv')]} rows={data.weeklyVolume.map((v) => [tM(v.muscle), v.sets, v.mev, v.mrv])} />
        </Card>
      )}

      {data.runs.length > 0 && (
        <>
          <Card title={t('runDistance')}>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.runs} margin={{ left: -20, right: 8 }}>
                <CartesianGrid vertical={false} stroke={grid} />
                <XAxis dataKey="date" tickFormatter={(d) => formatWeekdayShort(fromISODate(String(d)), locale)} tick={{ fill: ink, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: ink, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip {...tooltipStyle} formatter={(v) => [`${v} km`, t('distance')]} cursor={{ fill: 'var(--color-surface-2)' }} />
                <Bar dataKey="km" fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card title={t('runPace')}>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={data.runs} margin={{ left: -10, right: 8 }}>
                <CartesianGrid vertical={false} stroke={grid} />
                <XAxis dataKey="date" tickFormatter={(d) => formatWeekdayShort(fromISODate(String(d)), locale)} tick={{ fill: ink, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis reversed tickFormatter={(v) => formatPace(Number(v), locale)} tick={{ fill: ink, fontSize: 11 }} axisLine={false} tickLine={false} width={48} />
                <Tooltip {...tooltipStyle} formatter={(v) => [`${formatPace(Number(v), locale)} /km`, t('pace')]} />
                <Line type="monotone" dataKey="paceSecPerKm" stroke={SERIES[1]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: 'var(--color-surface)' }} />
              </LineChart>
            </ResponsiveContainer>
            <DataTable caption={t('table')} head={[t('date'), t('distance'), t('pace')]} rows={data.runs.map((r) => [r.date, `${r.km} km`, formatPace(r.paceSecPerKm, locale)])} />
          </Card>
        </>
      )}

      {data.body.some((b) => b.weightKg !== null) && (
        <Card title={t('bodyweight')}>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={data.body.filter((b) => b.weightKg !== null)} margin={{ left: -10, right: 8 }}>
              <CartesianGrid vertical={false} stroke={grid} />
              <XAxis dataKey="date" tickFormatter={(d) => shortWeek(String(d))} tick={{ fill: ink, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={['auto', 'auto']} tick={{ fill: ink, fontSize: 11 }} axisLine={false} tickLine={false} unit=" kg" />
              <Tooltip {...tooltipStyle} />
              <Line type="monotone" dataKey="weightKg" name={t('bodyweight')} stroke={SERIES[2]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: 'var(--color-surface)' }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}
      {data.body.some((b) => b.waistCm !== null) && (
        <Card title={t('waist')}>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={data.body.filter((b) => b.waistCm !== null)} margin={{ left: -10, right: 8 }}>
              <CartesianGrid vertical={false} stroke={grid} />
              <XAxis dataKey="date" tickFormatter={(d) => shortWeek(String(d))} tick={{ fill: ink, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={['auto', 'auto']} tick={{ fill: ink, fontSize: 11 }} axisLine={false} tickLine={false} unit=" cm" />
              <Tooltip {...tooltipStyle} />
              <Line type="monotone" dataKey="waistCm" name={t('waist')} stroke={SERIES[3]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: 'var(--color-surface)' }} />
            </LineChart>
          </ResponsiveContainer>
          <DataTable caption={t('table')} head={[t('date'), t('bodyweight'), t('waist')]} rows={data.body.map((b) => [b.date, b.weightKg ?? '', b.waistCm ?? ''])} />
        </Card>
      )}

      {data.sessionsPerWeek.every((p) => p.value === 0) && data.runs.length === 0 && <p className="text-sm text-(--color-ink-muted)">{t('empty')}</p>}
    </div>
  )
}
