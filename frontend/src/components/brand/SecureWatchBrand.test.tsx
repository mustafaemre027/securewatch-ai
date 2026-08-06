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
})
