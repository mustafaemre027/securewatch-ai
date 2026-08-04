import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SecureWatchBrand } from './SecureWatchBrand'

describe('SecureWatchBrand Component', () => {
  it('renders default logo variant with correct src and alt', () => {
    render(<SecureWatchBrand />)
    const img = screen.getByRole('img', { name: 'SecureWatch AI Logo' })
    expect(img).toHaveAttribute('src', '/brand/securewatch-ai-logo.svg')
  })

  it('renders mark variant with correct src and alt', () => {
    render(<SecureWatchBrand variant="mark" />)
    const img = screen.getByRole('img', { name: 'SecureWatch AI Icon' })
    expect(img).toHaveAttribute('src', '/brand/securewatch-ai-mark.svg')
  })

  it('supports custom alt prop', () => {
    render(<SecureWatchBrand alt="Custom Alt" />)
    expect(screen.getByRole('img', { name: 'Custom Alt' })).toBeInTheDocument()
  })
})
