import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomePage } from './HomePage';

describe('HomePage', () => {
  it('Renders the safe working area message without leaking future features', () => {
    render(<HomePage />);
    expect(screen.getByText('Güvenli Çalışma Alanı')).toBeInTheDocument();
    expect(screen.getByText(/Frontend temel altyapısı ve authentication mekanizması başarıyla kurulmuştur/i)).toBeInTheDocument();

    // Ensure no fake data or metrics are rendered
    expect(screen.queryByText(/dashboard/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/upload/i)).not.toBeInTheDocument();
  });
});
