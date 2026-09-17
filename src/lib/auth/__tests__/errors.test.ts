import { describe, expect, it } from 'vitest'
import { classifyExchangeFailure, classifySendFailure } from '../errors'

describe('classifySendFailure', () => {
  it('recognises the email quota by status, by code and by message', () => {
    expect(classifySendFailure({ status: 429 })).toBe('rateLimited')
    expect(classifySendFailure({ code: 'over_email_send_rate_limit' })).toBe('rateLimited')
    expect(classifySendFailure({ message: 'email rate limit exceeded' })).toBe('rateLimited')
  })

  it('treats anything else as a plain send failure', () => {
    expect(classifySendFailure({ status: 500, message: 'smtp down' })).toBe('sendFailed')
    expect(classifySendFailure({})).toBe('sendFailed')
  })
})

describe('classifyExchangeFailure', () => {
  it('spots a link opened in a browser other than the one that asked for it', () => {
    expect(classifyExchangeFailure({ message: 'invalid request: both auth code and code verifier should be non-empty' })).toBe('other_device')
  })

  it('leaves a consumed or expired link as a plain exchange failure', () => {
    expect(classifyExchangeFailure({ message: 'invalid flow state, no valid flow state found' })).toBe('exchange_failed')
    expect(classifyExchangeFailure({})).toBe('exchange_failed')
  })
})
