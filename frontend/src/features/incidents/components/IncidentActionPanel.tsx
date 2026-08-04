import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../auth/useAuth';
import { updateIncident } from '../api';
import type { IncidentDetail as IncidentDetailType, IncidentListItem } from '../types';
import { ApiError } from '../../../api/types';

export interface IncidentActionPanelProps {
  incident: IncidentDetailType;
  onUpdated: (incident: IncidentListItem) => void;
}

export const IncidentActionPanel: React.FC<IncidentActionPanelProps> = ({ incident, onUpdated }) => {
  const { isAuthenticated, accessToken, user } = useAuth();
  
  const [pendingAction, setPendingAction] = useState<'CLAIM' | 'START' | 'RESOLVE' | 'FALSE_POSITIVE' | null>(null);
  const [confirmationAction, setConfirmationAction] = useState<'RESOLVE' | 'FALSE_POSITIVE' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const submittingRef = useRef<boolean>(false);
  
  // Track previous incident ID to clear state
  const prevIncidentIdRef = useRef<number>(incident.id);
  
  // Focus ref for confirmation cancel
  const triggerBtnRef = useRef<HTMLButtonElement | null>(null);
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (prevIncidentIdRef.current !== incident.id) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      submittingRef.current = false;
      setPendingAction(null);
      setConfirmationAction(null);
      setActionError(null);
      setSuccessMessage(null);
      prevIncidentIdRef.current = incident.id;
    }
  }, [incident.id]);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // When confirmation opens, focus confirm button
  useEffect(() => {
    if (confirmationAction && confirmBtnRef.current) {
      confirmBtnRef.current.focus();
    }
  }, [confirmationAction]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && confirmationAction && !pendingAction) {
        handleCancelConfirmation();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [confirmationAction, pendingAction]);

  const handleCancelConfirmation = () => {
    setConfirmationAction(null);
    if (triggerBtnRef.current) {
      triggerBtnRef.current.focus();
    }
  };

  const getErrorMessage = (error: unknown, isClaim: boolean): string => {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return '';
    }
    if (error instanceof ApiError) {
      switch (error.status) {
        case 401: return 'Oturumunuz geçersiz. Lütfen yeniden giriş yapın.';
        case 403: return 'Bu olay üzerinde işlem yapma yetkiniz bulunmuyor.';
        case 404: return 'Olay kaydı bulunamadı veya bu kayda erişemiyorsunuz.';
        case 409: return isClaim 
          ? 'Olay başka bir analist tarafından sahiplenilmiş olabilir. Olay detayını yenileyin.' 
          : 'Olay başka bir işlem nedeniyle güncellenmiş olabilir. Olay detayını yenileyin.';
        case 422: return 'Seçilen olay işlemi doğrulanamadı.';
        case 500: return 'Olay işlemi şu anda tamamlanamıyor.';
        case 0: return 'Sunucuya ulaşılamıyor. Lütfen bağlantınızı kontrol edin.';
        default: return 'Olay işlemi güvenli biçimde tamamlanamadı.';
      }
    }
    return 'Olay işlemi güvenli biçimde tamamlanamadı.';
  };

  const executeAction = async (actionType: 'CLAIM' | 'START' | 'RESOLVE' | 'FALSE_POSITIVE', payload: any) => {
    if (submittingRef.current || !accessToken) return;
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    submittingRef.current = true;
    
    setPendingAction(actionType);
    setActionError(null);
    setSuccessMessage(null);
    
    try {
      const response = await updateIncident(incident.id, payload, accessToken, abortControllerRef.current.signal);
      
      setConfirmationAction(null);
      
      if (actionType === 'CLAIM') setSuccessMessage('Olay başarıyla üzerinize atandı.');
      else if (actionType === 'START') setSuccessMessage('Olay incelemeye alındı.');
      else if (actionType === 'RESOLVE') setSuccessMessage('Olay çözüldü olarak kapatıldı.');
      else if (actionType === 'FALSE_POSITIVE') setSuccessMessage('Olay yanlış pozitif olarak kapatıldı.');
      
      onUpdated(response);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        // Ignored
      } else {
        setActionError(getErrorMessage(err, actionType === 'CLAIM'));
      }
    } finally {
      if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
        submittingRef.current = false;
        setPendingAction(null);
      }
    }
  };

  const handleClaim = () => {
    if (!user) return;
    executeAction('CLAIM', { assigned_analyst_id: user.id });
  };

  const handleStart = () => {
    executeAction('START', { status: 'IN_PROGRESS' });
  };

  const handleResolve = () => {
    executeAction('RESOLVE', { status: 'RESOLVED' });
  };

  const handleFalsePositive = () => {
    executeAction('FALSE_POSITIVE', { status: 'FALSE_POSITIVE' });
  };

  const handleOpenConfirm = (action: 'RESOLVE' | 'FALSE_POSITIVE', e: React.MouseEvent<HTMLButtonElement>) => {
    triggerBtnRef.current = e.currentTarget;
    setConfirmationAction(action);
    setActionError(null);
  };

  if (!isAuthenticated || !accessToken || !user) {
    return null;
  }

  if (user.role !== 'ANALYST') {
    if (user.role === 'ADMIN') {
      return (
        <div className="bg-deep-dark p-6 rounded-xl border border-space-blue mt-6">
          <p className="text-slate-400">Yetkiniz yok. Yönetici hesapları olayları yalnızca salt okunur görüntüleyebilir.</p>
        </div>
      );
    }
    return null;
  }

  const isAssignedToMe = incident.assigned_analyst_id === user.id;
  const isAssignedToOther = incident.assigned_analyst_id !== null && incident.assigned_analyst_id !== user.id;
  const isUnassigned = incident.assigned_analyst_id === null;
  
  const isTerminal = incident.status === 'RESOLVED' || incident.status === 'FALSE_POSITIVE';
  
  return (
    <div className="bg-deep-dark p-6 rounded-xl border border-space-blue mt-6" aria-busy={!!pendingAction}>
      <h3 className="text-lg font-bold text-white mb-4">Olay İşlemleri</h3>
      
      {actionError && (
        <div role="alert" className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded text-red-200 text-sm">
          {actionError}
        </div>
      )}
      
      {successMessage && (
        <div role="status" aria-live="polite" className="mb-4 p-3 bg-green-900/50 border border-green-500 rounded text-green-200 text-sm">
          {successMessage}
        </div>
      )}
      
      {isAssignedToOther && (
        <p className="text-slate-400">Bu olay başka bir analiste atanmış.</p>
      )}
      
      {isTerminal && (
        <p className="text-slate-400">
          {incident.status === 'RESOLVED' ? 'Bu olay çözümlenmiş ve kapatılmıştır.' : 'Bu olay yanlış pozitif olarak kapatılmıştır.'}
        </p>
      )}
      
      {isUnassigned && incident.status === 'OPEN' && !isTerminal && (
        <div>
          <button 
            onClick={handleClaim} 
            disabled={!!pendingAction}
            className="px-4 py-2 bg-space-blue text-white rounded font-medium hover:bg-space-blue/80 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {pendingAction === 'CLAIM' ? 'Olay Atanıyor...' : 'Olayı Üzerime Al'}
          </button>
        </div>
      )}
      
      {isAssignedToMe && !isTerminal && (
        <div className="flex flex-wrap gap-3">
          {incident.status === 'OPEN' && (
            <button 
              onClick={handleStart}
              disabled={!!pendingAction}
              className="px-4 py-2 bg-blue-600 text-white rounded font-medium hover:bg-blue-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {pendingAction === 'START' ? 'İnceleme Başlatılıyor...' : 'İncelemeyi Başlat'}
            </button>
          )}
          
          {incident.status === 'IN_PROGRESS' && (
            <button 
              onClick={(e) => handleOpenConfirm('RESOLVE', e)}
              disabled={!!pendingAction}
              className="px-4 py-2 bg-green-600 text-white rounded font-medium hover:bg-green-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {pendingAction === 'RESOLVE' ? 'Olay Kapatılıyor...' : 'Çözüldü Olarak İşaretle'}
            </button>
          )}
          
          <button 
            onClick={(e) => handleOpenConfirm('FALSE_POSITIVE', e)}
            disabled={!!pendingAction}
            className="px-4 py-2 bg-slate-600 text-white rounded font-medium hover:bg-slate-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            {pendingAction === 'FALSE_POSITIVE' ? 'Olay Kapatılıyor...' : 'Yanlış Pozitif Olarak İşaretle'}
          </button>
        </div>
      )}
      
      {confirmationAction && (
        <div 
          role="alertdialog" 
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          className="mt-4 p-4 border border-yellow-500/50 bg-yellow-900/20 rounded-lg"
        >
          <h4 id="confirm-dialog-title" className="text-yellow-500 font-bold mb-2">
            İşlemi Onaylayın
          </h4>
          <p className="text-slate-300 mb-4 text-sm">Bu işlem geri alınamaz.</p>
          <div className="flex gap-3">
            <button 
              ref={confirmBtnRef}
              onClick={confirmationAction === 'RESOLVE' ? handleResolve : handleFalsePositive}
              disabled={!!pendingAction}
              className="px-4 py-2 bg-red-600 text-white text-sm rounded font-medium hover:bg-red-700 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              İşlemi Onayla
            </button>
            <button 
              onClick={handleCancelConfirmation}
              disabled={!!pendingAction}
              className="px-4 py-2 bg-slate-700 text-white text-sm rounded font-medium hover:bg-slate-600 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-slate-400"
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
