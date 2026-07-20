# Staj Günlüğü — Gün 5

## Temel Bilgiler

- **Tarih:** 20.07.2026 Pazartesi
- **Faz:** Faz 2 — Backend, Veritabanı ve Yetkilendirme
- **EPIC Issue:** [#3](https://github.com/mustafaemre027/securewatch-ai/issues/3)
- **Çalışılan Sub-Issue'lar:**
  - [#17](https://github.com/mustafaemre027/securewatch-ai/issues/17) — Gün 5: Authentication, RBAC ve Audit Log Altyapısı
- **Branch:** `feature/17-auth-rbac-audit-log`
- **PR:** -

---

## Hedef

1. Gün 4 backend temelinin üzerine `User` ve `AuditLog` veritabanı modellerinin tanımlanması.
2. Alembic autogenerate ile ilk veritabanı migration dosyasının oluşturulması ve PostgreSQL sunucusuna uygulanması.
3. `bcrypt` ile güvenli parola hashleme ve `PyJWT` ile JWT (JSON Web Token) oturum token'ı yönetimi altyapısının kurulması.
4. Pydantic şemalarının (`UserLogin`, `Token`, `UserCreate`, `UserResponse`, `AuditLogResponse`) hazırlanması.
5. İş mantığı servis katmanının (`user_service`, `audit_service`, `auth_service`) ve `deps.py` üzerindeki RBAC bağımlılıklarının (`get_current_user`, `require_roles`) geliştirilmesi.
6. REST API uç noktalarının (`POST /api/v1/auth/login`, `POST /api/v1/users`, `GET /api/v1/users`, `GET /api/v1/audit-logs`) yazılması ve API v1 router'ına bağlanması.
7. Kapsamlı güvenlik, entegrasyon ve birim testlerinin yazılıp 61 testin tamamının sıfır hatayla geçtiğinin doğrulanması.

---

## Yapılanlar

### 1. Model ve Veritabanı Altyapısı
- Gün 4'te kurulan FastAPI ve PostgreSQL temelinin üzerine kimlik doğrulama ve yetkilendirme modelleri inşa edildi.
- `app/models/user.py` içinde SQLAlchemy 2.x ORM yapısıyla `User` modeli ve `ADMIN` / `ANALYST` rollerini içeren `UserRole` enum sınıfı oluşturuldu. `username` ve `email` alanlarına benzersizlik (`unique=True`) kısıtı eklendi.
- `app/models/audit_log.py` içinde `AuditLog` modeli tanımlandı. Bir kullanıcı silindiğinde geçmiş audit loglarının silinmemesi için `ForeignKey("users.id", ondelete="SET NULL")` ve `passive_deletes=True` konfigürasyonu uygulandı; böylece kullanıcı silinse bile `user_id` alanı `NULL` değerine çekilerek denetim izi korundu.
- Alembic autogenerate kullanılarak `ad7f684386c2_create_users_and_audit_logs_tables.py` migration dosyası üretildi. Tablolar, indeksler ve kısıtlar incelendikten sonra `python -m alembic upgrade head` komutuyla PostgreSQL veritabanına uygulandı.

### 2. Parola Güvenliği ve JWT Altyapısı
- `bcrypt` kütüphanesi kullanılarak `hash_password()` ve `verify_password()` yardımcı fonksiyonları yazıldı. Parolaların açık metin olarak veritabanına veya loglara yazılması engellendi.
- `PyJWT` kütüphanesi ile `HS256` algoritmalı `create_access_token()` ve `decode_access_token()` fonksiyonları geliştirildi. Token süresi dolmuşsa `TOKEN_EXPIRED` (401), token imzası bozuksa `TOKEN_INVALID` (401) durum kodları ve kararlı hata yanıtları dönüldü.

### 3. Servis Katmanı ve RBAC Bağımlılıkları
- İş mantığını API katmanından ayırmak için `app/services/` altında modüler servisler oluşturuldu:
  - `user_service.py`: Kullanıcı oluşturma (`create_user`), listeleme ve benzersizlik denetimleri.
  - `audit_service.py`: `USER_LOGIN` ve `USER_CREATED` eylemleri için audit log kaydı ve filtrelenmiş listeleme.
  - `auth_service.py`: Kullanıcı kimlik doğrulama (`authenticate_user`) ve oturum açma işlemi.
- `app/api/deps.py` içinde `get_current_user` ve `require_roles` bağımlılıkları tanımlandı. Güvenlik gereği token içindeki rol bilgisine körü körüne güvenilmek yerine, her istekte veritabanından güncel `User` modeli çekilerek canlı rol kontrolü yapıldı. Yetkisiz erişimlerde 403 `PERMISSION_DENIED` hatası üretildi.

### 4. REST API Endpoints
- `POST /api/v1/auth/login`: Kamusal (PUBLIC) giriş noktası. Doğru kimlik bilgilerinde JWT erişim token'ı döndürür ve `USER_LOGIN` audit kaydı oluşturur.
- `POST /api/v1/users`: Yalnızca `ADMIN` rolüne açık kullanıcı oluşturma uç noktası. Başarılı işlemde HTTP 201 Created döner ve `USER_CREATED` audit kaydı oluşturur. Yanıt şemasında (`UserResponse`) `password` veya `password_hash` asla yer almaz.
- `GET /api/v1/users`: Yalnızca `ADMIN` rolüne açık kullanıcı listeleme uç noktası.
- `GET /api/v1/audit-logs`: Yalnızca `ADMIN` rolüne açık denetim günlükleri listeleme uç noktası (`user_id`, `action_type`, tarih filtresi destekler).

### 5. Test ve Güvenlik Doğrulamaları
- Multi-threaded FastAPI TestClient ile SQLite in-memory testlerinin çakışmaması için test engine'lerine `StaticPool` ve `check_same_thread=False` eklendi.
- Birim, entegrasyon ve RBAC yetki kısıtlama senaryolarını kapsayan toplam **61 adet test** yazıldı.
- `python -m pytest -q -W error` komutu çalıştırılarak tüm testlerin sıfır hata ve sıfır uyarıyla geçtiği doğrulandı.
- `compileall`, `alembic current` ve `pip check` denetimleri tamamlandı.

---

## Karşılaşılan Zorluklar

| Sorun | Çözüm |
| :--- | :--- |
| `config.py` içinde `jwt_secret_key` için güvensiz varsayılan değer (`dev_secret_key...`) bulunmaktaydı. | Varsayılan değer tamamen kaldırıldı; `JWT_SECRET_KEY` zorunlu ortam değişkeni haline getirildi ve Pydantic `field_validator` ile en az 32 karakter uzunluk ve bilinen güvensiz desenlerin (`change_me`, `placeholder` vb.) reddedilmesi sağlandı. |
| Kullanıcı oluşturma ve `USER_CREATED` audit kaydının farklı `commit()` çağrılarıyla bağımsız transaction'larda çalışması nedeniyle atomik olmaması. | `user_service.py` ve `audit_service.py` alt fonksiyonlarındaki erken `commit()` çağrıları `flush()` ile değiştirildi. `create_user_with_audit` orkestrasyon fonksiyonu yazılarak iki işlem tek bir transaction içinde birleştirildi; çakışma durumunda tam `rollback` yapılması garanti edildi. |
| Başarısız login denemelerinde `logger.warning` mesajının açık metin `username` içermesi. | Log güvenlik incelemesi sonrasında kullanıcı adı log mesajından çıkarılarak olası bilgi ifşasının önüne geçildi. |
| Endpoint decorators içindeki `"/"` tanımlarının API sözleşmesindeki trailing slash'siz path'ler ile çakışması ve 307 yönlendirmelerine yol açabilmesi. | Dekoratör tanımları `""` olarak düzenlenerek `/api/v1/users` ve `/api/v1/audit-logs` rotalarının OpenAPI sözleşmesiyle birebir örtüşmesi sağlandı. |
| Mimari belgedeki (`06-api-endpoints.md`) eski düz (flat) hata örneği ile projedeki nested hata şeması uyumsuzluğu. | Dokümantasyondaki hata yanıt şeması, uygulamada kullanılan merkezi `{"error": {"code": "...", "message": "...", "details": ...}}` nested yapısına güncellendi. |
| Endpoint dosyalarında tekrarlanan `get_client_ip` yardımcı fonksiyonu. | Fonksiyon ortak [app/api/utils.py](file:///c:/Projects/securewatch-ai/backend/app/api/utils.py) modülüne taşınarak tek bir noktadan import edilecek şekilde refactor edildi. |

---

## Değişiklik Özeti

| Dosya | Değişiklik |
| :--- | :--- |
| `backend/app/models/user.py` | `User` ORM modeli ve `UserRole` enum sınıfı eklendi. |
| `backend/app/models/audit_log.py` | `AuditLog` ORM modeli ve `SET NULL` ilişkisi tanımlandı. |
| `backend/alembic/versions/ad7f684386c2...` | Kullanıcı ve audit log tablolarını oluşturan Alembic göç dosyası. |
| `backend/app/schemas/` | `auth.py`, `user.py` ve `audit_log.py` Pydantic v2 şemaları eklendi. |
| `backend/app/services/` | `user_service.py`, `audit_service.py` ve `auth_service.py` iş mantığı katmanı eklendi. |
| `backend/app/api/deps.py` | JWT doğrulama ve RBAC `require_roles` bağımlılıkları yazıldı. |
| `backend/app/api/utils.py` | Ortak istemci IP çıkarma yardımcısı eklendi. |
| `backend/app/api/v1/endpoints/` | `auth.py`, `users.py` ve `audit_logs.py` REST endpoint'leri yazıldı. |
| `backend/app/core/config.py` | `jwt_secret_key` zorunlu kılındı ve Pydantic güvenlik doğrulaması eklendi. |
| `backend/tests/` | 61 test içeren entegrasyon, güvenlik ve birim test süiti eklendi. |
| `docs/architecture/06-api-endpoints.md` | Nested hata formatı dökümantasyonu güncellendi. |
| `README.md` | Auth, RBAC, audit loglar ve `.env` kurulum rehberi güncellendi. |

---

## Öğrenilenler

- **JWT ve Canlı Rol Doğrulaması:** Token içindeki statik role güvenmek yerine her istekte DB'den güncel `User` kaydının sorgulanmasının yetki değişikliklerini anında yansıtmadaki önemi.
- **Transaction Atomikliği:** Veritabanında birbirine bağlı işlemler yaparken (örn. Kullanıcı + Audit Log) alt fonksiyonlarda erken `commit()` yerine `flush()` kullanıp işlemi servis seviyesinde tek bir `commit()` / `rollback` bloğu ile yönetme prensibi.
- **Güvenli Loglama:** Başarısız login isteklerinde kullanıcı adı, parola veya secret gibi verilerin loglara yazılmaması gerektiği.
- **Veri Koruma İlkeleri:** Kullanıcı silinse dahi `ON DELETE SET NULL` ile denetim izlerinin sistemde anonimleştirilerek tutulması.

---

## Sonraki Adımlar

- [ ] Faz 3 çalışmaları kapsamında ağ trafiği CSV veri seti yükleme ve analiz işleri (`AnalysisJob`) altyapısına geçilmesi.

---

## Referanslar

- **Branch:** `feature/17-auth-rbac-audit-log`
- **EPIC Issue:** [#3](https://github.com/mustafaemre027/securewatch-ai/issues/3)
- **Sub-Issue:** [#17](https://github.com/mustafaemre027/securewatch-ai/issues/17)

### Git Commit Mesajları

```text
[11:26] (5b7b9ff) chore(deps): add authentication dependencies
[11:30] (65f3df3) feat(auth): add password hashing and JWT helpers
[11:37] (07ee831) feat(models): define user and audit log models
[14:40] (a3565da) chore(database): add users and audit logs migration
[15:07] (100e7d4) chore(deps): add email validation dependency
[15:10] (25f72e5) feat(schemas): add authentication user and audit schemas
[16:17] (e63f7ca) feat(services): add user and audit log services
[16:18] (bacc116) feat(auth): add authentication and RBAC services
[17:08] (27c1ae1) feat(api): add login user and audit log endpoints
[17:30] (fab0b77) test(auth): cover authentication RBAC and audit logging
[17:51] (8b70847) fix(config): require secure JWT secret configuration
[17:52] (3945c2c) fix(auth): make user creation and audit logging atomic
[18:06] (f5d6a2a) refactor(api): centralize client IP extraction
[18:06] (33eb74c) fix(api): align endpoint paths with API contract
[18:07] (a718106) docs(api): align error response documentation
[18:07] (54be54d) style: clean whitespace in modified files
[18:17] (ec6aa8e) docs(auth): document authentication and RBAC setup
```
