import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../auth/useAuth';
import { listAssignableAnalysts } from '../analystApi';
import { updateIncident } from '../api';
import type { IncidentDetail, IncidentListItem } from '../types';
import type { UserResponse } from '../../auth/types';
import { ApiError } from '../../../api/types';

export interface IncidentAssignmentPanelProps {
  incident: IncidentDetail;
  onUpdated: (incident: IncidentListItem) => void;
}

export const IncidentAssignmentPanel: React.FC<IncidentAssignmentPanelProps> = ({ incident, onUpdated }) => {
  const { isAuthenticated, accessToken, user } = useAuth();
  
  const [analysts, setAnalysts] = useState<UserResponse[]>([]);
  const [isListLoading, setIsListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedAnalystId, setSelectedAnalystId] = useState<string>(
    incident.assigned_analyst_id ? incident.assigned_analyst_id.toString() : ''
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const abortControllerListRef = useRef<AbortController | null>(null);
  const abortControllerSubmitRef = useRef<AbortController | null>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  const loadAnalysts = async () => {
    if (!accessToken) return;

    if (abortControllerListRef.current) {
      abortControllerListRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerListRef.current = controller;

    try {
      const data = await listAssignableAnalysts(accessToken, controller.signal);
      if (abortControllerListRef.current === controller) {
        setAnalysts(data);
        setListError(null);
        setIsListLoading(false);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      if (abortControllerListRef.current === controller) {
        let errorMessage = 'Analist güvenli biçimde atanamadı.';
        if (err instanceof ApiError) {
          switch (err.status) {
            case 401:
              errorMessage = 'Oturumunuz geçersiz. Lütfen yeniden giriş yapın.';
              break;
            case 403:
              errorMessage = 'Bu olaya analist atama yetkiniz bulunmuyor.';
              break;
            case 404:
              errorMessage = 'Kullanıcı listesi alınamadı.';
              break;
            case 500:
              if (err.code === 'INVALID_USERS_RESPONSE') {
                errorMessage = 'Analist atama işlemi şu anda tamamlanamıyor.';
              } else {
                errorMessage = 'Analist atama işlemi şu anda tamamlanamıyor.';
              }
              break;
            case 0:
              errorMessage = 'Sunucuya ulaşılamıyor. Lütfen bağlantınızı kontrol edin.';
              break;
            default:
              errorMessage = 'Analist atama işlemi şu anda tamamlanamıyor.';
              break;
          }
        }
        setListError(errorMessage);
        setIsListLoading(false);
      }
    }
  };

  useEffect(() => {
    if (isAuthenticated && accessToken && user && user.role === 'ADMIN') {
      setIsListLoading(true);
      setListError(null);
      loadAnalysts();
    }
    return () => {
      if (abortControllerListRef.current) {
        abortControllerListRef.current.abort();
      }
      if (abortControllerSubmitRef.current) {
        abortControllerSubmitRef.current.abort();
      }
    };
  }, [incident.id, accessToken, isAuthenticated, user]); // incident.id explicitly as requirement

  useEffect(() => {
    setSelectedAnalystId(incident.assigned_analyst_id ? incident.assigned_analyst_id.toString() : '');
  }, [incident.assigned_analyst_id]);

  if (!isAuthenticated || !accessToken || !user || user.role !== 'ADMIN') {
    return null;
  }

  const handleRetryList = () => {
    setIsListLoading(true);
    setListError(null);
    loadAnalysts();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isListLoading || listError || analysts.length === 0 || !selectedAnalystId || isSubmitting) {
      return;
    }

    const parsedId = parseInt(selectedAnalystId, 10);
    if (isNaN(parsedId) || parsedId <= 0) {
      return;
    }

    const analystExists = analysts.some(a => a.id === parsedId);
    if (!analystExists) {
      return;
    }

    if (parsedId === incident.assigned_analyst_id) {
      return;
    }

    if (abortControllerSubmitRef.current) {
      abortControllerSubmitRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerSubmitRef.current = controller;

    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      const updatedIncident = await updateIncident(
        incident.id,
        { assigned_analyst_id: parsedId },
        accessToken,
        controller.signal
      );

      if (abortControllerSubmitRef.current === controller) {
        onUpdated(updatedIncident);
        setSuccessMessage('Olay analiste başarıyla atandı.');
        setIsSubmitting(false);
        setTimeout(() => {
          if (selectRef.current) {
            selectRef.current.focus();
          }
        }, 0);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      if (abortControllerSubmitRef.current === controller) {
        let errorMessage = 'Analist güvenli biçimde atanamadı.';
        if (err instanceof ApiError) {
          switch (err.status) {
            case 400:
              errorMessage = 'Seçilen kullanıcı bu olaya atanamaz.';
              break;
            case 401:
              errorMessage = 'Oturumunuz geçersiz. Lütfen yeniden giriş yapın.';
              break;
            case 403:
              errorMessage = 'Bu olaya analist atama yetkiniz bulunmuyor.';
              break;
            case 404:
              errorMessage = 'Olay veya seçilen analist bulunamadı.';
              break;
            case 409:
              errorMessage = 'Olay ataması başka bir işlem nedeniyle değişmiş olabilir. Olay detayını yenileyin.';
              break;
            case 422:
              errorMessage = 'Analist atama bilgisi doğrulanamadı.';
              break;
            case 500:
              errorMessage = 'Analist atama işlemi şu anda tamamlanamıyor.';
              break;
            case 0:
              errorMessage = 'Sunucuya ulaşılamıyor. Lütfen bağlantınızı kontrol edin.';
              break;
          }
        }
        setSubmitError(errorMessage);
        setIsSubmitting(false);
      }
    }
  };

  const isSubmitDisabled = isListLoading || !!listError || analysts.length === 0 || !selectedAnalystId || isSubmitting || parseInt(selectedAnalystId, 10) === incident.assigned_analyst_id;

  return (
    <div className="bg-deep-dark p-6 rounded-xl border border-space-blue mb-8">
      <h3 className="text-lg font-bold text-white mb-4">Analist Atama</h3>
      
      {isListLoading ? (
        <div role="status" aria-live="polite" aria-busy="true" className="text-slate-300">
          Analistler yükleniyor...
        </div>
      ) : listError ? (
        <div role="alert" className="text-red-300 mb-4">
          {listError}
          <button onClick={handleRetryList} className="ml-4 text-ai-teal underline">Tekrar Dene</button>
        </div>
      ) : analysts.length === 0 ? (
        <div className="text-slate-400">
          Atanabilir analist bulunamadı.
        </div>
      ) : (
        <form onSubmit={handleSubmit} aria-busy={isSubmitting}>
          {submitError && (
            <div role="alert" className="mb-4 p-3 bg-red-900/50 border border-red-500/50 rounded text-red-200 text-sm">
              {submitError}
            </div>
          )}
          {successMessage && (
            <div role="status" aria-live="polite" className="mb-4 p-3 bg-green-900/50 border border-green-500/50 rounded text-green-200 text-sm">
              {successMessage}
            </div>
          )}
          
          <div className="flex flex-col gap-2 mb-4">
            <label htmlFor={`analyst-select-${incident.id}`} className="text-sm font-semibold text-slate-300">
              Atanacak Analist
            </label>
            <select
              id={`analyst-select-${incident.id}`}
              ref={selectRef}
              value={selectedAnalystId}
              onChange={(e) => setSelectedAnalystId(e.target.value)}
              disabled={isSubmitting}
              className="bg-rich-navy border border-space-blue text-white text-sm rounded-lg p-2.5 focus:ring-ai-teal focus:border-ai-teal outline-none transition-all disabled:opacity-50"
            >
              <option value="">Analist seçin</option>
              {analysts.map((a) => (
                <option key={a.id} value={a.id.toString()}>
                  {a.username}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            ref={submitButtonRef}
            disabled={isSubmitDisabled}
            className="w-full sm:w-auto px-5 py-2.5 bg-ai-teal hover:bg-teal-500 text-deep-dark font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Atanıyor...' : 'Analisti Ata'}
          </button>
        </form>
      )}
    </div>
  );
};
