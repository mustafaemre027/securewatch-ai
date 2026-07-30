import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App Component', () => {
  it('renders initial frontend foundation and brand content', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('SecureWatch AI')
    expect(screen.getByRole('img', { name: 'SecureWatch AI Logo' })).toBeInTheDocument()
    expect(screen.getByText(/Frontend foundation & design system initialized/i)).toBeInTheDocument()
  })
})
