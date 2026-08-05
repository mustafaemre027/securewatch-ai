import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DashboardCharts } from './DashboardCharts';
import type { DashboardSummaryResponse } from '../types';

// Mock Recharts ResponsiveContainer to avoid JSDOM sizing issues
vi.mock('recharts', async () => {
  const Actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...Actual,
    ResponsiveContainer: ({ children }: any) => (
      <div data-testid="responsive-container">
        {React.cloneElement(children, { width: 500, height: 300 })}
      </div>
    ),
  };
});

const getMockSummary = (): DashboardSummaryResponse => ({
  generated_at: '2026-08-05T12:00:00Z',
  analysis_summary: {
    total_jobs: 1250,
    status_distribution: { PENDING: 10, PROCESSING: 5, COMPLETED: 1200, FAILED: 35 },
    completed_jobs: 1200,
  },
  detection_summary: {
    total_detections: 50000,
    benign_count: 45000,
    attack_count: 5000,
  },
  detection_class_distribution: { benign: 45000, attack: 5000 },
  risk_distribution: { LOW: 1000, MEDIUM: 2000, HIGH: 1500, CRITICAL: 500 },
  incident_summary: {
    total_incidents: 150,
    status_distribution: { OPEN: 20, IN_PROGRESS: 30, RESOLVED: 95, FALSE_POSITIVE: 5 },
    severity_distribution: { LOW: 50, MEDIUM: 50, HIGH: 30, CRITICAL: 20 },
  },
  trend_7_days: [
    { date: '2026-08-01', total: 100, benign: 90, attack: 10 },
    { date: '2026-08-02', total: 200, benign: 180, attack: 20 },
    { date: '2026-08-03', total: 150, benign: 140, attack: 10 },
    { date: '2026-08-04', total: 300, benign: 270, attack: 30 },
    { date: '2026-08-05', total: 500, benign: 450, attack: 50 },
    { date: '2026-08-06', total: 250, benign: 220, attack: 30 },
    { date: '2026-08-07', total: 400, benign: 360, attack: 40 },
  ],
  recent_detections: [],
  recent_incidents: [],
});

const getEmptySummary = (): DashboardSummaryResponse => ({
  ...getMockSummary(),
  detection_class_distribution: { benign: 0, attack: 0 },
  risk_distribution: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
  incident_summary: {
    total_incidents: 0,
    status_distribution: { OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0, FALSE_POSITIVE: 0 },
    severity_distribution: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
  },
  trend_7_days: [
    { date: '2026-08-01', total: 0, benign: 0, attack: 0 },
    { date: '2026-08-02', total: 0, benign: 0, attack: 0 },
    { date: '2026-08-03', total: 0, benign: 0, attack: 0 },
    { date: '2026-08-04', total: 0, benign: 0, attack: 0 },
    { date: '2026-08-05', total: 0, benign: 0, attack: 0 },
    { date: '2026-08-06', total: 0, benign: 0, attack: 0 },
    { date: '2026-08-07', total: 0, benign: 0, attack: 0 },
  ]
});

