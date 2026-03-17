import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { JobDetail } from '../JobDetail'

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/admin/jobs/test-id']}>
        <Routes>
          <Route path="/admin/jobs/:id" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

it('renders job detail heading', () => {
  render(<JobDetail />, { wrapper: Wrapper })
  expect(screen.getByText('Job Detail')).toBeInTheDocument()
})
