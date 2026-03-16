import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AdminShell } from '../AdminShell'

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/admin']}>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

it('renders nav links', () => {
  render(<AdminShell />, { wrapper: Wrapper })
  expect(screen.getByText('Dashboard')).toBeInTheDocument()
  expect(screen.getByText('Appointments')).toBeInTheDocument()
  expect(screen.getByText('Jobs')).toBeInTheDocument()
  expect(screen.getByText('Clients')).toBeInTheDocument()
  expect(screen.getByText('Accounting')).toBeInTheDocument()
  expect(screen.getByText('Settings')).toBeInTheDocument()
})

it('renders notification bell', () => {
  render(<AdminShell />, { wrapper: Wrapper })
  expect(screen.getByLabelText('Notifications')).toBeInTheDocument()
})