describe('DashboardCharts', () => {
  // --- Genel Yapı ---
  describe('Genel Yapı', () => {
    it('Beş grafik paneli bulunur', () => {
      render(<DashboardCharts summary={getMockSummary()} />);
      const containers = screen.getAllByTestId('responsive-container');
      expect(containers).toHaveLength(5);
    });

    it('Her panelin doğru Türkçe başlığı vardır', () => {
      render(<DashboardCharts summary={getMockSummary()} />);
      expect(screen.getByText('Tespit Dağılımı')).toBeInTheDocument();
      expect(screen.getByText('Risk Seviyesi Dağılımı')).toBeInTheDocument();
      expect(screen.getByText('Olay Durumu Dağılımı')).toBeInTheDocument();
      expect(screen.getByText('Olay Önem Seviyesi Dağılımı')).toBeInTheDocument();
      expect(screen.getByText('Son 7 Günlük Tespit Eğilimi')).toBeInTheDocument();
    });

    it('Her panel başlığıyla erişilebilir biçimde bağlıdır', () => {
      render(<DashboardCharts summary={getMockSummary()} />);
      const regions = screen.getAllByRole('img');
      expect(regions).toHaveLength(5);
      regions.forEach(region => {
        expect(region).toHaveAttribute('aria-labelledby');
      });
    });

    it('Grafik bölgeleri erişilebilir ada sahiptir', () => {
      render(<DashboardCharts summary={getMockSummary()} />);
      expect(screen.getByLabelText('Tespit dağılımı grafik bölgesi')).toBeInTheDocument();
      expect(screen.getByLabelText('Risk dağılımı grafik bölgesi')).toBeInTheDocument();
      expect(screen.getByLabelText('Olay durumu grafik bölgesi')).toBeInTheDocument();
      expect(screen.getByLabelText('Olay önem seviyesi grafik bölgesi')).toBeInTheDocument();
      expect(screen.getByLabelText('Son yedi günlük eğilim grafik bölgesi')).toBeInTheDocument();
    });

    it('Ekran okuyucu veri özetleri bulunur', () => {
      render(<DashboardCharts summary={getMockSummary()} />);
      expect(screen.getByText(/Tespit Dağılımı Özeti:/)).toBeInTheDocument();
      expect(screen.getByText(/Risk Seviyesi Dağılımı Özeti:/)).toBeInTheDocument();
      expect(screen.getByText(/Olay Durumu Dağılımı Özeti:/)).toBeInTheDocument();
      expect(screen.getByText(/Olay Önem Seviyesi Dağılımı Özeti:/)).toBeInTheDocument();
      expect(screen.getByText(/Son 7 Günlük Eğilim Özeti:/)).toBeInTheDocument();
    });

    it('Prop response nesnesi mutate edilmez', () => {
      const summary = getMockSummary();
      const cloned = JSON.parse(JSON.stringify(summary));
      render(<DashboardCharts summary={summary} />);
      expect(summary).toEqual(cloned);
    });
  });

  // --- Tespit Dağılımı ---
  describe('Tespit Dağılımı', () => {
    it('Normal etiketi gösterilir', () => {
      render(<DashboardCharts summary={getMockSummary()} />);
      expect(screen.getAllByText(/Normal/).length).toBeGreaterThan(0);
    });

    it('Saldırı etiketi gösterilir', () => {
      render(<DashboardCharts summary={getMockSummary()} />);
      expect(screen.getAllByText(/Saldırı/).length).toBeGreaterThan(0);
    });

    it('Normal değeri doğru aktarılır', () => {
      render(<DashboardCharts summary={getMockSummary()} />);
      const srText = screen.getByText(/Normal: 45\.000/);
      expect(srText).toBeInTheDocument();
    });

    it('Saldırı değeri doğru aktarılır', () => {
      render(<DashboardCharts summary={getMockSummary()} />);
      const srText = screen.getByText(/Saldırı: 5\.000/);
      expect(srText).toBeInTheDocument();
    });

    it('Toplam sıfırsa yerel veri yok mesajı gösterilir', () => {
      render(<DashboardCharts summary={getEmptySummary()} />);
      expect(screen.getByText('Tespit dağılımı için henüz veri bulunmuyor.')).toBeInTheDocument();
    });

    it('Kategorilerden biri sıfır olsa bile diğer veri korunur', () => {
      const summary = getMockSummary();
      summary.detection_class_distribution.attack = 0;
      render(<DashboardCharts summary={summary} />);
      expect(screen.queryByText('Tespit dağılımı için henüz veri bulunmuyor.')).not.toBeInTheDocument();
      expect(screen.getByText(/Saldırı: 0/)).toBeInTheDocument();
    });
  });

  // --- Risk Dağılımı ---
  describe('Risk Dağılımı', () => {
    it('Düşük etiketi gösterilir', () => {
      render(<DashboardCharts summary={getMockSummary()} />);
      expect(screen.getAllByText(/Düşük/).length).toBeGreaterThan(0);
    });

    it('Orta etiketi gösterilir', () => {
      render(<DashboardCharts summary={getMockSummary()} />);
      expect(screen.getAllByText(/Orta/).length).toBeGreaterThan(0);
    });

    it('Yüksek etiketi gösterilir', () => {
      render(<DashboardCharts summary={getMockSummary()} />);
      expect(screen.getAllByText(/Yüksek/).length).toBeGreaterThan(0);
    });

    it('Kritik etiketi gösterilir', () => {
      render(<DashboardCharts summary={getMockSummary()} />);
      expect(screen.getAllByText(/Kritik/).length).toBeGreaterThan(0);
    });

    it('Dört risk değeri doğru aktarılır', () => {
      render(<DashboardCharts summary={getMockSummary()} />);
      expect(screen.getByText(/Düşük: 1\.000/)).toBeInTheDocument();
      expect(screen.getByText(/Orta: 2\.000/)).toBeInTheDocument();
      expect(screen.getByText(/Yüksek: 1\.500/)).toBeInTheDocument();
      expect(screen.getByText(/Kritik: 500/)).toBeInTheDocument();
    });

    it('Bütün değerler sıfırsa yerel veri yok mesajı gösterilir', () => {
      render(<DashboardCharts summary={getEmptySummary()} />);
      expect(screen.getByText('Risk dağılımı için henüz veri bulunmuyor.')).toBeInTheDocument();
    });
  });

  // --- Olay Durumu ---
  describe('Olay Durumu', () => {
    it('Açık etiketi gösterilir', () => {
      render(<DashboardCharts summary={getMockSummary()} />);
      expect(screen.getAllByText(/Açık/).length).toBeGreaterThan(0);
    });

    it('İnceleniyor etiketi gösterilir', () => {
      render(<DashboardCharts summary={getMockSummary()} />);
      expect(screen.getAllByText(/İnceleniyor/).length).toBeGreaterThan(0);
    });

    it('Çözüldü etiketi gösterilir', () => {
      render(<DashboardCharts summary={getMockSummary()} />);
      expect(screen.getAllByText(/Çözüldü/).length).toBeGreaterThan(0);
    });

    it('Yanlış Pozitif etiketi gösterilir', () => {
      render(<DashboardCharts summary={getMockSummary()} />);
      expect(screen.getAllByText(/Yanlış Pozitif/).length).toBeGreaterThan(0);
    });

    it('Durum sayaçları doğru aktarılır', () => {
      render(<DashboardCharts summary={getMockSummary()} />);
      expect(screen.getByText(/Açık: 20/)).toBeInTheDocument();
      expect(screen.getByText(/İnceleniyor: 30/)).toBeInTheDocument();
      expect(screen.getByText(/Çözüldü: 95/)).toBeInTheDocument();
      expect(screen.getByText(/Yanlış Pozitif: 5/)).toBeInTheDocument();
    });

    it('Bütün değerler sıfırsa yerel veri yok mesajı gösterilir', () => {
      render(<DashboardCharts summary={getEmptySummary()} />);
      expect(screen.getByText('Olay durumu için henüz veri bulunmuyor.')).toBeInTheDocument();
    });
  });

  // --- Olay Önem Seviyesi ---
  describe('Olay Önem Seviyesi', () => {
    it('Dört önem seviyesi Türkçe gösterilir', () => {
      render(<DashboardCharts summary={getMockSummary()} />);
      expect(screen.getAllByText(/Düşük/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Orta/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Yüksek/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Kritik/).length).toBeGreaterThan(0);
    });

    it('Önem sayaçları doğru aktarılır', () => {
      render(<DashboardCharts summary={getMockSummary()} />);
      expect(screen.getByText(/Düşük: 50/)).toBeInTheDocument();
      expect(screen.getByText(/Orta: 50/)).toBeInTheDocument();
      expect(screen.getByText(/Yüksek: 30/)).toBeInTheDocument();
      expect(screen.getByText(/Kritik: 20/)).toBeInTheDocument();
    });

    it('Bütün değerler sıfırsa yerel veri yok mesajı gösterilir', () => {
      render(<DashboardCharts summary={getEmptySummary()} />);
      expect(screen.getByText('Önem seviyesi için henüz veri bulunmuyor.')).toBeInTheDocument();
    });
  });

  // --- Trend ---
  describe('Trend', () => {
    it('Trend yedi noktayı kullanır', () => {
      render(<DashboardCharts summary={getMockSummary()} />);
      expect(screen.getAllByText(/01\.08/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/07\.08/).length).toBeGreaterThan(0);
    });

    it('Toplam serisi bulunur', () => {
      render(<DashboardCharts summary={getMockSummary()} />);
      expect(screen.getAllByText(/Toplam/).length).toBeGreaterThan(0);
    });

    it('Normal serisi bulunur', () => {
      render(<DashboardCharts summary={getMockSummary()} />);
      expect(screen.getAllByText(/Normal/).length).toBeGreaterThan(0);
    });

    it('Saldırı serisi bulunur', () => {
      render(<DashboardCharts summary={getMockSummary()} />);
      expect(screen.getAllByText(/Saldırı/).length).toBeGreaterThan(0);
    });

    it('Tarihler GG.AA biçimine çevrilir', () => {
      render(<DashboardCharts summary={getMockSummary()} />);
      expect(screen.getAllByText(/05\.08/).length).toBeGreaterThan(0);
      expect(screen.queryByText(/2026-08-05/)).not.toBeInTheDocument();
    });

    it('Tarihlerin sırası korunur', () => {
      render(<DashboardCharts summary={getMockSummary()} />);
      const srText = screen.getByText(/Son 7 Günlük Eğilim Özeti:/);
      expect(srText.textContent).toContain('01.08 - Toplam');
      expect(srText.textContent).toContain('02.08 - Toplam');
      const idx1 = srText.textContent!.indexOf('01.08');
      const idx2 = srText.textContent!.indexOf('02.08');
      expect(idx1).toBeLessThan(idx2);
    });

    it('Saat dilimi nedeniyle tarih kayması oluşmaz', () => {
      render(<DashboardCharts summary={getMockSummary()} />);
      expect(screen.getAllByText(/01\.08/).length).toBeGreaterThan(0);
      expect(screen.queryByText(/31\.07/)).not.toBeInTheDocument();
    });

    it('Tamamen sıfır trend yerel veri yok mesajı gösterir', () => {
      render(<DashboardCharts summary={getEmptySummary()} />);
      expect(screen.getByText('Son yedi günlük eğilim için henüz veri bulunmuyor.')).toBeInTheDocument();
    });

    it('Kısmen dolu trend grafiği gösterir', () => {
      const summary = getEmptySummary();
      summary.trend_7_days[0].total = 10;
      render(<DashboardCharts summary={summary} />);
      expect(screen.queryByText('Son yedi günlük eğilim için henüz veri bulunmuyor.')).not.toBeInTheDocument();
    });
  });

  // --- Güvenlik ve Kapsam ---
  describe('Güvenlik ve Kapsam', () => {
    it('Protocol metni veya veri alanı bulunmaz', () => {
      render(<DashboardCharts summary={getMockSummary()} />);
      expect(screen.queryByText(/protocol/i)).not.toBeInTheDocument();
    });

    it('Accuracy metni veya veri alanı bulunmaz', () => {
      render(<DashboardCharts summary={getMockSummary()} />);
      expect(screen.queryByText(/accuracy/i)).not.toBeInTheDocument();
    });

    it('Precision, recall veya F1 bulunmaz', () => {
      render(<DashboardCharts summary={getMockSummary()} />);
      expect(screen.queryByText(/precision/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/recall/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/f1/i)).not.toBeInTheDocument();
    });

    it('NaN DOM’a yazılmaz', () => {
      const summary = getMockSummary();
      summary.detection_summary.total_detections = NaN; // simulate bad data
      render(<DashboardCharts summary={summary} />);
      const allText = screen.getAllByText(/.*/).map(e => e.textContent).join(' ');
      expect(allText).not.toMatch(/NaN/);
    });

    it('Infinity DOM’a yazılmaz', () => {
      const summary = getMockSummary();
      summary.detection_summary.total_detections = Infinity; // simulate bad data
      render(<DashboardCharts summary={summary} />);
      const allText = screen.getAllByText(/.*/).map(e => e.textContent).join(' ');
      expect(allText).not.toMatch(/Infinity/);
    });

    it('Negatif veya sahte sayaç üretilmez', () => {
      render(<DashboardCharts summary={getMockSummary()} />);
      const allText = screen.getAllByText(/.*/).map(e => e.textContent).join(' ');
      expect(allText).not.toMatch(/-\d/);
    });

    it('Grafik verisi storage’a yazılmaz', () => {
      const setItemSpy1 = vi.spyOn(Storage.prototype, 'setItem');
      const setItemSpy2 = vi.spyOn(window.sessionStorage, 'setItem');
      render(<DashboardCharts summary={getMockSummary()} />);
      expect(setItemSpy1).not.toHaveBeenCalled();
      expect(setItemSpy2).not.toHaveBeenCalled();
      setItemSpy1.mockRestore();
      setItemSpy2.mockRestore();
    });

    it('Console log oluşturulmaz', () => {
      const logSpy = vi.spyOn(console, 'log');
      render(<DashboardCharts summary={getMockSummary()} />);
      expect(logSpy).not.toHaveBeenCalled();
      logSpy.mockRestore();
    });

    it('Gereksiz interaktif tabIndex oluşturulmaz', () => {
      const { container } = render(<DashboardCharts summary={getMockSummary()} />);
      // We expect no elements to have tabindex explicitly added by us.
      const ourWrappers = container.querySelectorAll('.p-4');
      ourWrappers.forEach(w => expect(w).not.toHaveAttribute('tabindex'));
    });
  });
});
