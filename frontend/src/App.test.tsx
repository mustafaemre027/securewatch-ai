import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App Component', () => {
  it('renders initial frontend foundation content', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('SecureWatch AI')
    expect(screen.getByText('Frontend Foundation Initialized')).toBeInTheDocument()
  })
})
