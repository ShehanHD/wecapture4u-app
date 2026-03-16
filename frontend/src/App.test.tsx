import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'

function TestWrapper({ children }: { children: React.ReactNode }) {
  const testClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <HelmetProvider>
      <QueryClientProvider client={testClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>
  )
}

test('renders without crashing', () => {
  render(<TestWrapper><div>test</div></TestWrapper>)
  expect(screen.getByText('test')).toBeInTheDocument()
})
