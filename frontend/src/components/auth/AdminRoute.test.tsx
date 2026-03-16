import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AdminRoute } from '@/components/auth/AdminRoute'
import { auth } from '@/lib/auth'

beforeEach(() => localStorage.clear())

test('redirects to /login when not authenticated', () => {
  render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<div>admin content</div>} />
        </Route>
        <Route path="/login" element={<div>login page</div>} />
      </Routes>
    </MemoryRouter>
  )
  expect(screen.getByText('login page')).toBeInTheDocument()
  expect(screen.queryByText('admin content')).not.toBeInTheDocument()
})
