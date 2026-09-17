import { describe, expect, it } from 'vitest'
import { fromISODate } from '../../dates'
import { buildAthleteModel, UnderageError, patternsForInjury } from '../athlete'
import { questionnaireSchema, type QuestionnaireAnswers } from '../questionnaire'

const TODAY = fromISODate('2026-09-15')

function answers(overrides: Partial<QuestionnaireAnswers> = {}): QuestionnaireAnswers {
  const base = {
    basics: {
      displayName: 'Ana',
      locale: 'es' as const,
      timezone: 'America/Bogota',
      units: 'metric' as const,
    },
    body: {
      sex: 'female' as const,
      birthDate: '1998-04-02',
      heightCm: 166,
      weightKg: 62,
    },
    health: {
      heartCondition: false,
      chestPain: false,
      dizziness: false,
      jointProblem: false,
      bloodPressureMedication: false,
      pregnancy: false,
      other: false,
    },
    goals: { primary: 'hybrid' as const, targetRace: '10k' as const },
    experience: {
      lifting: '1_to_3_years' as const,
      knowsBigLifts: true,
      recentRun: { km: 3, minutes: 20 },
    },
    schedule: {
      gymDays: [1, 2, 3, 4, 5],
      runDays: [2, 4, 6],
      longRunDay: 6,
      sessionMinutes: 60 as const,
      startDate: '2026-09-14',
      blockWeeks: 8 as const,
    },
    equipment: { setting: 'full_gym' as const, unavailableMachines: [] },
    injuries: { areas: [], note: '' },
    preferences: { focusAreas: ['back' as const], intensity: 'hard' as const, avoidExerciseIds: [] },
  }

  return questionnaireSchema.parse({ ...base, ...overrides })
}

describe('questionnaire validation', () => {
  it('accepts a complete set of answers', () => {
    expect(() => answers()).not.toThrow()
  })

  it('requires a target distance for a running goal', () => {
    expect(() =>
      answers({ goals: { primary: 'endurance' } as unknown as QuestionnaireAnswers['goals'] }),
    ).toThrow()
  })

  it('requires either a recent run or a continuous-minutes answer', () => {
    expect(() =>
      answers({
        experience: {
          lifting: 'none',
          knowsBigLifts: false,
        } as QuestionnaireAnswers['experience'],
      }),
    ).toThrow()
  })

  it('accepts someone who cannot yet run continuously', () => {
    expect(() =>
      answers({
        experience: {
          lifting: 'none',
          knowsBigLifts: false,
          continuousRunMinutes: 2,
        } as QuestionnaireAnswers['experience'],
      }),
    ).not.toThrow()
  })

  it('rejects a long run that is not on a run day', () => {
    expect(() =>
      answers({
        schedule: {
          gymDays: [1, 3, 5],
          runDays: [2, 4],
          longRunDay: 6,
          sessionMinutes: 60,
          startDate: '2026-09-14',
          blockWeeks: 8,
        } as unknown as QuestionnaireAnswers['schedule'],
      }),
    ).toThrow()
  })

  it('rejects a duplicated gym day', () => {
    expect(() =>
      answers({
        schedule: {
          gymDays: [1, 1, 3],
          runDays: [],
          sessionMinutes: 60,
          startDate: '2026-09-14',
          blockWeeks: 8,
        } as unknown as QuestionnaireAnswers['schedule'],
      }),
    ).toThrow()
  })

  it('rejects fewer than two or more than six gym days', () => {
    for (const gymDays of [[1], [1, 2, 3, 4, 5, 6, 7]]) {
      expect(() =>
        answers({
          schedule: {
            gymDays,
            runDays: [],
            sessionMinutes: 60,
            startDate: '2026-09-14',
            blockWeeks: 8,
          } as unknown as QuestionnaireAnswers['schedule'],
        }),
      ).toThrow()
    }
  })
})

