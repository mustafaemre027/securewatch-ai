# SecureWatch AI

Yapay zekâ destekli ağ trafiği analizi ve saldırı tespit karar destek platformu.

## Proje Özeti

SecureWatch AI, ağ trafiği kayıtlarını makine öğrenmesi yöntemleriyle analiz ederek normal ve şüpheli bağlantıları sınıflandıran, model sonuçlarını açıklanabilir risk skorlarıyla sunan ve yüksek riskli kayıtları yönetilebilir güvenlik olaylarına dönüştüren web tabanlı bir karar destek platformudur.

Bu proje üretim ortamında kullanılabilecek gerçek zamanlı bir IDS/IPS değildir. Akademik ve kurumsal karar destek prototipi olarak geliştirilmektedir.

## Temel Özellikler

- **Kullanıcı Yönetimi:** JWT tabanlı kimlik doğrulama, yönetici ve güvenlik analisti rolleri
- **Veri Yükleme:** CSV formatında ağ trafiği verisi yükleme, doğrulama ve analiz
- **Makine Öğrenmesi:** İkili sınıflandırma (normal/şüpheli), model karşılaştırma
- **Risk Skorlaması:** LOW, MEDIUM, HIGH, CRITICAL seviyelerinde risk değerlendirmesi
- **Olay Yönetimi:** Şüpheli tespitlerin güvenlik olaylarına dönüştürülmesi ve yönetimi
- **Dashboard:** Tamamlanan analizlerden üretilen güncel özet istatistikler, grafikler ve model performans metrikleri

## Kullanıcı Rolleri

| Rol | Yetkiler |
|-----|----------|
| **Yönetici (Admin)** | Kullanıcı yönetimi, tüm analiz ve olayları görüntüleme, model bilgileri, audit log, olay atama |
| **Güvenlik Analisti (Analyst)** | Trafik verisi yükleme, analiz başlatma, tespit sonuçlarını inceleme, olay yönetimi, not ekleme |

## Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| **Frontend** | React, TypeScript, Vite, Tailwind CSS, Recharts |
| **Backend** | Python, FastAPI, Pydantic, SQLAlchemy, Alembic |
| **Veritabanı** | PostgreSQL |
| **Makine Öğrenmesi** | Pandas, NumPy, scikit-learn, Joblib |
| **Test** | Pytest, HTTPX, Vitest, React Testing Library |
| **DevOps** | Docker, Docker Compose, GitHub Actions |

## Veri Seti

Ana veri seti olarak **UNSW-NB15** kullanılmaktadır.

- Kaynak: [UNSW-NB15 Dataset](https://research.unsw.edu.au/projects/unsw-nb15-dataset)
- Eğitim ve test CSV dosyaları: `UNSW_NB15_training-set.csv`, `UNSW_NB15_testing-set.csv`
- Ham veri seti Git repository'sine eklenmemiştir. Veri setini indirme ve hazırlama adımları `data/` dizininde belgelenmiştir.

## Repository Yapısı

```
securewatch-ai/
├── backend/           # FastAPI uygulaması
│   ├── app/
│   │   ├── api/       # API route'ları
│   │   ├── core/      # Ayarlar, logging, hata yönetimi
│   │   ├── db/        # Veritabanı bağlantısı
│   │   ├── models/    # SQLAlchemy modelleri
│   │   ├── schemas/   # Pydantic şemaları
│   │   ├── services/  # İş kuralları
│   │   ├── ml/        # ML pipeline'ı
│   │   ├── security/  # JWT, parola, RBAC
│   │   └── storage/   # Dosya yönetimi
│   ├── alembic/       # Migration'lar
│   └── tests/         # Testler
├── frontend/          # React uygulaması
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── services/
│       └── types/
├── data/              # Veri seti ve örnekler
├── docs/              # Dokümantasyon
└── .github/           # Issue/PR şablonları
```

## Kurulum

### Gereksinimler

- Python 3.10+
- Node.js 18+
- PostgreSQL 15+
- Docker (opsiyonel)

### Backend Kurulumu

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# .env dosyasını düzenleyin
alembic upgrade head
uvicorn app.main:app --reload
```

### Frontend Kurulumu

```bash
cd frontend
npm install
npm run dev
```

### Docker ile Kurulum

```bash
docker-compose up --build
```

## Test

```bash
# Backend testleri
cd backend && pytest

# Frontend testleri
cd frontend && npm test
```

## GitHub Çalışma Disiplini

- **Branch Stratejisi:** Her özellik/düzeltme için ayrı branch, main'e yalnızca PR ile birleşim
- **Commit Standardı:** Conventional Commits formatı, küçük ve anlamlı commitler
- **Issue-First:** Kodlamadan önce Issue oluşturulmalı
- **Pull Request:** Her PR bir Issue'ya bağlı, incelemeci onayı gerekli

## Proje Durumu

| Aşama | Durum |
|-------|-------|
| Aşama 0 – Proje Yönetimi ve Dokümantasyon | Devam Ediyor |
| Aşama 1 – Veri Analizi ve Sistem Mimarisi | Planlandı |
| Aşama 2 – Backend, Veritabanı ve Yetkilendirme | Planlandı |
| Aşama 3 – Veri İşleme ve Makine Öğrenmesi | Planlandı |
| Aşama 4 – Analiz, Tespit ve Olay Yönetimi | Planlandı |
| Aşama 5 – Frontend ve Kullanıcı Deneyimi | Planlandı |
| Aşama 6 – Dashboard ve Raporlama | Planlandı |
| Aşama 7 – Test, Güvenlik ve Entegrasyon | Planlandı |
| Aşama 8 – Docker, Dokümantasyon ve Final Teslimi | Planlandı |

## Güvenlik ve Etik Sınırlar

- Bu proje yalnızca eğitim ve analiz amaçlıdır
- Gerçek sistemlere saldırı göndermek veya port taraması yapmak için kullanılamaz
- Test verileri gerçek ağ trafiği içermez
- Kullanıcı şifreleri hashlenerek saklanır
- JWT secret ve veritabanı bilgileri `.env` üzerinden okunur

## Lisans

Bu proje eğitim amaçlı geliştirilmektedir.