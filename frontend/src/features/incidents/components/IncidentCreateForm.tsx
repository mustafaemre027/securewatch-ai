import React, { useState, useRef, useEffect } from 'react';
import type { DetectionResult } from '../../detections/types';
import type { IncidentListItem, IncidentSeverity } from '../types';
import { createIncident } from '../api';
import { ApiError } from '../../../api/types';

interface IncidentCreateFormProps {
  detectionResult: DetectionResult;
  accessToken: string;
  onCreated: (incident: IncidentListItem) => void;
  onCancel: () => void;
}

export const IncidentCreateForm: React.FC<IncidentCreateFormProps> = ({
  detectionResult,
  accessToken,
  onCreated,
  onCancel,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<IncidentSeverity>(detectionResult.risk_level as IncidentSeverity);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    titleInputRef.current?.focus();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !isSubmitting) {
      onCancel();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();

    if (!trimmedTitle) {
      setFormError('Olay Başlığı alanı boş olamaz.');
      return;
    }

    if (trimmedTitle.length > 150) {
      setFormError('Başlık 150 karakterden uzun olamaz.');
      return;
    }

    if (!trimmedDescription) {
      setFormError('Olay Açıklaması alanı boş olamaz.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const incident = await createIncident(
        {
          detection_result_id: detectionResult.id,
          title: trimmedTitle,
          description: trimmedDescription,
          severity,
        },
        accessToken,
        controller.signal
      );
      
      onCreated(incident);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'name' in err && (err as Error).name === 'AbortError') {
        setIsSubmitting(false);
        return;
      }

      let errorMessage = 'Olay güvenli biçimde oluşturulamadı.';

      const isApiError = err instanceof ApiError || (err && typeof err === 'object' && 'status' in err && 'code' in err);

      if (isApiError) {
        const apiErr = err as ApiError;
        const statusCode = `${apiErr.status}_${apiErr.code}`;
        switch (statusCode) {
          case '401_CREDENTIALS_INVALID':
          case '401_TOKEN_INVALID':
          case '401_TOKEN_EXPIRED':
            errorMessage = 'Oturumunuz geçersiz. Lütfen yeniden giriş yapın.';
            break;
          case '403_PERMISSION_DENIED':
            errorMessage = 'Bu tespiti olaya dönüştürme yetkiniz bulunmuyor.';
            break;
          case '404_NOT_FOUND':
            errorMessage = 'Tespit kaydı bulunamadı veya bu kayda erişemiyorsunuz.';
            break;
          case '409_CONFLICT':
          case '409_ALREADY_EXISTS':
          case '409_DUPLICATE':
            errorMessage = 'Bu tespit daha önce olaya dönüştürülmüş olabilir.';
            break;
          case '422_VALIDATION_ERROR':
            errorMessage = 'Olay bilgileri doğrulanamadı. Alanları kontrol edin.';
            break;
          case '0_NETWORK_ERROR':
            errorMessage = 'Sunucuya ulaşılamıyor. Lütfen bağlantınızı kontrol edin.';
            break;
          case '500_INTERNAL_SERVER_ERROR':
            errorMessage = 'Olay şu anda oluşturulamıyor. Lütfen daha sonra tekrar deneyin.';
            break;
          default:
            if (apiErr.status === 409) {
               errorMessage = 'Bu tespit daha önce olaya dönüştürülmüş olabilir.';
            } else if (apiErr.status === 404) {
               errorMessage = 'Tespit kaydı bulunamadı veya bu kayda erişemiyorsunuz.';
            } else if (apiErr.status === 403) {
               errorMessage = 'Bu tespiti olaya dönüştürme yetkiniz bulunmuyor.';
            } else if (apiErr.status === 401) {
               errorMessage = 'Oturumunuz geçersiz. Lütfen yeniden giriş yapın.';
            } else if (apiErr.status === 422) {
               errorMessage = 'Olay bilgileri doğrulanamadı. Alanları kontrol edin.';
            } else if (apiErr.status >= 500) {
               errorMessage = 'Olay şu anda oluşturulamıyor. Lütfen daha sonra tekrar deneyin.';
            }
            break;
        }
      }

      setFormError(errorMessage);
      setIsSubmitting(false);
    }
  };

  const getRiskLabel = (risk: string) => {
    switch (risk) {
      case 'LOW': return 'Düşük';
      case 'MEDIUM': return 'Orta';
      case 'HIGH': return 'Yüksek';
      case 'CRITICAL': return 'Kritik';
      default: return risk;
    }
  };

  const probabilityStr = `%${(detectionResult.attack_probability * 100).toFixed(2).replace(/\.00$/, '')}`;

  return (
    <div 
      className="p-4 bg-rich-navy border border-space-blue rounded-xl mt-4 w-full"
      onKeyDown={handleKeyDown}
      role="region"
      aria-label="Tespiti Olaya Dönüştür"
    >
      <h4 className="text-lg font-bold text-white mb-4">Tespiti Olaya Dönüştür</h4>
      
      <div className="mb-4 p-3 bg-deep-dark border border-space-blue rounded-lg text-sm flex flex-col md:flex-row gap-4">
        <div>
          <span className="text-slate-300 font-semibold block text-xs uppercase mb-1">CSV Satırı</span>
          <span className="text-white font-bold">Satır {detectionResult.row_index + 1}</span>
        </div>
        <div>
          <span className="text-slate-300 font-semibold block text-xs uppercase mb-1">Saldırı Olasılığı</span>
          <span className="text-white font-bold">{probabilityStr}</span>
        </div>
        <div>
          <span className="text-slate-300 font-semibold block text-xs uppercase mb-1">Risk Seviyesi</span>
          <span className="text-white font-bold">{getRiskLabel(detectionResult.risk_level)}</span>
        </div>
      </div>

      {formError && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-500/50 rounded-lg text-red-200 text-sm font-medium" role="alert">
          {formError}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="mb-4">
          <label htmlFor="incident-title" className="block text-sm font-semibold text-slate-300 mb-1">
            Olay Başlığı <span className="text-red-400">*</span>
          </label>
          <input
            ref={titleInputRef}
            type="text"
            id="incident-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={150}
            disabled={isSubmitting}
            aria-describedby="incident-title-desc"
            className="w-full bg-deep-dark border border-space-blue text-white text-sm rounded-lg p-2.5 focus:ring-2 focus:ring-ai-teal focus:border-transparent outline-none disabled:opacity-70"
            required
          />
          <div id="incident-title-desc" className="text-xs text-slate-400 mt-1 flex justify-end">
            {title.length}/150
          </div>
        </div>

        <div className="mb-4">
          <label htmlFor="incident-description" className="block text-sm font-semibold text-slate-300 mb-1">
            Olay Açıklaması <span className="text-red-400">*</span>
          </label>
          <textarea
            id="incident-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isSubmitting}
            rows={4}
            className="w-full bg-deep-dark border border-space-blue text-white text-sm rounded-lg p-2.5 focus:ring-2 focus:ring-ai-teal focus:border-transparent outline-none disabled:opacity-70 resize-y"
            required
          />
        </div>

        <div className="mb-6">
          <label htmlFor="incident-severity" className="block text-sm font-semibold text-slate-300 mb-1">
            Önem Seviyesi <span className="text-red-400">*</span>
          </label>
          <select
            id="incident-severity"
            value={severity}
            onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
            disabled={isSubmitting}
            className="w-full bg-deep-dark border border-space-blue text-white text-sm rounded-lg p-2.5 focus:ring-2 focus:ring-ai-teal focus:border-transparent outline-none disabled:opacity-70"
            required
          >
            <option value="LOW">Düşük</option>
            <option value="MEDIUM">Orta</option>
            <option value="HIGH">Yüksek</option>
            <option value="CRITICAL">Kritik</option>
          </select>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-space-blue pt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-bold text-slate-300 hover:text-white transition-colors disabled:opacity-70"
          >
            İptal
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            className="px-4 py-2 bg-ai-teal text-white text-sm font-bold rounded-lg hover:bg-teal-500 transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <svg aria-hidden="true" className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Olay Oluşturuluyor...
              </>
            ) : (
              'Gönder'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
