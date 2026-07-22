# Staj Günlüğü — Gün 6

## Temel Bilgiler

- **Tarih:** 21.07.2026 Salı
- **Faz:** Faz 3 — Veri İşleme ve Makine Öğrenmesi
- **EPIC Issue:** [#4](https://github.com/mustafaemre027/securewatch-ai/issues/4)
- **Çalışılan Sub-Issue'lar:**
  - [#18](https://github.com/mustafaemre027/securewatch-ai/issues/18) — Gün 6: CSV Yükleme ve Doğrulama
- **Branch:** `feature/18-csv-upload-validation`
- **PR:** -

---

## Hedef

1. Güvenli, yapılandırılabilir ve akış tabanlı CSV yükleme altyapısının kurulması.
2. `AnalysisJob` ORM modelinin ve Alembic veritabanı göçünün tamamlanması.
3. CIC-IDS2017 şemasına uygun 78 zorunlu özellik ve opsiyonel Label sütun doğrulama servisinin geliştirilmesi.
4. RBAC yetki korumalı dosya yükleme ve analiz durum takip API uç noktalarının (`POST /upload`, `GET /analysis`, `GET /analysis/{job_id}`) entegrasyonu.
5. Veritabanı transaction rollback ve fiziksel dosya temizleme (cleanup) mekanizmasının atomik yapılması.
6. Birim, entegrasyon ve hata senaryolarını kapsayan otomatik test süitinin yazılması.

---

## Yapılanlar

### 1. Yapılandırma ve Veritabanı Modeli
- `app/core/config.py` içerisine varsayılan 50 MB (`52_428_800` bytes) dosya boyutu sınırı ve `UPLOAD_DIR` eklendi.
- `AnalysisJobStatus` enum yapısı ve `AnalysisJob` ORM modeli `models/analysis_job.py` içerisinde tanımlandı; `user_id` üzerinden `User` modeline bağlandı.
- Alembic `a928a0a5102b` migration dosyası oluşturularak veritabanına uygulandı.

### 2. Storage ve Şema Doğrulama Servisleri
- `storage_service.py`: Yüklenen veriler akış halinde (chunk-stream) yazılarak SHA-256 hash'i ve boyutu hesaplandı. Path traversal koruması ve SHA-256 kontrolü ile mükerrer dosya (`DUPLICATE_FILE`) yüklenmesi engellendi.
- `csv_validation_service.py`: MIME türü (`text/csv`), `.csv` uzantısı, UTF-8/BOM ve CIC-IDS2017 78 zorunlu özellik ile opsiyonel `Label` sütunları doğrulandı. Whitespace boşlukları temizlendi.

### 3. API Uç Noktaları ve Denetim Kaydı
- `POST /api/v1/analysis/upload`: Yalnızca `ANALYST` rolüne açık uç nokta. Başarılı doğrulamada `PENDING` durumunda `AnalysisJob` ve `FILE_UPLOAD` türünde `AuditLog` atomik transaction ile kaydedilir.
- `GET /api/v1/analysis`: Analiz işlerini listeler (`ADMIN` tümünü, `ANALYST` kendi işlerini görür).
- `GET /api/v1/analysis/{job_id}`: İş detayını getirir. Yetkisiz erişimlerde `404 NOT_FOUND` döner.
- İşlem hatalarında fiziksel dosya silinerek atomik cleanup sağlandı. Sentetik `data/samples/sample_cicids2017.csv` test örneği eklendi.

---

## Karşılaşılan Zorluklar

| Sorun | Çözüm |
| :--- | :--- |
| `AnalysisJob.status` alanının varsayılan `VARCHAR(10)` olarak üretilmesi ve mimari belgeyle (`VARCHAR(20)`) çakışması. | `Enum(AnalysisJobStatus, length=20)` olarak tanımlanarak mimari dokümantasyon ile hizalandı. |
| `Settings` nesnesinin endpoint modül seviyesinde önbelleğe alınması nedeniyle test ortamında geçici dizin override'ının çalışmaması. | Endpoint parametresine `settings: Settings = Depends(get_settings)` eklenerek istek bazında dinamik enjeksiyon sağlandı. |

---

## Test ve Sonuç

- Birim, entegrasyon ve RBAC testlerini kapsayan **90 adet test** yazıldı.
- `python -m pytest -q -W error` ile tüm testler 0 hata ve 0 uyarı ile geçti.
- `compileall`, `alembic check` ve `pip check` denetimleri başarıyla doğrulandı.
- Alembic `a928a0a5102b` (head) revision seviyesi teyit edildi.
- Gerçek `data/uploads` dizininde test kalıntısı bırakılmadığı doğrulandı.

---

## Öğrenilenler

- **Akış Tabanlı (Streaming) İşleme:** Parçalar halinde okuyarak SHA-256 ve boyut hesaplamanın bellek kullanımını korumadaki önemi.
- **Güvenli Temizleme (Cleanup):** Veritabanı rollback durumunda diskte yetim (orphan) dosya kalmaması için silme işleminin atomik yönetimi.
- **FastAPI Test İzolasyonu:** `Depends` bağımlılık enjeksiyonu ile test ortamlarında dinamik ayar geçersiz kılmayı (`override`) sağlama.
- **Veri Sahipliği Filtreleme:** RBAC denetimlerinde kullanıcı rolü ve sahipliğe göre sorgu seviyesinde kısıtlama uygulanması.

---

## Sonraki Adımlar

- [ ] Sayısal ve kategorik sütun ayrımının yapılması.
- [ ] Eksik değer yönetimi (Imputer) altyapısının kurulması.
- [ ] ColumnTransformer ve scikit-learn ön işleme (preprocessing) Pipeline yapısının hazırlanması.
- [ ] Veri sızıntısının (data leakage) önlenmesi.
- [ ] Ön işleme adımları için birim ve entegrasyon testlerinin yazılması.

---

## Referanslar

- **Branch:** `feature/18-csv-upload-validation`
- **EPIC Issue:** [#4](https://github.com/mustafaemre027/securewatch-ai/issues/4)
- **Sub-Issue:** [#18](https://github.com/mustafaemre027/securewatch-ai/issues/18)
- **API Mimari Dokümanı:** [docs/architecture/06-api-endpoints.md](../architecture/06-api-endpoints.md)
- **Fonksiyonel Gereksinimler:** [docs/architecture/01-functional-requirements.md](../architecture/01-functional-requirements.md)

### Git Commit Mesajları

```text
[11:03] (7d90e82) feat(config): add CSV upload settings
[12:00] (c9f92fe) feat(model): add AnalysisJob model
[12:04] (9fcd8db) fix(model): align analysis job status length
[12:43] (9d59aa2) chore(database): add analysis jobs migration
[12:51] (658e1ff) feat(storage): add secure CSV file storage
[13:08] (c7f550d) feat(validation): validate CIC-IDS2017 CSV uploads
[14:43] (c40676b) feat(api): add analysis upload and status endpoints
[15:24] (5cb75be) fix(api): inject upload settings per request
[15:24] (3224528) test(upload): cover CSV upload and validation
[15:33] (1bc225a) docs(upload): document CSV upload workflow
```
