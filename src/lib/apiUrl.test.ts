import { describe, expect, it } from 'vitest'
import { buildApiUrl } from './apiUrl'

describe('buildApiUrl', () => {
  it('uses the configured API URL directly', () => {
    expect(buildApiUrl('http://api.example.com/v1', 'responses')).toBe(
      'http://api.example.com/v1/responses',
    )
  })

  it('adds v1 when the configured API URL omits it', () => {
    expect(buildApiUrl('http://api.example.com', 'images/generations')).toBe(
      'http://api.example.com/v1/images/generations',
    )
  })
})
