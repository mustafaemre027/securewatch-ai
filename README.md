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

### Genel Gereksinimler

- Python 3.10+ (Yerel geliştirme Python 3.14 ile doğrulanmıştır)
- Node.js 18+
- PostgreSQL 15+ (Yerel geliştirme PostgreSQL 18 ile doğrulanmıştır)
- Docker (opsiyonel)

### Backend Yerel Kurulumu (Doğrulandı)

Geliştirme ortamında test edilmiş ve doğrulanmış backend kurulum adımları:

> **Not:** Bu aşamada Docker zorunlu değildir; yerel PostgreSQL sunucusu üzerinden geliştirme yapılmaktadır.

#### 1. Dizin Geçişi ve Sanal Ortam (Virtual Environment)
PowerShell üzerinde `backend` dizinine geçerek sanal ortamı oluşturun ve aktifleştirin:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
```

*Linux/macOS için aktifleştirme komutu:* `source .venv/bin/activate`

#### 2. Bağımlılıkların Kurulması
Sanal ortam aktifken gerekli Python paketlerini yükleyin:

```powershell
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

#### 3. Yapılandırma (.env) Dosyası
Örnek yapılandırma dosyasını kopyalayarak yerel `.env` dosyasını oluşturun:

```powershell
copy .env.example .env
```

*Linux/macOS için kopyalama komutu:* `cp .env.example .env`

> **Önemli:** Oluşturulan `.env` dosyası gizli verileri içerdiği için hiçbir şekilde Git takibine eklenmemelidir (otomatik olarak `.gitignore` kapsamındadır). Dosyayı açarak `DATABASE_URL` içindeki `change_me` şablon parolasını kendi PostgreSQL parolanızla değiştirin.
>
> Örnek bağlantı adresi şablonu:
> `DATABASE_URL=postgresql+psycopg://securewatch_user:change_me@localhost:5432/securewatch_db`

#### 4. Göç Kontrolü ve Uygulamanın Çalıştırılması
Veritabanı bağlantısının ve alembic göç altyapısının aktifliğini doğruladıktan sonra sunucuyu başlatın:

```powershell
# Alembic güncel sürüm durumunu kontrol et
python -m alembic current

# Uvicorn sunucusunu başlat
python -m uvicorn app.main:app --reload
```

- **Sağlık (Health) Endpoint:** `http://127.0.0.1:8000/api/v1/health`
- **Otomatik API Dokümantasyonu (Swagger UI):** `http://127.0.0.1:8000/docs`

#### 5. Testlerin Çalıştırılması
Backend test suitini çalıştırmak için şu komutu kullanabilirsiniz:

```powershell
python -m pytest -q
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

- Projenin lisansı henüz belirlenmemiştir.
- Bu proje yalnızca eğitim ve analiz amaçlıdır
- Gerçek sistemlere saldırı göndermek veya port taraması yapmak için kullanılamaz
- Gerçek şirketlere ait hassas trafik kullanılmaz; kamuya açık akademik CIC-IDS2017 veri seti kullanılır
- Kullanıcı şifreleri hashlenerek saklanır
- JWT secret ve veritabanı bilgileri `.env` üzerinden okunur

---

Detaylı uygulama planı ve proje yönetimi bilgileri için bkz. [implementation_plan.md](implementation_plan.md).