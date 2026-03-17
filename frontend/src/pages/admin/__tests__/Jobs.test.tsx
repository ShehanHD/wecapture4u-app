import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Jobs } from '../Jobs'

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

it('renders Jobs heading', () => {
  render(<Jobs />, { wrapper: Wrapper })
  expect(screen.getByText('Jobs')).toBeInTheDocument()
})

it('renders New Job button', () => {
  render(<Jobs />, { wrapper: Wrapper })
  expect(screen.getByRole('button', { name: /new job/i })).toBeInTheDocument()
})
