import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Portfolio from '../Portfolio'

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  </MemoryRouter>
)

describe('Portfolio admin page', () => {
  it('renders all 5 tabs', () => {
    render(<Portfolio />, { wrapper: Wrapper })
    expect(screen.getByRole('tab', { name: /Hero Carousel/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Categories/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Category Photos/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /About/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /Contact Submissions/i })).toBeInTheDocument()
  })
})
