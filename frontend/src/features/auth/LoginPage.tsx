import React, { useState } from 'react';
import { useAuth } from './useAuth';
import { SecureWatchBrand } from '../../components/brand/SecureWatchBrand';

export function LoginPage() {
  const { loginUser, isLoading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password) return;

    setErrorMsg(null);

    try {
      await loginUser({ username: trimmedUsername, password });
      // Navigation will be handled in the future router block
    } catch (err: unknown) {
      if (err instanceof Error && err.message) {
        setErrorMsg(err.message);
      } else {
        setErrorMsg('Giriş işlemi başarısız oldu. Lütfen tekrar deneyin.');
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-deep-dark p-4">
      <div className="w-full max-w-[400px] bg-rich-navy border border-space-blue rounded-lg shadow-xl flex flex-col overflow-hidden">

        {/* Header Section */}
        <div className="bg-space-blue/30 p-8 flex flex-col items-center border-b border-space-blue">
          <SecureWatchBrand className="h-16 w-auto mb-4" />
          <h1 className="text-xl font-semibold text-white">SecureWatch AI</h1>
          <p className="text-sm text-gray-400 mt-1">Platform Girişi</p>
        </div>

        {/* Form Section */}
        <form onSubmit={handleSubmit} className="p-8 flex flex-col gap-5">
          {errorMsg && (
            <div
              role="alert"
              className="bg-red-500/10 border border-red-500/50 text-red-200 px-4 py-3 rounded text-sm"
            >
              {errorMsg}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="username-input" className="text-sm font-medium text-gray-300">
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
              className="bg-deep-dark border border-space-blue rounded px-3 py-2 text-white focus:border-cyber-cyan focus:outline-none focus:ring-1 focus:ring-cyber-cyan transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password-input" className="text-sm font-medium text-gray-300">
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
              className="bg-deep-dark border border-space-blue rounded px-3 py-2 text-white focus:border-cyber-cyan focus:outline-none focus:ring-1 focus:ring-cyber-cyan transition-colors"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !username.trim() || !password}
            className="mt-2 w-full bg-cyber-cyan hover:bg-ai-teal text-rich-navy font-semibold py-2.5 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-h-[44px]"
          >
            {isLoading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
          </button>
        </form>

        {/* Security Warning Section */}
        <div className="bg-space-blue/30 p-4 border-t border-space-blue text-xs text-gray-400 text-center">
          Bu sisteme erişim yalnızca yetkili personelle sınırlandırılmıştır. Tüm işlemler kaydedilmektedir.
        </div>
      </div>

      {/* Prototype Footer */}
      <div className="mt-8 text-xs text-gray-500 text-center max-w-[400px]">
        SecureWatch AI v0.1.0-prototype | Akademik ağ trafiği karar destek prototipi
      </div>
    </div>
  );
}
