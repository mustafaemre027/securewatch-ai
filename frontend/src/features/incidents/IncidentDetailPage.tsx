import React from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { IncidentDetail } from './components/IncidentDetail';

export const IncidentDetailPage: React.FC = () => {
  const { incidentId } = useParams<{ incidentId: string }>();
  const navigate = useNavigate();

  const isValidId = (idStr?: string) => {
    if (!idStr) return false;
    if (!/^\d+$/.test(idStr)) return false;
    const num = Number(idStr);
    return Number.isSafeInteger(num) && num > 0;
  };

  if (!isValidId(incidentId)) {
    return (
      <div className="w-full max-w-4xl mx-auto p-6 bg-rich-navy border border-space-blue rounded-xl text-center">
        <div role="alert" className="text-red-300 bg-red-900/50 border border-red-500/50 p-4 rounded-lg mb-6">
          Geçersiz veya eksik olay kimliği. Lütfen olay listesinden geçerli bir kayıt seçin.
        </div>
        <Link
          to="/incidents"
          className="inline-block px-4 py-2 bg-ai-teal hover:bg-teal-500 text-deep-dark font-bold rounded-lg transition-colors"
        >
          Olay Listesine Dön
        </Link>
      </div>
    );
  }

  const handleBack = () => {
    navigate('/incidents');
  };

  return (
    <IncidentDetail
      incidentId={Number(incidentId)}
      onBack={handleBack}
    />
  );
};
