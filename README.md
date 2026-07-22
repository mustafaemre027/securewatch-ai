# SecureWatch AI

Yapay zekâ destekli ağ trafiği analizi ve saldırı tespit karar destek platformu.

## Projenin Amacı

SecureWatch AI, ağ trafiği kayıtlarını makine öğrenmesi yöntemleriyle analiz ederek normal ve şüpheli bağlantıları sınıflandıran, model sonuçlarını açıklanabilir risk skorlarıyla sunan ve yüksek riskli kayıtları yönetilebilir güvenlik olaylarına dönüştüren web tabanlı bir karar destek platformudur.

> **Önemli:** Bu proje üretim ortamında kullanılabilecek gerçek zamanlı bir IDS/IPS değildir. Akademik ve kurumsal karar destek prototipi olarak geliştirilmektedir.

## Temel Özellikler

- **Kimlik Doğrulama & Güvenlik:** JWT (JSON Web Token) tabanlı oturum yönetimi, `bcrypt` ile güvenli parola hashleme ve saklama.
- **Rol Tabanlı Erişim Kontrolü (RBAC):** `ADMIN` (Sistem Yöneticisi) ve `ANALYST` (Güvenlik Analisti) rolleri ile uç nokta yetkilendirmesi.
- **Denetim Günlükleri (Audit Logging):** Kritik kullanıcı eylemlerinin (`USER_LOGIN`, `USER_CREATED` vb.) istemci IP adresi ve zaman damgası ile otomatik kaydı; ilişkili kullanıcı silinse dahi logların korunması (`ON DELETE SET NULL`).
- **Veri Yükleme:** Güvenlik analistleri tarafından CIC-IDS2017 formatında (78 zorunlu özellik, 1 opsiyonel Label) ağ trafiği verilerinin güvenli şekilde yüklenmesi. Yükleme esnasında dosya boyutu (varsayılan 50 MB, yapılandırılabilir), uzantı/MIME, şema doğrulaması ve SHA-256 çift kopya (duplicate) kontrolü yapılır. Başarılı yüklemelerde `PENDING` durumunda bir analiz işi (AnalysisJob) ve `FILE_UPLOAD` audit kaydı oluşturulur.
- **Makine Öğrenmesi:** İkili sınıflandırma (normal/şüpheli), model karşılaştırma (planlandı).
- **Risk Skorlaması:** LOW, MEDIUM, HIGH, CRITICAL seviyelerinde risk değerlendirmesi (planlandı).
- **Olay Yönetimi:** Şüpheli tespitlerin güvenlik olaylarına dönüştürülmesi ve yönetimi (planlandı).
- **Dashboard:** Tamamlanan analizlerden üretilen güncel özet istatistikler ve grafikler (planlandı).

## Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| **Frontend** | React, TypeScript, Vite, Tailwind CSS, Recharts |
| **Backend** | Python, FastAPI, Pydantic, SQLAlchemy, Alembic, PyJWT, bcrypt |
| **Veritabanı** | PostgreSQL |
| **Makine Öğrenmesi** | Pandas, NumPy, scikit-learn, Joblib |
| **Test** | Pytest, HTTPX, Vitest, React Testing Library |
| **DevOps** | Docker, Docker Compose, GitHub Actions (planlandı) |

---

## Güvenlik, RBAC ve API Uç Noktaları

Platform, güvenli erişim ve denetlenebilirlik için aşağıdaki güvenlik katmanlarına sahiptir:

### Rol Tabanlı Erişim (RBAC) Yetki Matrisi

