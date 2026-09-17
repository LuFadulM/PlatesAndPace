import { describe, expect, it } from 'vitest'
import { median, weeklyReview, type WeekSummary } from '..'

function week(overrides: Partial<WeekSummary> = {}): WeekSummary {
  return {
    plannedSessions: 5,
    completedSessions: 5,
    rpeSamples: [
      { logged: 8, target: 8 },
      { logged: 8, target: 8 },
      { logged: 8, target: 8 },
    ],
    ...overrides,
  }
}

describe('median', () => {
  it('handles odd and even counts', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
  })

  it('returns null for nothing', () => {
    expect(median([])).toBeNull()
  })

  it('does not mutate its input', () => {
    const values = [3, 1, 2]
    median(values)
    expect(values).toEqual([3, 1, 2])
  })
})

describe('weeklyReview', () => {
  it('leaves a week that went to plan alone', () => {
    const outcome = weeklyReview(week())

    expect(outcome.verdict).toBe('on_track')
    expect(outcome.volumeMultiplier).toBe(1)
    expect(outcome.loadMultiplier).toBe(1)
  })

  it('cuts volume when most sessions were missed', () => {
    const outcome = weeklyReview(week({ completedSessions: 2 }))

    expect(outcome.verdict).toBe('struggling')
    expect(outcome.volumeMultiplier).toBe(0.85)
    // Loads hold: the problem was finding the time, not the weight.
    expect(outcome.loadMultiplier).toBe(1)
  })

  it('treats missed sessions as the stronger signal than a high RPE', () => {
    // Two hard sessions out of five is not a reason to also judge the effort.
    const outcome = weeklyReview({
      plannedSessions: 5,
      completedSessions: 2,
      rpeSamples: [
        { logged: 10, target: 8 },
        { logged: 10, target: 8 },
      ],
    })

    expect(outcome.verdict).toBe('struggling')
  })

  it('cuts volume but holds load when the week was a grind', () => {
    const outcome = weeklyReview(
      week({
        rpeSamples: [
          { logged: 9.5, target: 8 },
          { logged: 10, target: 8 },
          { logged: 9.5, target: 8 },
        ],
      }),
    )

    expect(outcome.verdict).toBe('grinding')
    expect(outcome.volumeMultiplier).toBe(0.9)
    expect(outcome.loadMultiplier).toBe(1)
  })

  it('steps things up when everything was hit easily', () => {
    const outcome = weeklyReview(
      week({
        rpeSamples: [
          { logged: 7, target: 8 },
          { logged: 6.5, target: 8 },
          { logged: 7, target: 8 },
        ],
      }),
    )

    expect(outcome.verdict).toBe('thriving')
    expect(outcome.loadMultiplier).toBeGreaterThan(1)
    expect(outcome.extraFocusSets).toBe(1)
  })

  it('does not step up an easy week that was half skipped', () => {
    const outcome = weeklyReview(
      week({
        completedSessions: 3,
        rpeSamples: [
          { logged: 6, target: 8 },
          { logged: 6, target: 8 },
        ],
      }),
    )

    expect(outcome.verdict).toBe('on_track')
    expect(outcome.loadMultiplier).toBe(1)
  })

  it('is not swayed by a single mis-tapped RPE', () => {
    // One 10 among sevens: the mean would read as grinding, the median does not.
    const outcome = weeklyReview(
      week({
        rpeSamples: [
          { logged: 7, target: 8 },
          { logged: 7, target: 8 },
          { logged: 7, target: 8 },
          { logged: 7, target: 8 },
          { logged: 10, target: 8 },
        ],
      }),
    )

    expect(outcome.verdict).not.toBe('grinding')
  })

  it('copes with a week where nothing was logged', () => {
    const outcome = weeklyReview({
      plannedSessions: 4,
      completedSessions: 4,
      rpeSamples: [],
    })

    expect(outcome.medianRpeDelta).toBeNull()
    expect(outcome.verdict).toBe('on_track')
    expect(outcome.volumeMultiplier).toBe(1)
  })

  it('treats a week with nothing planned as complete rather than dividing by zero', () => {
    const outcome = weeklyReview({ plannedSessions: 0, completedSessions: 0, rpeSamples: [] })

    expect(Number.isFinite(outcome.completionRate)).toBe(true)
    expect(outcome.completionRate).toBe(1)
  })

  it('reports the completion rate it decided on', () => {
    expect(weeklyReview(week({ completedSessions: 4 })).completionRate).toBeCloseTo(0.8, 9)
  })

  it('returns message keys, never prose', () => {
    const summaries = [
      week(),
      week({ completedSessions: 1 }),
      week({ rpeSamples: [{ logged: 10, target: 8 }] }),
      week({ rpeSamples: [{ logged: 6, target: 8 }] }),
    ]

    for (const summary of summaries) {
      expect(weeklyReview(summary).messageKey).toMatch(/^coach\.review\.[A-Za-z]+$/)
    }
  })
})
