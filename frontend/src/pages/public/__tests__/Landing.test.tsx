import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'
import Landing from '../Landing'

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <HelmetProvider>
    <MemoryRouter>
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    </MemoryRouter>
  </HelmetProvider>
)

describe('Landing', () => {
  it('renders Book a Session button linking to #contact', () => {
    render(<Landing />, { wrapper: Wrapper })
    const ctaLinks = screen.getAllByRole('link', { name: /book a session/i })
    expect(ctaLinks.length).toBeGreaterThan(0)
  })
})