describe('buildAthleteModel', () => {
  it('derives age in whole years from the birth date', () => {
    expect(buildAthleteModel(answers(), TODAY).ageYears).toBe(28)
  })

  it('does not count a birthday that has not happened yet this year', () => {
    const model = buildAthleteModel(
      answers({ body: { ...answers().body, birthDate: '1998-12-31' } }),
      TODAY,
    )
    expect(model.ageYears).toBe(27)
  })

  it('refuses anyone under 16', () => {
    expect(() =>
      buildAthleteModel(answers({ body: { ...answers().body, birthDate: '2012-01-01' } }), TODAY),
    ).toThrow(UnderageError)
  })

  it('protects a 17-year-old from deficits and maximal sets', () => {
    const model = buildAthleteModel(
      answers({ body: { ...answers().body, birthDate: '2009-01-01' } }),
      TODAY,
    )

    expect(model.isMinor).toBe(true)
    expect(model.allowCalorieDeficit).toBe(false)
    expect(model.maxRpe).toBe(8)
  })

  it('leaves an adult unrestricted', () => {
    const model = buildAthleteModel(answers(), TODAY)

    expect(model.isMinor).toBe(false)
    expect(model.allowCalorieDeficit).toBe(true)
    expect(model.maxRpe).toBe(10)
    expect(model.conservativeMode).toBe(false)
  })

  it('turns any PAR-Q yes into a careful start and a clearance notice', () => {
    const model = buildAthleteModel(
      answers({ health: { ...answers().health, chestPain: true } }),
      TODAY,
    )

    expect(model.needsMedicalClearance).toBe(true)
    expect(model.conservativeMode).toBe(true)
    expect(model.maxRpe).toBe(8)
    expect(model.allowCalorieDeficit).toBe(false)
  })

  it('maps injuries to movement patterns, not exercise names', () => {
    const model = buildAthleteModel(
      answers({ injuries: { areas: ['knees', 'shoulders'], note: 'old ACL' } }),
      TODAY,
    )

    expect(model.bannedPatterns.has('deep_knee_flexion')).toBe(true)
    expect(model.bannedPatterns.has('overhead_press')).toBe(true)
    expect(model.bannedPatterns.has('spinal_loading')).toBe(false)
  })

  it('merges overlapping patterns from several injuries without duplicating', () => {
    const model = buildAthleteModel(
      answers({ injuries: { areas: ['knees', 'hips'], note: '' } }),
      TODAY,
    )

    // Both knees and hips rule out loaded lunges.
    expect(model.bannedPatterns.has('loaded_lunge')).toBe(true)
    expect([...model.bannedPatterns].filter((p) => p === 'loaded_lunge')).toHaveLength(1)
  })

  it('converts a recent run into seconds for the running engine', () => {
    expect(buildAthleteModel(answers(), TODAY).recentRun).toEqual({ km: 3, seconds: 1200 })
  })

  it('sorts the training days so the calendar can rely on the order', () => {
    const model = buildAthleteModel(
      answers({
        schedule: {
          gymDays: [5, 1, 3],
          runDays: [6, 2],
          longRunDay: 6,
          sessionMinutes: 60,
          startDate: '2026-09-14',
          blockWeeks: 8,
        } as unknown as QuestionnaireAnswers['schedule'],
      }),
      TODAY,
    )

    expect(model.gymDays).toEqual([1, 3, 5])
    expect(model.runDays).toEqual([2, 6])
  })

  it('maps lifting experience to a training tier', () => {
    const tiers = (['none', 'under_1_year', '1_to_3_years', '3_plus_years'] as const).map(
      (lifting) =>
        buildAthleteModel(
          answers({ experience: { ...answers().experience, lifting } }),
          TODAY,
        ).tier,
    )

    expect(tiers).toEqual(['beginner', 'beginner', 'intermediate', 'advanced'])
  })
})

describe('patternsForInjury', () => {
  it('covers every documented area', () => {
    for (const area of ['knees', 'lower_back', 'shoulders', 'hips', 'wrists', 'neck'] as const) {
      expect(patternsForInjury(area).length).toBeGreaterThan(0)
    }
  })
})
