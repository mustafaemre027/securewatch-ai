import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { App } from './App';
import { AuthProvider } from './features/auth/AuthProvider';

vi.mock('./features/auth/authApi', () => ({
  login: vi.fn(),
}));

describe('App Component', () => {
  it('renders routing application and redirects to login by default', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    );
    expect(screen.getByText('Platform Girişi')).toBeInTheDocument();
  });
});
