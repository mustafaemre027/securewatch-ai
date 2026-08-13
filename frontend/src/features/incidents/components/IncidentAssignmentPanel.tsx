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
  
  const currentKey = `${incident.id}-${accessToken || ''}`;

  const [listState, setListState] = useState<{
    key: string;
    loading: boolean;
    error: string | null;
    analysts: UserResponse[];
  }>({
    key: '',
    loading: true,
    error: null,
    analysts: [],
  });

  const [userSelectedValue, setUserSelectedValue] = useState<{
    incidentId: number;
    assignedId: number | null;
    value: string;
  } | null>(null);

  const [submitState, setSubmitState] = useState<{
    incidentId: number;
    submitting: boolean;
    error: string | null;
    success: string | null;
  }>({
    incidentId: incident.id,
    submitting: false,
    error: null,
    success: null,
  });

  const abortControllerListRef = useRef<AbortController | null>(null);
  const abortControllerSubmitRef = useRef<AbortController | null>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const submitButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isAuthenticated || !accessToken || !user || user.role !== 'ADMIN') {
      return;
    }

    if (abortControllerListRef.current) {
      abortControllerListRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerListRef.current = controller;

    const fetchAnalystsData = async (token: string, ctrl: AbortController, key: string) => {
      try {
        const data = await listAssignableAnalysts(token, ctrl.signal);
        if (abortControllerListRef.current === ctrl) {
          setListState({
            key,
            loading: false,
            error: null,
            analysts: data,
          });
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        if (abortControllerListRef.current === ctrl) {
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
          setListState({
            key,
            loading: false,
            error: errorMessage,
            analysts: [],
          });
        }
      }
    };

    fetchAnalystsData(accessToken, controller, currentKey);

    return () => {
      if (abortControllerListRef.current) {
        abortControllerListRef.current.abort();
      }
      if (abortControllerSubmitRef.current) {
        abortControllerSubmitRef.current.abort();
      }
    };
  }, [incident.id, accessToken, isAuthenticated, user, currentKey]);

  if (!isAuthenticated || !accessToken || !user || user.role !== 'ADMIN') {
    return null;
  }

  const isListLoading = listState.key !== currentKey || listState.loading;
  const listError = listState.key === currentKey ? listState.error : null;
  const analysts = listState.key === currentKey ? listState.analysts : [];

  let selectedAnalystId = incident.assigned_analyst_id ? incident.assigned_analyst_id.toString() : '';
  if (userSelectedValue && userSelectedValue.incidentId === incident.id && userSelectedValue.assignedId === incident.assigned_analyst_id) {
    selectedAnalystId = userSelectedValue.value;
  }

  const isSubmitting = submitState.incidentId === incident.id ? submitState.submitting : false;
  const submitError = submitState.incidentId === incident.id ? submitState.error : null;
  const successMessage = submitState.incidentId === incident.id ? submitState.success : null;

  const handleRetryList = () => {
    setListState(prev => ({ ...prev, key: currentKey, loading: true, error: null }));
    if (abortControllerListRef.current) {
      abortControllerListRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerListRef.current = controller;

    const fetchAnalystsData = async (token: string, ctrl: AbortController, key: string) => {
      try {
        const data = await listAssignableAnalysts(token, ctrl.signal);
        if (abortControllerListRef.current === ctrl) {
          setListState({
            key,
            loading: false,
            error: null,
            analysts: data,
          });
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        if (abortControllerListRef.current === ctrl) {
          let errorMessage = 'Analist güvenli biçimde atanamadı.';
          if (err instanceof ApiError) {
            switch (err.status) {
              case 401: errorMessage = 'Oturumunuz geçersiz. Lütfen yeniden giriş yapın.'; break;
              case 403: errorMessage = 'Bu olaya analist atama yetkiniz bulunmuyor.'; break;
              case 404: errorMessage = 'Kullanıcı listesi alınamadı.'; break;
              case 500: errorMessage = 'Analist atama işlemi şu anda tamamlanamıyor.'; break;
              case 0: errorMessage = 'Sunucuya ulaşılamıyor. Lütfen bağlantınızı kontrol edin.'; break;
              default: errorMessage = 'Analist atama işlemi şu anda tamamlanamıyor.'; break;
            }
          }
          setListState({
            key,
            loading: false,
            error: errorMessage,
            analysts: [],
          });
        }
      }
    };

    fetchAnalystsData(accessToken || '', controller, currentKey);
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

    setSubmitState({
      incidentId: incident.id,
      submitting: true,
      error: null,
      success: null,
    });

    try {
      const updatedIncident = await updateIncident(
        incident.id,
        { assigned_analyst_id: parsedId },
        accessToken,
        controller.signal
      );

      if (abortControllerSubmitRef.current === controller) {
        onUpdated(updatedIncident);
        setSubmitState({
          incidentId: incident.id,
          submitting: false,
          error: null,
          success: 'Olay analiste başarıyla atandı.',
        });
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
        setSubmitState({
          incidentId: incident.id,
          submitting: false,
          error: errorMessage,
          success: null,
        });
      }
    }
  };

  const isSubmitDisabled = isListLoading || !!listError || analysts.length === 0 || !selectedAnalystId || isSubmitting || parseInt(selectedAnalystId, 10) === incident.assigned_analyst_id;

  return (
    <div className="bg-[var(--color-surface-elevated)] p-5 md:p-6 rounded-xl border border-[var(--color-border-subtle)] mb-8">
      <h3 className="text-base font-bold text-[var(--color-text-primary)] mb-5">Analist Atama</h3>
      
      {isListLoading ? (
        <div role="status" aria-live="polite" aria-busy="true" className="text-[var(--color-text-secondary)] font-medium text-sm">
          Analistler yükleniyor...
        </div>
      ) : listError ? (
        <div role="alert" className="text-[var(--color-semantic-danger)] text-sm font-medium mb-4 flex items-center gap-3">
          {listError}
          <button onClick={handleRetryList} className="text-[var(--color-text-accent)] hover:underline outline-none focus:ring-2 focus:ring-[var(--color-text-accent)] rounded">Tekrar Dene</button>
        </div>
      ) : analysts.length === 0 ? (
        <div className="text-[var(--color-text-secondary)] text-sm">
          Atanabilir analist bulunamadı.
        </div>
      ) : (
        <form onSubmit={handleSubmit} aria-busy={isSubmitting}>
          {submitError && (
            <div role="alert" className="mb-4 p-3 bg-[var(--color-semantic-danger)]/10 border border-[var(--color-semantic-danger)]/20 rounded-lg text-[var(--color-semantic-danger)] text-sm font-medium">
              {submitError}
            </div>
          )}
          {successMessage && (
            <div role="status" aria-live="polite" className="mb-4 p-3 bg-[var(--color-semantic-success)]/10 border border-[var(--color-semantic-success)]/20 rounded-lg text-[var(--color-semantic-success)] text-sm font-medium">
              {successMessage}
            </div>
          )}
          
          <div className="flex flex-col gap-1.5 mb-5">
            <label htmlFor={`analyst-select-${incident.id}`} className="text-sm font-bold text-[var(--color-text-secondary)]">
              Atanacak Analist
            </label>
            <select
              id={`analyst-select-${incident.id}`}
              ref={selectRef}
              value={selectedAnalystId}
              onChange={(e) => setUserSelectedValue({
                incidentId: incident.id,
                assignedId: incident.assigned_analyst_id,
                value: e.target.value
              })}
              disabled={isSubmitting}
              className="bg-[var(--color-surface-base)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] text-sm font-medium rounded-lg px-3 py-2.5 focus:border-[var(--color-text-accent)] focus:ring-1 focus:ring-[var(--color-text-accent)] outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:max-w-md appearance-none"
              style={{ backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a99a8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.75rem center', backgroundSize: '1em' }}
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
            className="w-full sm:w-auto px-5 py-2.5 bg-[var(--color-text-accent)] hover:opacity-90 text-[var(--color-surface-base)] font-bold rounded-lg transition-opacity disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[var(--color-text-accent)] focus:ring-offset-2 focus:ring-offset-[var(--color-surface-elevated)]"
          >
            {isSubmitting ? 'Atanıyor...' : 'Analisti Ata'}
          </button>
        </form>
      )}
    </div>
  );
};
