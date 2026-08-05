import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { DashboardRecentActivity } from './DashboardRecentActivity';
import type { RecentDetection, RecentIncident } from '../types';

const mockDetections: RecentDetection[] = [
  {
    id: 1,
    job_id: 100,
    row_index: 42,
    is_attack: true,
    attack_probability: 0.95,
    risk_level: 'CRITICAL',
    created_at: '2026-08-05T12:00:00Z',
  },
  {
    id: 2,
    job_id: 101,
    row_index: 10,
    is_attack: false,
    attack_probability: 0.01,
    risk_level: 'LOW',
    created_at: '2026-08-05T13:00:00Z',
  }
];

const mockIncidents: RecentIncident[] = [
  {
    id: 200,
    title: 'Şüpheli SSH Girişi',
    status: 'OPEN',
    severity: 'HIGH',
    assigned_analyst_id: 5,
    created_at: '2026-08-05T14:00:00Z',
    updated_at: '2026-08-05T14:30:00Z',
  },
  {
    id: 201,
    title: 'DNS Sızıntısı',
    status: 'RESOLVED',
    severity: 'MEDIUM',
    assigned_analyst_id: null,
    created_at: '2026-08-05T15:00:00Z',
    updated_at: '2026-08-05T16:00:00Z',
  }
];

const renderComponent = (detections = mockDetections, incidents = mockIncidents) => {
  return render(
    <MemoryRouter>
      <DashboardRecentActivity recentDetections={detections} recentIncidents={incidents} />
    </MemoryRouter>
  );
};

describe('DashboardRecentActivity', () => {
  describe('Genel Yapı', () => {
    it('Son Tespitler başlığı gösterilir', () => {
      renderComponent();
      expect(screen.getByText('Son Tespitler')).toBeInTheDocument();
    });

    it('Son Olaylar başlığı gösterilir', () => {
      renderComponent();
      expect(screen.getByText('Son Olaylar')).toBeInTheDocument();
    });
  });

  describe('Boş Durumlar', () => {
    it('Tespitler listesi boşsa özel mesaj gösterilir', () => {
      renderComponent([], mockIncidents);
      expect(screen.getByText('Son tespit bulunmuyor.')).toBeInTheDocument();
    });

    it('Olaylar listesi boşsa özel mesaj gösterilir', () => {
      renderComponent(mockDetections, []);
      expect(screen.getByText('Son olay bulunmuyor.')).toBeInTheDocument();
    });
  });

  describe('Tespitler Listesi', () => {
    it('Tespitlerde recentDetections render edilir', () => {
      renderComponent();
      expect(screen.getByText('Satır: 42')).toBeInTheDocument();
      expect(screen.getByText('Satır: 10')).toBeInTheDocument();
    });

    it('Tespit türü (Saldırı/Normal) Türkçe gösterilir', () => {
      renderComponent();
      expect(screen.getByText('Saldırı Tespit Edildi')).toBeInTheDocument();
      expect(screen.getByText('Normal Aktivite')).toBeInTheDocument();
    });

    it('Risk seviyeleri Türkçe gösterilir', () => {
      renderComponent();
      expect(screen.getAllByText('Kritik').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Düşük').length).toBeGreaterThan(0);
    });

    it('Tespitlerde attack_probability formatlanarak gösterilir', () => {
      renderComponent();
      // 0.95 -> %95
      expect(screen.getByText(/Olasılık: %95/)).toBeInTheDocument();
    });

    it('Doğru /analysis/:id/results linkleri üretilir', () => {
      renderComponent();
      const link1 = screen.getByRole('link', { name: /Analiz 100, satır 42 için tespit detayı/i });
      expect(link1).toHaveAttribute('href', '/analysis/100/results');

      const link2 = screen.getByRole('link', { name: /Analiz 101, satır 10 için tespit detayı/i });
      expect(link2).toHaveAttribute('href', '/analysis/101/results');
    });
  });

  describe('Olaylar Listesi', () => {
    it('Olaylarda recentIncidents render edilir', () => {
      renderComponent();
      expect(screen.getByText('Şüpheli SSH Girişi')).toBeInTheDocument();
      expect(screen.getByText('DNS Sızıntısı')).toBeInTheDocument();
    });

    it('Olay başlığı, durumu ve önemi Türkçe gösterilir', () => {
      renderComponent();
      expect(screen.getAllByText('Açık').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Çözüldü').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Yüksek').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Orta').length).toBeGreaterThan(0);
    });

    it('Incident analyst ID gizlenir (Atandı/Atanmadı)', () => {
      renderComponent();
      expect(screen.getByText('Atandı')).toBeInTheDocument();
      expect(screen.getByText('Atanmadı')).toBeInTheDocument();
      expect(screen.queryByText('5')).not.toBeInTheDocument();
    });

    it('Doğru /incidents/:id linkleri üretilir', () => {
      renderComponent();
      const link1 = screen.getByRole('link', { name: /"Şüpheli SSH Girişi" olayı detayları/i });
      expect(link1).toHaveAttribute('href', '/incidents/200');

      const link2 = screen.getByRole('link', { name: /"DNS Sızıntısı" olayı detayları/i });
      expect(link2).toHaveAttribute('href', '/incidents/201');
    });
  });

  describe('Tarih ve Güvenlik', () => {
    it('Tarihler locale formatlanır', () => {
      renderComponent();
      // ISO string should not be present literally
      expect(screen.queryByText('2026-08-05T12:00:00Z')).not.toBeInTheDocument();
      // Should find formatted dates (the exact format depends on the environment, but it shouldn't fail if we just check lack of ISO)
      // Usually DD.MM.YYYY HH:mm format for tr-TR
      const allText = screen.getAllByText(/.*/).map(e => e.textContent).join(' ');
      expect(allText).toMatch(/05\.08\.2026/); 
    });

    it('Geçersiz tarihler güvenli şekilde fallback yapar', () => {
      const badDetections = [{ ...mockDetections[0], created_at: 'invalid-date' }];
      renderComponent(badDetections, []);
      expect(screen.getByText('invalid-date')).toBeInTheDocument();
    });

    it('Props mutate edilmez', () => {
      const detections = [...mockDetections];
      const incidents = [...mockIncidents];
      renderComponent(detections, incidents);
      expect(detections).toEqual(mockDetections);
      expect(incidents).toEqual(mockIncidents);
    });

    it('Console veya storage kullanılmaz', () => {
      const logSpy = vi.spyOn(console, 'log');
      const storageSpy = vi.spyOn(Storage.prototype, 'setItem');
      renderComponent();
      expect(logSpy).not.toHaveBeenCalled();
      expect(storageSpy).not.toHaveBeenCalled();
      logSpy.mockRestore();
      storageSpy.mockRestore();
    });
  });
});
