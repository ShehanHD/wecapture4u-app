import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Appointments } from '../Appointments'

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

it('renders page heading', () => {
  render(<Appointments />, { wrapper: Wrapper })
  expect(screen.getByText('Appointments')).toBeInTheDocument()
})

it('renders calendar/list toggle buttons', () => {
  render(<Appointments />, { wrapper: Wrapper })
  expect(screen.getByText('Calendar')).toBeInTheDocument()
  expect(screen.getByText('List')).toBeInTheDocument()
})

it('opens create modal when New Appointment button is clicked', async () => {
  const user = userEvent.setup()
  render(<Appointments />, { wrapper: Wrapper })
  await user.click(screen.getByRole('button', { name: /new appointment/i }))
  expect(screen.getByRole('dialog')).toBeInTheDocument()
})