| Endpoint | HTTP Metodu | Erişim Rolü | Açıklama |
|----------|-------------|-------------|----------|
| `/api/v1/auth/login` | `POST` | `PUBLIC` | Kullanıcı adı ve parola ile giriş yapar, JWT token döner. |
| `/api/v1/users` | `POST` | `ADMIN` | Yeni kullanıcı hesabı oluşturur ve `USER_CREATED` audit kaydı düşer. |
| `/api/v1/users` | `GET` | `ADMIN` | Sistemde kayıtlı tüm kullanıcıları listeler. |
| `/api/v1/audit-logs` | `GET` | `ADMIN` | Sistem denetim günlüklerini listeler (kullanıcı, eylem ve tarih filtresi destekler). |
| `/api/v1/analysis/upload` | `POST` | `ANALYST` | CIC-IDS2017 CSV dosyası yükler, doğrular ve `PENDING` analiz işi oluşturur. |
| `/api/v1/analysis` | `GET` | `ADMIN`, `ANALYST` | Analiz işlerini listeler (Admin tümünü, Analist sadece kendi işlerini görür). |
| `/api/v1/analysis/{job_id}` | `GET` | `ADMIN`, `ANALYST` | Belirli bir analiz işinin detaylarını getirir. |

### Audit Log Güvenlik İlkeleri

- **İlişki Güvenliği:** Bir kullanıcı veritabanından silindiğinde geçmiş audit logları silinmez; `user_id` alanı otomatik olarak `NULL` değerine çekilir (`ON DELETE SET NULL`).
- **Gizlilik:** Parola, password hash, JWT token veya veritabanı bağlantı şifresi gibi hassas veriler asla audit loglarına kaydedilmez.
- **Atomik İşlem:** Kullanıcı oluşturma işlemi ve `USER_CREATED` audit log kaydı tek bir veritabanı işleminde (transaction) atomik olarak tamamlanır; bir işlem başarısız olursa tüm değişiklikler geri alınır (`rollback`).

Ayrıntılı API uç nokta sözleşmeleri ve hata kodları için bkz. [docs/architecture/06-api-endpoints.md](docs/architecture/06-api-endpoints.md).

---

## Kurulum ve Çalıştırma

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

> **Önemli:** Oluşturulan `.env` dosyası gizli verileri içerdiği için hiçbir şekilde Git takibine eklenmemelidir (otomatik olarak `.gitignore` kapsamındadır).

**.env Değişkenleri ve Yapılandırma:**

```env
# Veritabanı Bağlantısı
DATABASE_URL=postgresql+psycopg://securewatch_user:change_me@localhost:5432/securewatch_db

# JWT Güvenlik Ayarları
# ÖNEMLİ: JWT_SECRET_KEY en az 32 karakterlik, rastgele ve güçlü bir anahtar olmalıdır.
# Üretmek için: python -c "import secrets; print(secrets.token_urlsafe(64))"
JWT_SECRET_KEY=change_me_to_a_secure_random_string_at_least_32_chars
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

#### 4. Veritabanı Göçü (Migration) ve Uygulamanın Çalıştırılması
Veritabanı tablolarını en güncel migration seviyesine getirin ve uvicorn sunucusunu başlatın:

```powershell
# Alembic migration'larını uygula (users ve audit_logs tablolarını oluşturur)
python -m alembic upgrade head

# Uvicorn sunucusunu başlat
python -m uvicorn app.main:app --reload
```

- **Sağlık (Health) Endpoint:** `http://127.0.0.1:8000/api/v1/health`
- **Otomatik API Dokümantasyonu (Swagger UI):** `http://127.0.0.1:8000/docs`
- **Alternatif Dokümantasyon (ReDoc):** `http://127.0.0.1:8000/redoc`

#### 5. Testlerin Çalıştırılması
Backend test suitini (birim, entegrasyon ve güvenlik testleri) çalıştırmak için:

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
- Bu proje yalnızca eğitim ve analiz amaçlıdır.
- Gerçek sistemlere saldırı göndermek veya port taraması yapmak için kullanılamaz.
- Gerçek şirketlere ait hassas trafik kullanılmaz; kamuya açık akademik CIC-IDS2017 veri seti kullanılır.
- Kullanıcı parolaları `bcrypt` ile hashlenerek saklanır; şifreler asla açık metin (plain text) olarak kaydedilmez.
- JWT secret ve veritabanı kimlik bilgileri yalnızca yerel `.env` dosyası üzerinden okunur.

---

Detaylı uygulama planı ve proje yönetimi bilgileri için bkz. [implementation_plan.md](implementation_plan.md).