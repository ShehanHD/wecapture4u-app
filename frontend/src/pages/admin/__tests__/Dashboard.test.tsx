import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Dashboard } from '../Dashboard'

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

it('renders dashboard heading', () => {
  render(<Dashboard />, { wrapper: Wrapper })
  expect(screen.getByText('Dashboard')).toBeInTheDocument()
})

it('renders stat card labels', () => {
  render(<Dashboard />, { wrapper: Wrapper })
  expect(screen.getByText('Revenue this month')).toBeInTheDocument()
  expect(screen.getByText('Active jobs')).toBeInTheDocument()
  expect(screen.getByText('Total clients')).toBeInTheDocument()
  expect(screen.getByText('Unpaid invoices')).toBeInTheDocument()
})
