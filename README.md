# SecureWatch AI

Yapay zekâ destekli ağ trafiği analizi ve saldırı tespit karar destek platformu.

## Projenin Amacı

SecureWatch AI, ağ trafiği kayıtlarını makine öğrenmesi yöntemleriyle analiz ederek normal ve şüpheli bağlantıları sınıflandıran, model sonuçlarını açıklanabilir risk skorlarıyla sunan ve yüksek riskli kayıtları yönetilebilir güvenlik olaylarına dönüştüren web tabanlı bir karar destek platformudur.

> **Önemli:** Bu proje üretim ortamında kullanılabilecek gerçek zamanlı bir IDS/IPS değildir. Akademik ve kurumsal karar destek prototipi olarak geliştirilmektedir.

## Temel Özellikler

- **Kullanıcı Yönetimi:** JWT tabanlı kimlik doğrulama, yönetici ve güvenlik analisti rolleri
- **Veri Yükleme:** CSV formatında ağ trafiği verisi yükleme, doğrulama ve analiz
- **Makine Öğrenmesi:** İkili sınıflandırma (normal/şüpheli), model karşılaştırma
- **Risk Skorlaması:** LOW, MEDIUM, HIGH, CRITICAL seviyelerinde risk değerlendirmesi
- **Olay Yönetimi:** Şüpheli tespitlerin güvenlik olaylarına dönüştürülmesi ve yönetimi
- **Dashboard:** Tamamlanan analizlerden üretilen güncel özet istatistikler, grafikler ve model performans metrikleri

## Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| **Frontend** | React, TypeScript, Vite, Tailwind CSS, Recharts |
| **Backend** | Python, FastAPI, Pydantic, SQLAlchemy, Alembic |
| **Veritabanı** | PostgreSQL |
| **Makine Öğrenmesi** | Pandas, NumPy, scikit-learn, Joblib |
| **Test** | Pytest, HTTPX, Vitest, React Testing Library |
| **DevOps** | Docker, Docker Compose, GitHub Actions (planlandı) |

## Kurulum

> **Not:** Backend ve frontend henüz geliştirme aşamasındadır. Aşağıdaki kurulum adımları planlanmış olup henüz doğrulanmamıştır.

### Gereksinimler

- Python 3.10+
- Node.js 18+
- PostgreSQL 15+
- Docker (opsiyonel)

### Backend Kurulumu (planlandı / henüz doğrulanmadı)

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

### Frontend Kurulumu (planlandı / henüz doğrulanmadı)

```bash
cd frontend
npm install
npm run dev
```

### Docker ile Kurulum (planlandı / henüz doğrulanmadı)

```bash
docker-compose up --build
```

## GitHub Çalışma Disiplini

- **Branch Stratejisi:** Her özellik/düzeltme için ayrı branch, main'e yalnızca PR ile birleşim
- **Commit Standardı:** Conventional Commits formatı, küçük ve anlamlı commitler
- **Issue-First:** Kodlamadan önce Issue oluşturulmalı
- **Pull Request:** Her PR bir Issue'ya bağlı, incelemeci onayı gerekli

## Lisans ve Güvenlik Notu

- Bu proje yalnızca eğitim ve analiz amaçlıdır
- Gerçek sistemlere saldırı göndermek veya port taraması yapmak için kullanılamaz
- Gerçek şirketlere ait hassas trafik kullanılmaz; kamuya açık akademik UNSW-NB15 veri seti kullanılır
- Kullanıcı şifreleri hashlenerek saklanır
- JWT secret ve veritabanı bilgileri `.env` üzerinden okunur

---

Detaylı uygulama planı ve proje yönetimi bilgileri için bkz. [implementation_plan.md](implementation_plan.md).