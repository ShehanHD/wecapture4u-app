import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { HeroCarousel } from '../HeroCarousel'

const photos = [
  { id: '1', image_url: 'https://example.com/1.webp', position: 1 },
  { id: '2', image_url: 'https://example.com/2.webp', position: 2 },
  { id: '3', image_url: 'https://example.com/3.webp', position: 3 },
]

describe('HeroCarousel', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('renders dot indicators for each photo', () => {
    render(<HeroCarousel photos={photos} tagline={null} />)
    const dots = document.querySelectorAll('[data-testid="carousel-dot"]')
    expect(dots).toHaveLength(3)
  })

  it('renders prev and next buttons', () => {
    render(<HeroCarousel photos={photos} tagline={null} />)
    expect(screen.getByRole('button', { name: /previous/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument()
  })

  it('auto-advances after 5 seconds', () => {
    render(<HeroCarousel photos={photos} tagline={null} />)
    const firstDot = document.querySelector('[data-testid="carousel-dot"][data-active="true"]')
    expect(firstDot?.getAttribute('data-index')).toBe('0')
    act(() => vi.advanceTimersByTime(5000))
    const activeDot = document.querySelector('[data-testid="carousel-dot"][data-active="true"]')
    expect(activeDot?.getAttribute('data-index')).toBe('1')
  })
})
