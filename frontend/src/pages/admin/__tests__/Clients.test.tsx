import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Clients } from '../Clients'

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, enabled: false } } })
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

it('renders Clients heading', () => {
  render(<Clients />, { wrapper: Wrapper })
  expect(screen.getByText('Clients')).toBeInTheDocument()
})

it('renders search input', () => {
  render(<Clients />, { wrapper: Wrapper })
  expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()
})

it('renders New Client button', () => {
  render(<Clients />, { wrapper: Wrapper })
  expect(screen.getByRole('button', { name: /new client/i })).toBeInTheDocument()
})
