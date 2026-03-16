import React from 'react'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from '../StatusBadge'

it('renders pending badge', () => {
  render(<StatusBadge status="pending" />)
  expect(screen.getByText('Pending')).toBeInTheDocument()
})

it('renders confirmed badge with correct color class', () => {
  const { container } = render(<StatusBadge status="confirmed" />)
  expect(container.firstChild).toHaveClass('bg-emerald-500')
})

it('renders cancelled badge', () => {
  render(<StatusBadge status="cancelled" />)
  expect(screen.getByText('Cancelled')).toBeInTheDocument()
})
