import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SecureWatchBrand } from './SecureWatchBrand'

describe('SecureWatchBrand Component', () => {
  it('renders default dark logo variant with correct src and lazy loading', () => {
    const { container } = render(<SecureWatchBrand />)
    const img = screen.getByRole('img', { name: 'SecureWatch AI' })
    expect(img).toHaveAttribute('src', '/brand/securewatch-ai-logo-dark.png')
    expect(img).toHaveAttribute('loading', 'lazy')
    // Ensure no extra text or old SVG elements are rendered, just an img tag
    expect(container.querySelectorAll('img').length).toBe(1)
    expect(container.textContent).toBe('')
  })

  it('renders light full logo with correct path', () => {
    render(<SecureWatchBrand variant="light" />)
    const img = screen.getByRole('img', { name: 'SecureWatch AI' })
    expect(img).toHaveAttribute('src', '/brand/securewatch-ai-logo-light.png')
  })

  it('renders dark compact mark with correct path', () => {
    render(<SecureWatchBrand variant="dark" compact />)
    const img = screen.getByRole('img', { name: 'SecureWatch AI' })
    expect(img).toHaveAttribute('src', '/brand/securewatch-ai-mark-dark.png')
  })

  it('renders light compact mark with correct path', () => {
    render(<SecureWatchBrand variant="light" compact />)
    const img = screen.getByRole('img', { name: 'SecureWatch AI' })
    expect(img).toHaveAttribute('src', '/brand/securewatch-ai-mark-light.png')
  })

  it('supports custom alt and ariaHidden correctly', () => {
    const { rerender } = render(<SecureWatchBrand alt="Custom Alt" />)
    expect(screen.getByRole('img', { name: 'Custom Alt' })).toBeInTheDocument()

    rerender(<SecureWatchBrand ariaHidden />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument() // aria-hidden removes it from accessibility tree
    const img = document.querySelector('img')
    expect(img).toHaveAttribute('aria-hidden', 'true')
    expect(img).toHaveAttribute('alt', '')
  })

  it('preserves given className', () => {
    render(<SecureWatchBrand className="custom-class-123" />)
    const img = screen.getByRole('img', { name: 'SecureWatch AI' })
    expect(img).toHaveClass('custom-class-123')
  })

  it('applies eager loading attributes when eager is true', () => {
    render(<SecureWatchBrand eager />)
    const img = screen.getByRole('img', { name: 'SecureWatch AI' })
    expect(img).toHaveAttribute('loading', 'eager')
    // fetchPriority is reflected as an attribute in some versions, or React prop
    expect(img.getAttribute('fetchpriority')).toBe('high')
  })

  it('does not apply inline width/height/max-width styles that break caller sizing', () => {
    render(<SecureWatchBrand />)
    const img = screen.getByRole('img', { name: 'SecureWatch AI' })
    expect(img.style.width).toBe('')
    expect(img.style.maxWidth).toBe('')
    expect(img.style.height).toBe('')
  })

  it('has correct intrinsic width and height for variants', () => {
    const { rerender } = render(<SecureWatchBrand variant="dark" />)
    let img = screen.getByRole('img', { name: 'SecureWatch AI' })
    expect(img).toHaveAttribute('width', '915')
    expect(img).toHaveAttribute('height', '245')

    rerender(<SecureWatchBrand variant="light" />)
    img = screen.getByRole('img', { name: 'SecureWatch AI' })
    expect(img).toHaveAttribute('width', '960')
    expect(img).toHaveAttribute('height', '225')

    rerender(<SecureWatchBrand variant="dark" compact />)
    img = screen.getByRole('img', { name: 'SecureWatch AI' })
    expect(img).toHaveAttribute('width', '256')
    expect(img).toHaveAttribute('height', '256')

    rerender(<SecureWatchBrand variant="light" compact />)
    img = screen.getByRole('img', { name: 'SecureWatch AI' })
    expect(img).toHaveAttribute('width', '185')
    expect(img).toHaveAttribute('height', '210')
  })
})
