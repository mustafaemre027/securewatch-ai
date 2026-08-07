import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IncidentCreateForm } from './IncidentCreateForm';
import { createIncident } from '../api';
import { ApiError } from '../../../api/types';
import type { DetectionResult } from '../../detections/types';

vi.mock('../api', () => ({
  createIncident: vi.fn(),
}));

const mockDetectionResult: DetectionResult = {
  id: 123,
  job_id: 10,
  row_index: 4,
  attack_probability: 0.956,
  is_attack: true,
  risk_level: 'HIGH',
  created_at: '2023-01-01T00:00:00Z',
};

const mockAccessToken = 'test-token';

describe('IncidentCreateForm', () => {
  const onCreatedMock = vi.fn();
  const onCancelMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderForm = () => {
    return render(
      <IncidentCreateForm
        detectionResult={mockDetectionResult}
        accessToken={mockAccessToken}
        onCreated={onCreatedMock}
        onCancel={onCancelMock}
      />
    );
  };

  it('render fields and summary (req 1, 4)', () => {
    renderForm();
    
    expect(screen.getByLabelText(/Olay Başlığı/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Olay Açıklaması/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Önem Seviyesi/i)).toBeInTheDocument();
    
    expect(screen.getByText('Satır 5')).toBeInTheDocument();
    expect(screen.getByText('%95.60')).toBeInTheDocument();
    expect(screen.getAllByText('Yüksek').length).toBeGreaterThan(0);
  });

  it('focuses title field initially (req 2)', () => {
    renderForm();
    const titleInput = screen.getByLabelText(/Olay Başlığı/i);
    expect(document.activeElement).toBe(titleInput);
  });

  it('default severity is detection risk level (req 3)', () => {
    renderForm();
    const severitySelect = screen.getByLabelText(/Önem Seviyesi/i) as HTMLSelectElement;
    expect(severitySelect.value).toBe('HIGH');
  });

  it('prevents empty or whitespace title submission (req 5, 6)', async () => {
    const user = userEvent.setup();
    renderForm();
    
    const descInput = screen.getByLabelText(/Olay Açıklaması/i);
    await user.type(descInput, 'Some valid description');
    
    const submitBtn = screen.getByRole('button', { name: /Gönder/i });
    
    // Empty
    await user.click(submitBtn);
    expect(screen.getByRole('alert')).toHaveTextContent('Olay Başlığı alanı boş olamaz.');
    expect(createIncident).not.toHaveBeenCalled();

    // Whitespace
    const titleInput = screen.getByLabelText(/Olay Başlığı/i);
    await user.type(titleInput, '   ');
    await user.click(submitBtn);
    expect(screen.getByRole('alert')).toHaveTextContent('Olay Başlığı alanı boş olamaz.');
    expect(createIncident).not.toHaveBeenCalled();
  });

  it('validates 150 char max length for title (req 7)', async () => {
    const user = userEvent.setup();
    renderForm();
    
    const titleInput = screen.getByLabelText(/Olay Başlığı/i) as HTMLInputElement;
    expect(titleInput.maxLength).toBe(150);
    
    const longText = 'a'.repeat(151);
    await user.type(titleInput, longText);
    
    const descInput = screen.getByLabelText(/Olay Açıklaması/i);
    await user.type(descInput, 'Valid desc');
    
    const submitBtn = screen.getByRole('button', { name: /Gönder/i });
    await user.click(submitBtn);
    
    if (titleInput.value.length > 150) {
      expect(screen.getByRole('alert')).toHaveTextContent('Başlık 150 karakterden uzun olamaz.');
      expect(createIncident).not.toHaveBeenCalled();
    }
  });

  it('prevents empty description submission (req 8)', async () => {
    const user = userEvent.setup();
    renderForm();
    
    const titleInput = screen.getByLabelText(/Olay Başlığı/i);
    await user.type(titleInput, 'Valid title');
    
    const submitBtn = screen.getByRole('button', { name: /Gönder/i });
    await user.click(submitBtn);
    
    expect(screen.getByRole('alert')).toHaveTextContent('Olay Açıklaması alanı boş olamaz.');
    expect(createIncident).not.toHaveBeenCalled();
  });

  it('calls createIncident with correct trimmed values and props (req 9, 10, 11, 12, 15)', async () => {
    const user = userEvent.setup();
    const mockCreatedIncident = { id: 999, title: 'Trimmed Title' };
    vi.mocked(createIncident).mockResolvedValueOnce(mockCreatedIncident as unknown as import('../types').IncidentListItem);
    
    renderForm();
    
    const titleInput = screen.getByLabelText(/Olay Başlığı/i);
    await user.type(titleInput, '  Trimmed Title  ');
    
    const descInput = screen.getByLabelText(/Olay Açıklaması/i);
    await user.type(descInput, '  Trimmed Desc  ');
    
    const submitBtn = screen.getByRole('button', { name: /Gönder/i });
    await user.click(submitBtn);
    
    await waitFor(() => {
      expect(createIncident).toHaveBeenCalledTimes(1);
    });

    expect(createIncident).toHaveBeenCalledWith(
      {
        detection_result_id: 123,
        title: 'Trimmed Title',
        description: 'Trimmed Desc',
        severity: 'HIGH',
      },
      'test-token',
      expect.any(AbortSignal)
    );
    
    expect(onCreatedMock).toHaveBeenCalledWith(mockCreatedIncident);
  });

  it('disables fields during submission and prevents duplicate submits (req 13, 14)', async () => {
    const user = userEvent.setup();
    let resolveApi: (val: import('../types').IncidentListItem) => void = () => {};
    vi.mocked(createIncident).mockImplementation(() => new Promise((res) => {
      resolveApi = res;
    }));
    
    renderForm();
    
    const titleInput = screen.getByLabelText(/Olay Başlığı/i);
    await user.type(titleInput, 'Title');
    const descInput = screen.getByLabelText(/Olay Açıklaması/i);
    await user.type(descInput, 'Desc');
    
    const submitBtn = screen.getByRole('button', { name: /Gönder/i });
    await user.click(submitBtn);
    
    expect(titleInput).toBeDisabled();
    expect(descInput).toBeDisabled();
    expect(screen.getByLabelText(/Önem Seviyesi/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /İptal/i })).toBeDisabled();
    expect(submitBtn).toBeDisabled();
    
    await user.click(submitBtn); // Double click attempt
    expect(createIncident).toHaveBeenCalledTimes(1);
    
    resolveApi({ id: 1 } as unknown as import('../types').IncidentListItem);
  });

  it('calls onCancel and handles Escape (req 16, 17, 18)', async () => {
    const user = userEvent.setup();
    renderForm();
    
    const cancelBtn = screen.getByRole('button', { name: /İptal/i });
    await user.click(cancelBtn);
    expect(onCancelMock).toHaveBeenCalledTimes(1);
    
    fireEvent.keyDown(screen.getByRole('region'), { key: 'Escape', code: 'Escape' });
    expect(onCancelMock).toHaveBeenCalledTimes(2);
    
    let resolveApi: (val: import('../types').IncidentListItem) => void = () => {};
    vi.mocked(createIncident).mockImplementation(() => new Promise((res) => {
      resolveApi = res;
    }));
    
    await user.type(screen.getByLabelText(/Olay Başlığı/i), 'T');
    await user.type(screen.getByLabelText(/Olay Açıklaması/i), 'D');
    await user.click(screen.getByRole('button', { name: /Gönder/i }));
    
    fireEvent.keyDown(screen.getByRole('region'), { key: 'Escape', code: 'Escape' });
    expect(onCancelMock).toHaveBeenCalledTimes(2); // Should not increase
    
    resolveApi({ id: 1 } as unknown as import('../types').IncidentListItem);
  });

  it('aborts request on unmount (req 19)', async () => {
    const user = userEvent.setup();
    let capturedSignal: AbortSignal | undefined;
    vi.mocked(createIncident).mockImplementation((_payload, _token, signal) => {
      capturedSignal = signal;
      return new Promise(() => {}); // never resolves
    });
    
    const { unmount } = renderForm();
    
    await user.type(screen.getByLabelText(/Olay Başlığı/i), 'T');
    await user.type(screen.getByLabelText(/Olay Açıklaması/i), 'D');
    await user.click(screen.getByRole('button', { name: /Gönder/i }));
    
    expect(capturedSignal).toBeDefined();
    expect(capturedSignal?.aborted).toBe(false);
    
    unmount();
    expect(capturedSignal?.aborted).toBe(true);
  });

  it('ignores AbortError (req 20)', async () => {
    const user = userEvent.setup();
    vi.mocked(createIncident).mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'));
    
    renderForm();
    
    await user.type(screen.getByLabelText(/Olay Başlığı/i), 'T');
    await user.type(screen.getByLabelText(/Olay Açıklaması/i), 'D');
    await user.click(screen.getByRole('button', { name: /Gönder/i }));
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Gönder/i })).not.toBeDisabled();
    });
    
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  const testErrorMapping = async (status: number, code: string, expectedMessage: string) => {
    cleanup();
    const user = userEvent.setup();
    vi.mocked(createIncident).mockRejectedValueOnce(new ApiError(status, { code, message: 'Backend Message', details: null }));
    
    renderForm();
    
    await user.type(screen.getByLabelText(/Olay Başlığı/i), 'T');
    await user.type(screen.getByLabelText(/Olay Açıklaması/i), 'D');
    await user.click(screen.getByRole('button', { name: /Gönder/i }));
    
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(expectedMessage);
    
    const domHtml = document.body.innerHTML;
    expect(domHtml).not.toContain('Backend Message');
    expect(domHtml).not.toContain('test-token');
  };

  it('maps errors correctly (req 21-30)', async () => {
    await testErrorMapping(401, 'TOKEN_EXPIRED', 'Oturumunuz geçersiz. Lütfen yeniden giriş yapın.');
    vi.clearAllMocks();
    await testErrorMapping(403, 'PERMISSION_DENIED', 'Bu tespiti olaya dönüştürme yetkiniz bulunmuyor.');
    vi.clearAllMocks();
    await testErrorMapping(404, 'NOT_FOUND', 'Tespit kaydı bulunamadı veya bu kayda erişemiyorsunuz.');
    vi.clearAllMocks();
    await testErrorMapping(409, 'DUPLICATE', 'Bu tespit daha önce olaya dönüştürülmüş olabilir.');
    vi.clearAllMocks();
    await testErrorMapping(422, 'VALIDATION_ERROR', 'Olay bilgileri doğrulanamadı. Alanları kontrol edin.');
    vi.clearAllMocks();
    await testErrorMapping(0, 'NETWORK_ERROR', 'Sunucuya ulaşılamıyor. Lütfen bağlantınızı kontrol edin.');
    vi.clearAllMocks();
    await testErrorMapping(500, 'INTERNAL_SERVER_ERROR', 'Olay şu anda oluşturulamıyor. Lütfen daha sonra tekrar deneyin.');
    vi.clearAllMocks();
    
    // Unknown error
    cleanup();
    const user = userEvent.setup();
    vi.mocked(createIncident).mockRejectedValueOnce(new Error('Unknown generic error backend details...'));
    renderForm();
    await user.type(screen.getByLabelText(/Olay Başlığı/i), 'T');
    await user.type(screen.getByLabelText(/Olay Açıklaması/i), 'D');
    await user.click(screen.getByRole('button', { name: /Gönder/i }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Olay güvenli biçimde oluşturulamadı.');
    expect(document.body.innerHTML).not.toContain('Unknown generic error');
  });
});
