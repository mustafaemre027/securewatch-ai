# Staj Günlüğü — Gün 4

## Temel Bilgiler

- **Tarih:** 17.07.2026 Cuma
- **Faz:** Faz 2 — Backend, Veritabanı ve Yetkilendirme
- **EPIC Issue:** [#3](https://github.com/mustafaemre027/securewatch-ai/issues/3)
- **Çalışılan Sub-Issue'lar:**
  - [#15](https://github.com/mustafaemre027/securewatch-ai/issues/15) — Gün 4: Backend Temeli ve Veritabanı Bağlantısı
- **Branch:** `feature/15-backend-foundation`
- **PR:** -

---

## Hedef

1. FastAPI backend klasör yapısının, Pydantic Settings ayar yönetiminin ve application factory yapısının kurulması.
2. PostgreSQL 18 veritabanı ortamının hazırlanması ve SQLAlchemy 2.x bağlantı katmanının (`engine`, `sessionmaker`, `get_db()`) yapılandırılması.
3. Alembic göç (migration) aracının kurulması ve `env.py` dosyasının projeye entegre edilmesi.
4. Merkezi hata yönetim mekanizmasının kurularak standart JSON hata formatının sağlanması.
5. `GET /api/v1/health` sağlık kontrolü rotasının PostgreSQL durumunu test edecek şekilde yazılması.
6. Tüm bu katmanların 7 kapsamlı birim testle doğrulanması ve yerel kurulum rehberinin belgelenmesi.

---

## Yapılanlar

### 1. PostgreSQL 18 Veritabanı Ortamının Hazırlanması
- **PostgreSQL 18** veritabanı sunucusu yerel geliştirme ortamına kuruldu.
- İlk kurulum sırasında Windows sistemindeki Türkçe karakterler barındıran locale ayarı ("Türkçe") nedeniyle veritabanı kümesi (cluster) başlatma işlemi başarısız oldu.
- PostgreSQL logları incelenerek sorunun ASCII dışı karakterlerden kaynaklanan locale uyumsuzluğu olduğu tespit edildi.
- Veritabanı kümesi, UTF-8 kodlaması ve `C` locale seçeneği (`initdb --locale=C -E UTF-8`) ile komut satırından güvenli bir şekilde yeniden başlatıldı.
- PostgreSQL Windows servis olarak kaydedilip çalıştırıldı ve `5432` portunun dinlendiği doğrulandı.
- Proje kullanımı için `securewatch_user` adlı veritabanı kullanıcısı ve `securewatch_db` veritabanı oluşturularak gerekli şema yetkilendirmeleri yapıldı. Güvenlik gereği hiçbir parola veya hassas veri günlüğe/kodlara yazılmadı.

### 2. FastAPI Backend Temeli
- Backend klasör dizini oluşturuldu: `backend/app/`, `backend/tests/` ve alt dizinleri kuruldu.
- `backend/app/main.py` içinde modüler ve test edilebilir bir `create_application() -> FastAPI` application factory yapısı geliştirildi.
- `backend/app/core/config.py` içinde Pydantic `BaseSettings` ve `SettingsConfigDict` kullanılarak UTF-8 kodlamalı `.env` dosyası okuma mekanizması kuruldu. `get_settings()` fonksiyonu `@lru_cache` ile önbelleğe alındı.
- `database_url` değişkeni zorunlu bir ortam değişkeni olarak belirlendi.
- Gizli ayarları barındıran `.env` dosyasının repoya sızmasını engellemek için root `.gitignore` dosyası güncellendi.
- Python 3.14 üzerinde izole sanal ortam (`.venv`) kuruldu ve `requirements.txt` içindeki kilitli paketler buraya kuruldu.

### 3. Veritabanı Bağlantı Katmanı ve Alembic
- [`app/db/base.py`](file:///c:/Projects/securewatch-ai/backend/app/db/base.py) içinde SQLAlchemy 2.x `DeclarativeBase` kullanılarak tüm modellerin miras alacağı `Base` sınıfı tanımlandı.
- [`app/db/session.py`](file:///c:/Projects/securewatch-ai/backend/app/db/session.py) içinde veritabanı motoru (`pool_pre_ping=True` ile) ve `SessionLocal` tanımlandı. Dependency injection ile kullanılacak `get_db()` generator yapısı `finally` bloğu ile oturumu kapatacak şekilde kuruldu.
- `check_database_connection()` fonksiyonu yazıldı. `with engine.connect()` context manager'ı ile veritabanına `SELECT 1` sorgusu gönderilerek bağlantı doğruluğu test edildi ve kaynakların doğru kapatılması sağlandı.
- Alembic aracı başlatıldı (`alembic.ini` ve `alembic/` dizini). Programatik bağlantıyı sağlamak için [`alembic/env.py`](file:///c:/Projects/securewatch-ai/backend/alembic/env.py) dosyası düzenlendi ve settings içerisindeki `database_url` dinamik olarak okundu. Parola içerisindeki `%` karakterlerinin kaçırılması (`%%`) sağlanarak ConfigParser hataları önlendi. `Base.metadata` nesnesi `target_metadata` olarak atandı.
- Faz 2 planına sadık kalınarak henüz hiçbir tablo modeli veya alembic revision dosyası oluşturulmadı.

### 4. Merkezi API Hata Yönetimi
- [`app/core/exceptions.py`](file:///c:/Projects/securewatch-ai/backend/app/core/exceptions.py) içinde `AppException` sınıfı tanımlandı. HTTP durum kodu, kararlı hata kodu dizesi, okunabilir mesaj ve opsiyonel detayları barındıran yapı kuruldu.
- [`app/core/exception_handlers.py`](file:///c:/Projects/securewatch-ai/backend/app/core/exception_handlers.py) içinde `AppException`, `HTTPException`, `RequestValidationError` (422) ve unhandled `Exception` (500) durumlarını yakalayacak işleyiciler yazıldı.
- Tüm hata yanıtlarının tutarlı bir JSON yapısı döndürmesi sağlandı (`error` -> `code`, `message`, `details`). 500 hatalarında sistemin dahili izleri veya gizli şifreler istemciye sızdırılmadan genel bir hata mesajı dönüldü ve hata izi `logger.exception` ile güvenle loglandı.

### 5. Health (Sağlık) Endpoint'i
- [`app/api/v1/endpoints/health.py`](file:///c:/Projects/securewatch-ai/backend/app/api/v1/endpoints/health.py) içinde `GET /api/v1/health` rotası geliştirildi.
- Veritabanı bağlantısı sağlıklı olduğunda HTTP 200 durum kodu ile sürüm ve servis bilgilerini dönen yapı kuruldu.
- Veritabanı bağlantısı kesildiğinde ise `AppException` fırlatılarak HTTP 503 durum kodu ve `DATABASE_UNAVAILABLE` hata kodu döndürülmesi sağlandı.
- API v1 router'ı (`api_router`) kurularak health rotası uygulamaya `settings.api_v1_prefix` önekiyle bağlandı.

### 6. Testler ve Doğrulamalar
- Pytest altyapısı (`pytest.ini`, `conftest.py`) kuruldu. Testlerin izole çalışması için `conftest.py` içinde import işleminden önce sahte bir `DATABASE_URL` fallback değeri tanımlandı.
- Toplam **7 adet kapsamlı birim test** yazıldı.
- Pytest çalışması sırasındaki `StarletteDeprecationWarning` ("Using httpx with starlette.testclient is deprecated; install httpx2 instead") uyarısı incelendi ve third-party paket amortismanı olduğu görüldü.
- Sorunu düzeltmek adına `requirements.txt` içerisindeki `httpx` paketi güncel `httpx2==2.7.0` ile değiştirilerek sanal ortama kuruldu.
- Sonuç olarak `python -m pytest -q -W error` (tüm uyarıları hata seviyesine yükselterek) komutu çalıştırıldı ve **7 testin tamamının sıfır hata ve sıfır uyarıyla geçtiği** doğrulandı.
- Kısa süreliğine canlı Uvicorn sunucusu `http://127.0.0.1:8000` üzerinde test edilip `database: connected` durumu gerçek veritabanı üzerinden doğrulandı.
- `pip check` ve `compileall` denetimleri sıfır hata ile tamamlandı.

---

## Karşılaşılan Zorluklar

| Sorun | Çözüm |
| :--- | :--- |
| PostgreSQL yerel kurulumda Türkçe locale seçimi ("Türkçe") nedeniyle küme başlangıcında hata verip servisi başlatamadı. | Log dosyasındaki UTF-8 / locale hatası analiz edilerek, `initdb` komutu yardımıyla veritabanı kümesi elle `C` locale ve `UTF-8` kodlaması ile sıfırdan oluşturulmuş ve PostgreSQL servis olarak başarıyla çalıştırılmıştır. |
| Test client uyarısı (`StarletteDeprecationWarning`) test çıktısını kirletmekteydi. | Uyarının pytest.ini ile gizlenmesi yerine, kilitli bağımlılık listesindeki amortismana uğramış `httpx` paketi kaldırılarak yerine güncel `httpx2` paketi eklenmiş ve uyarının kökten çözülmesi sağlanmıştır. |

---

## Değişiklik Özeti

| Dosya | Değişiklik |
| :--- | :--- |
| `docs/internship-diary/day-04.md` | Gün 4 staj günlüğü oluşturuldu. |

---

## Öğrenilenler

- **Ortam Değişkeni Yönetimi**: Uygulama şifreleri ve hassas verilerin `.env` dosyalarında tutularak repoya push edilmesinin önlenmesi prensipleri.
- **SQLAlchemy Oturum Yönetimi**: Bağlantı havuzundaki kilitlenmeleri önlemek için `pool_pre_ping` kullanımı ve generator dependency'de close işlemlerinin `finally` bloğu ile garantiye alınması.
- **Göç Yönetimi**: Modeller yazılmadan önce Alembic altyapısının programatik ayarlarla kurulmasının sağladığı kolaylıklar.
- **Sistem Gözlemlenebilirliği (Observability)**: Health endpointlerinin ve merkezi hata işleyicilerinin backend sağlığını takip etmedeki kritik önemi.
- **Amortisman Yönetimi**: Üçüncü taraf uyarılarının dosya bazlı gizlenmesi yerine, güncel uyumlu bağımlılıklarla (`httpx2`) değiştirilerek temiz test çıktısı elde edilmesi.

---

## Referanslar

- **Branch:** `feature/15-backend-foundation`
- **EPIC Issue:** [#3](https://github.com/mustafaemre027/securewatch-ai/issues/3)
- **Sub-Issue:** [#15](https://github.com/mustafaemre027/securewatch-ai/issues/15)

### Git Commit Mesajları

```
[20:11] (16f285e) chore(backend): scaffold FastAPI application
[20:21] (96dddc0) feat(database): configure PostgreSQL connection
[20:25] (de51fc1) chore(database): configure Alembic migrations
[20:30] (599b9b3) feat(api): add centralized error handling
[20:34] (63fcbc1) feat(api): add database health endpoint
[20:38] (c648813) test(backend): add startup and health checks
[20:47] (83ede03) fix(test): replace deprecated HTTPX dependency
[20:50] (049e5b2) docs(backend): document local setup
```
