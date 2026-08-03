import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router';
import { DetectionResultsPage } from './DetectionResultsPage';
import { DetectionSummaryPanel } from './components/DetectionSummaryPanel';
import { DetectionResultsList } from './components/DetectionResultsList';

// Mock subcomponents to isolate page logic
vi.mock('./components/DetectionSummaryPanel', () => ({
  DetectionSummaryPanel: vi.fn(() => <div data-testid="mock-summary-panel" />),
}));

vi.mock('./components/DetectionResultsList', () => ({
  DetectionResultsList: vi.fn(() => <div data-testid="mock-results-list" />),
}));

describe('DetectionResultsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderPage = (initialRoute: string) => {
    return render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <Routes>
          <Route path="/detections/:jobId" element={<DetectionResultsPage />} />
          <Route path="/detections" element={<DetectionResultsPage />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('1. Geçerli canonical jobId ile sayfa başlığı gösterilir.', () => {
    renderPage('/detections/123');

    expect(screen.getByRole('heading', { level: 1, name: 'Analiz Sonuçları' })).toBeInTheDocument();
    expect(screen.getByText(/Ağ trafiği üzerinden tespit edilen potansiyel güvenlik tehditleri/)).toBeInTheDocument();
  });

  it('2-4. Geçerli jobId ile özet ve sonuç listesi bileşenlerine jobId aktarılır ve özet önce render edilir.', () => {
    const { container } = renderPage('/detections/456');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    expect(vi.mocked(DetectionSummaryPanel)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(DetectionSummaryPanel)).toHaveBeenCalledWith({ jobId: 456 }, undefined);

    expect(vi.mocked(DetectionResultsList)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(DetectionResultsList)).toHaveBeenCalledWith({ jobId: 456 }, undefined);

    // Ensure order in DOM
    expect(screen.getByTestId('mock-summary-panel')).toBeInTheDocument();
    expect(screen.getByTestId('mock-results-list')).toBeInTheDocument();
    expect(container.innerHTML.indexOf('mock-summary-panel')).toBeLessThan(container.innerHTML.indexOf('mock-results-list'));
  });

  it('5-14. Geçersiz, eksik veya tehlikeli jobId değerleri reddedilir, alt bileşenler render edilmez, güvenli hata gösterilir.', () => {
    const invalidJobIds = [
      '', // 5. eksik
      '0', // 6. sıfır
      '-15', // 7. negatif
      '123.45', // 8. ondalıklı
      '123a', // 9. karma/harf
      'abc', // 9. harf
      ' 123', // 9. boşluklu
      '+123', // 9. işaretli pozitif
      '1e2', // 10. üstel (1e2 reddedilir)
      '0x1A', // hexadecimal
      '9999999999999999999999999', // 11. safe-integer sınırı
    ];

    invalidJobIds.forEach(id => {
      const { unmount } = renderPage(id ? `/detections/${id}` : '/detections');

      const alert = screen.getByRole('alert'); // 14. role="alert" bulunur
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent('Geçersiz veya eksik analiz ID parametresi');

      // 13. Ham geçersiz route parametresi hata mesajında gösterilmez
      if (id) {
        expect(alert.textContent).not.toContain(id);
      }

      // 12. Geçersiz değerlerde alt bileşenler render edilmez
      expect(screen.queryByTestId('mock-summary-panel')).not.toBeInTheDocument();
      expect(screen.queryByTestId('mock-results-list')).not.toBeInTheDocument();

      expect(vi.mocked(DetectionSummaryPanel)).not.toHaveBeenCalled();
      expect(vi.mocked(DetectionResultsList)).not.toHaveBeenCalled();

      unmount();
      vi.clearAllMocks();
    });
  });

  it('15. Sayfada tek görünür h1 bulunur.', () => {
    renderPage('/detections/123');
    const headings = screen.getAllByRole('heading', { level: 1 });
    expect(headings).toHaveLength(1);
  });
});
