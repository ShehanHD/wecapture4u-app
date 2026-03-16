import { auth } from '@/lib/auth'

beforeEach(() => localStorage.clear())

test('setTokens stores both tokens', () => {
  auth.setTokens('access123', 'refresh456')
  expect(auth.getAccessToken()).toBe('access123')
  expect(auth.getRefreshToken()).toBe('refresh456')
})

test('clearTokens removes both tokens', () => {
  auth.setTokens('a', 'b')
  auth.clearTokens()
  expect(auth.getAccessToken()).toBeNull()
  expect(auth.getRefreshToken()).toBeNull()
})

test('isAuthenticated returns false when no token', () => {
  expect(auth.isAuthenticated()).toBe(false)
})

test('isAuthenticated returns true when token set', () => {
  auth.setTokens('token', 'refresh')
  expect(auth.isAuthenticated()).toBe(true)
})
