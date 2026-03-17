import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ClientDetail } from '../ClientDetail'

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/admin/clients/test-id']}>
        <Routes>
          <Route path="/admin/clients/:id" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

it('renders Client Detail heading', () => {
  render(<ClientDetail />, { wrapper: Wrapper })
  expect(screen.getByText('Client Detail')).toBeInTheDocument()
})
