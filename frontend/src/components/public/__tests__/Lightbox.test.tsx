import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { Lightbox } from '../Lightbox'

const photos = [
  { id: '1', image_url: 'https://example.com/1.webp', position: 1 },
  { id: '2', image_url: 'https://example.com/2.webp', position: 2 },
]

describe('Lightbox', () => {
  it('shows photo counter', () => {
    render(<Lightbox photos={photos} initialIndex={0} onClose={() => {}} />)
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
  })

  it('ESC key closes lightbox', () => {
    const onClose = vi.fn()
    render(<Lightbox photos={photos} initialIndex={0} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('right arrow key advances to next photo', () => {
    render(<Lightbox photos={photos} initialIndex={0} onClose={() => {}} />)
    fireEvent.keyDown(document, { key: 'ArrowRight' })
    expect(screen.getByText('2 / 2')).toBeInTheDocument()
  })
})
