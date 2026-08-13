import React, { useState } from 'react';
import { useAuth } from './useAuth';
import { useLocation, useNavigate } from 'react-router';
import { getSafeRedirect } from '../../routing/utils';
import { SecureWatchBrand } from '../../components/brand/SecureWatchBrand';
import { ApiError } from '../../api/types';

export function LoginPage() {
  const { loginUser, isLoading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const location = useLocation();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password) return;

    setErrorMsg(null);

    try {
      await loginUser({ username: trimmedUsername, password });
      const state = location.state as { from?: string } | null;
      const safePath = getSafeRedirect(state?.from);
      navigate(safePath, { replace: true });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status >= 500 || err.status === 0) {
          setErrorMsg('Sunucuya şu anda ulaşılamıyor. Lütfen daha sonra tekrar deneyin.');
        } else if (err.status === 401) {
          setErrorMsg('Kullanıcı adı veya parola hatalı.');
        } else {
          setErrorMsg('Giriş işlemi başarısız oldu. Lütfen tekrar deneyin.');
        }
      } else if (err instanceof Error && err.name === 'AbortError') {
        // Ignore aborted requests
      } else {
        setErrorMsg('Giriş işlemi başarısız oldu. Lütfen tekrar deneyin.');
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 sm:p-6 lg:p-12">
      <div className="w-full max-w-5xl sw-surface-elevated flex flex-col lg:flex-row overflow-hidden">

        {/* Left Panel: BRAND / PRODUCT CONTEXT (Desktop) / Compact (Mobile) */}
        <div className="lg:w-1/2 flex flex-col justify-between p-8 lg:p-12 border-b lg:border-b-0 lg:border-r border-border-subtle bg-bg-base/30 relative">

          <div className="flex flex-col items-center lg:items-start text-center lg:text-left z-10">
            <SecureWatchBrand variant="dark" eager className="w-full max-w-[200px] lg:max-w-[240px] h-auto mb-6" />
            <h1 className="sr-only">SecureWatch AI</h1>

            <p className="hidden lg:block text-lg text-text-secondary leading-relaxed mb-10 max-w-[90%]">
              Yapay zekâ destekli ağ trafiği analizi ve saldırı tespit karar destek platformu.
            </p>

            {/* Capability Signals (Desktop only) */}
            <div className="hidden lg:flex flex-col gap-3">
              <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-surface-base border border-border-default shadow-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-accent-primary opacity-80"></div>
                <span className="text-sm font-medium text-text-primary">AI Destekli Analiz</span>
              </div>
              <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-surface-base border border-border-default shadow-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-semantic-warning)] opacity-80"></div>
                <span className="text-sm font-medium text-text-primary">Risk Önceliklendirme</span>
              </div>
              <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-surface-base border border-border-default shadow-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-semantic-success)] opacity-80"></div>
                <span className="text-sm font-medium text-text-primary">Güvenli Olay Yönetimi</span>
              </div>
            </div>
          </div>

          <div className="hidden lg:block z-10 mt-12 text-xs font-medium text-text-muted">
            SecureWatch AI v0.1.0-prototype | Akademik ağ trafiği karar destek prototipi
          </div>

          {/* Ambient visual treatment */}
          <div className="absolute inset-0 bg-gradient-to-br from-[rgba(91,192,190,0.03)] to-transparent pointer-events-none"></div>
        </div>

        {/* Right Panel: AUTHENTICATION */}
        <div className="lg:w-1/2 flex flex-col justify-center p-8 lg:p-12 bg-bg-base/50">

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-text-primary mb-2">Platform Girişi</h2>
            <p className="text-sm text-text-secondary">Yetkili hesabınızla güvenli çalışma alanına erişin.</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {errorMsg && (
              <div
                role="alert"
                className="bg-[var(--color-semantic-danger-bg)] border border-[var(--color-semantic-danger)]/30 text-[var(--color-semantic-danger)] px-4 py-3 rounded-lg text-sm flex items-start gap-2"
              >
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="username-input" className="text-sm font-medium text-text-secondary">
                Kullanıcı adı
              </label>
              <input
                id="username-input"
                type="text"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading}
                required
                className="sw-input w-full"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password-input" className="text-sm font-medium text-text-secondary">
                Parola
              </label>
              <input
                id="password-input"
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                required
                className="sw-input w-full"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !username.trim() || !password}
              className="sw-button-primary mt-2 w-full min-h-[44px]"
            >
              {isLoading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </button>
          </form>

          {/* Security Notice */}
          <div className="mt-8 border-t border-border-default pt-6 text-xs text-text-muted">
            Bu sisteme erişim yalnızca yetkili personelle sınırlandırılmıştır. Tüm işlemler kaydedilmektedir.
          </div>

          {/* Mobile Footer */}
          <div className="block lg:hidden mt-6 text-xs text-center font-medium text-text-muted">
            SecureWatch AI v0.1.0-prototype
          </div>
        </div>

      </div>
    </div>
  );
}
