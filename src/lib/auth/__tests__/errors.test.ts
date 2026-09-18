import { describe, expect, it } from 'vitest'
import { classifyExchangeFailure, classifyPasswordFailure, classifySendFailure, classifyVerifyFailure } from '../errors'

describe('classifySendFailure', () => {
  it('recognises the email quota by status, by code and by message', () => {
    expect(classifySendFailure({ status: 429 })).toBe('rateLimited')
    expect(classifySendFailure({ code: 'over_email_send_rate_limit' })).toBe('rateLimited')
    expect(classifySendFailure({ message: 'email rate limit exceeded' })).toBe('rateLimited')
  })

  it('names a switched-off email provider rather than blaming the network', () => {
    // Verbatim from the project's auth log: a 422 no amount of retrying fixes.
    expect(classifySendFailure({ status: 422, message: 'Email logins are disabled' })).toBe('emailDisabled')
    expect(classifySendFailure({ code: 'email_provider_disabled' })).toBe('emailDisabled')
  })

  it('still calls the quota a quota when the provider is on', () => {
    expect(classifySendFailure({ status: 429, message: 'email rate limit exceeded' })).toBe('rateLimited')
  })

  it('treats anything else as a plain send failure', () => {
    expect(classifySendFailure({ status: 500, message: 'smtp down' })).toBe('sendFailed')
    expect(classifySendFailure({})).toBe('sendFailed')
  })
})

describe('classifyVerifyFailure', () => {
  it('separates a spent code from a mistyped one', () => {
    expect(classifyVerifyFailure({ message: 'Token has expired or is invalid' })).toBe('codeExpired')
    expect(classifyVerifyFailure({ message: 'One-time token not found' })).toBe('codeExpired')
    expect(classifyVerifyFailure({ message: 'invalid token' })).toBe('codeInvalid')
    expect(classifyVerifyFailure({})).toBe('codeInvalid')
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

describe('classifyPasswordFailure', () => {
  it('names the two project settings that no retype can fix', () => {
    expect(classifyPasswordFailure({ status: 422, message: 'Email logins are disabled' })).toBe('emailDisabled')
    expect(classifyPasswordFailure({ code: 'email_not_confirmed' })).toBe('emailNotConfirmed')
    expect(classifyPasswordFailure({ code: 'signup_disabled' })).toBe('signUpDisabled')
  })

  it('gives one answer for a bad password and an unknown address', () => {
    // Supabase answers identically for both, and so does this: a form that told
    // them apart would report whether an address has an account here.
    expect(classifyPasswordFailure({ code: 'invalid_credentials' })).toBe('invalidCredentials')
    expect(classifyPasswordFailure({ message: 'Invalid login credentials' })).toBe('invalidCredentials')
  })

  it('recognises a taken address and a short password', () => {
    expect(classifyPasswordFailure({ code: 'user_already_exists' })).toBe('accountExists')
    expect(classifyPasswordFailure({ message: 'User already registered' })).toBe('accountExists')
    expect(classifyPasswordFailure({ code: 'weak_password' })).toBe('weakPassword')
  })

  it('falls back rather than guessing', () => {
    expect(classifyPasswordFailure({ status: 500 })).toBe('passwordFailed')
    expect(classifyPasswordFailure({})).toBe('passwordFailed')
  })
})
