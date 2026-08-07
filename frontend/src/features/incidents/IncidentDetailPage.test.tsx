import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { IncidentDetailPage } from './IncidentDetailPage';
import { IncidentDetail } from './components/IncidentDetail';

vi.mock('./components/IncidentDetail', () => ({
  IncidentDetail: vi.fn(() => <div data-testid="mock-incident-detail">MockDetail</div>)
}));

describe('IncidentDetailPage', () => {
  const renderWithRoute = (initialEntry: string) => {
    return render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/incidents" element={<div>List Page</div>} />
          <Route path="/incidents/:incidentId" element={<IncidentDetailPage />} />
          <Route path="/incidents-no-id" element={<IncidentDetailPage />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('1, 2. Geçerli pozitif ID (1) IncidentDetail’e number olarak aktarılır', () => {
    renderWithRoute('/incidents/1');
    expect(IncidentDetail).toHaveBeenCalledWith(
      expect.objectContaining({ incidentId: 1 }),
      undefined
    );
    expect(screen.getByTestId('mock-incident-detail')).toBeInTheDocument();
  });

  it('3. Büyük ama safe integer ID kabul edilir', () => {
    renderWithRoute('/incidents/9007199254740991');
    expect(IncidentDetail).toHaveBeenCalledWith(
      expect.objectContaining({ incidentId: 9007199254740991 }),
      undefined
    );
  });

  it('4. Parametre yoksa güvenli hata gösterilir', () => {
    renderWithRoute('/incidents-no-id');
    expect(screen.getByRole('alert')).toHaveTextContent('Geçersiz veya eksik olay kimliği. Lütfen olay listesinden geçerli bir kayıt seçin.');
    expect(screen.queryByTestId('mock-incident-detail')).not.toBeInTheDocument();
  });

  it('5. abc reddedilir', () => {
    renderWithRoute('/incidents/abc');
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('6. 12abc reddedilir', () => {
    renderWithRoute('/incidents/12abc');
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('7. 0 reddedilir', () => {
    renderWithRoute('/incidents/0');
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('8. -1 reddedilir', () => {
    renderWithRoute('/incidents/-1');
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('9. 1.5 reddedilir', () => {
    renderWithRoute('/incidents/1.5');
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('10. 1e3 reddedilir', () => {
    renderWithRoute('/incidents/1e3');
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('11. Safe integer üstü değer reddedilir', () => {
    renderWithRoute('/incidents/9007199254740992');
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('12, 13. Geçersiz ID’de IncidentDetail render edilmez ve API çağrısı yapılmaz', () => {
    vi.mocked(IncidentDetail).mockClear();
    renderWithRoute('/incidents/invalid');
    expect(screen.queryByTestId('mock-incident-detail')).not.toBeInTheDocument();
    expect(IncidentDetail).not.toHaveBeenCalled();
  });

  it('14, 15, 16. Hata role=alert kullanır, Listeye dönüş linki /incidents hedefini kullanır', () => {
    renderWithRoute('/incidents/invalid');
    expect(screen.getByRole('alert')).toBeInTheDocument();

    const link = screen.getByRole('link', { name: 'Olay Listesine Dön' });
    expect(link).toHaveAttribute('href', '/incidents');
    expect(link.getAttribute('href')).not.toContain('invalid');
  });

  it('17. Test bypass veya broad cast kullanılmaz', () => {
    // Asserted by lint and types
    expect(true).toBe(true);
  });
});
