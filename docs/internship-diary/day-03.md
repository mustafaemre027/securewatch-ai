# Staj Günlüğü — Gün 3

## Temel Bilgiler

- **Tarih:** 16.07.2026
- **Faz:** Faz 1 — Veri Analizi ve Sistem Mimarisi
- **EPIC Issue:** [#2](https://github.com/mustafaemre027/securewatch-ai/issues/2)
- **Çalışılan Sub-Issue'lar:**
  - [#14](https://github.com/mustafaemre027/securewatch-ai/issues/14) — [Faz-1] Gün 3: Sistem Mimarisi Tasarımı ve Teknik Dokümantasyon
- **Branch:** `feature/14-system-architecture-design`
- **PR:** -

---

## Hedef

1.  SecureWatch AI platformunun fonksiyonel gereksinimlerini, kullanıcı senaryolarını, veritabanı şemasını, durum makinelerini, katmanlı mimarisini, API taslaklarını ve makine öğrenmesi eğitim/inference süreçlerini detaylandıran 7 bağımsız mimari belgesinin `docs/architecture/` altında oluşturulması.
2.  Mevcut dokümanlardaki tutarsızlıkların (eski veri seti atıfları, terminoloji uyumsuzlukları ve yetki karmaşası) düzeltilmesi.
3.  Gün 2'ye ait eksik staj günlüğünün tamamlanarak eklenmesi.

---

## Yapılanlar

### 1. 7 Bağımsız Mimari Belgesinin Oluşturulması (#14)
-   `01-functional-requirements.md` — Gereksinimler listelendi. `FR-[Bileşen]-[ÜçHaneliSayı]` standardı kuruldu.
-   `02-user-scenarios.md` — Yönetici ve analist rolleri için kullanım senaryoları detaylandırıldı. Analistlerin model risk skorunu değiştiremeyeceği kısıtı ve durum geçişlerinde `RESOLVED` / `FALSE_POSITIVE` kullanımı sağlandı.
-   `03-database-design.md` — ER diyagramı ve veri sözlüğü hazırlandı. `DetectionResult` tablosu alanları CIC-IDS2017 şemasına göre `destination_port` korunup; veri setinde bulunmayan `source_ip`, `destination_ip`, `source_port` ve `protocol` bilgileri hariç tutularak tasarlandı. İlişkisel kısıtlar (Cascade, Restrict, Set Null) gerekçelendirildi.
-   `04-state-machines.md` — `AnalysisJob` ve `Incident` nesneleri için durum geçişleri ve Mermaid diyagramları eklendi.
-   `05-system-architecture.md` — Sunum, API, Servis, ML ve DB katmanlarının detayları açıklandı.
-   `06-api-endpoints.md` — REST uç noktaları, request/response gövdeleri ve standart hata kodları tasarlandı.
-   `07-ml-training-and-inference.md` — Data leakage önleme adımları ve batch tahmin süreci MVP kapsamında tasarlandı ve dokümante edildi.

### 2. Dokümantasyon Tutarsızlıklarının Düzeltilmesi
-   `docs/cicids2017-analysis-report.md` içerisindeki eski "UNSW-NB15" referansları temizlendi.
-   `implementation_plan.md` içindeki "Train/test CSV dosyaları" ifadesi "MachineLearningCSV dosyaları" ile güncellendi.
-   `docs/github-workflow.md` içindeki merge sorumluluğu, danışman kontrollü süreç kurallarına göre güncellendi.

### 3. Eksik Günlüklerin Tamamlanması
-   Eksik olan Gün 2 staj günlüğü (`day-02.md`) hazırlanarak `docs/internship-diary/` dizinine eklendi.

### 4. Teknik İnceleme ve Düzeltmeler (Review Fixes)
-   Arayüz ve gereksinimlerdeki dosya boyutu sınırı (sabit 50MB) kaldırılarak yapılandırılabilir hale getirildi.
-   Dashboard'dan detaylı saldırı türü dağılımları kaldırıldı, ikili model çıktısı normal/şüpheli ve risk seviyesi dağılımları ile sınırlandırıldı.
-   ER diyagramındaki isteğe bağlı (optional) kullanıcı ilişkileri düzeltildi ve `incident_comments.user_id` nullable olarak işaretlendi.
-   Durum makinelerindeki Celery atıfları kaldırılarak MVP worker soyutlaması yapıldı; resolved/false positive durumlarından geri açılma geçişleri kaldırıldı.
-   API taslağındaki HTTP yanıt kodları (201 Created, 202 Accepted) düzeltildi, eksik 5 API uç noktası eklendi ve yetki limitleri netleştirildi.
-   ML süreç diyagramları ve katman bağımlılık şemaları Mermaid formatında görselleştirildi.
-   Ön analiz raporu ve uygulama planındaki sentetik veri üretimi Day 6'ya ertelenecek şekilde uyumlu hale getirildi.

---

## Karşılaşılan Zorluklar

| Sorun | Çözüm |
| :--- | :--- |
| CIC-IDS2017 veri setinde bulunmayan IP ve port bilgilerinin `DetectionResult` tablosunda zorunlu tutulmasının veri tutarsızlığına yol açacağı fark edildi. | ER tasarımı güncellenerek `destination_port` korunmuş; veri setinde yer almayan `source_ip`, `destination_ip`, `source_port` ve `protocol` sütunları tablodan çıkarılmıştır. Ham özniteliklerin tamamı ise `feature_snapshot_json` (JSONB) alanında saklanacak şekilde tasarlanmıştır. |

---

## Değişiklik Özeti

| Dosya | Değişiklik |
| :--- | :--- |
| `docs/architecture/01-functional-requirements.md` | Fonksiyonel gereksinimler tablosu oluşturuldu. |
| `docs/architecture/02-user-scenarios.md` | Kullanıcı senaryoları belgelendi. |
| `docs/architecture/03-database-design.md` | ER diyagramı ve veri sözlüğü hazırlandı. |
| `docs/architecture/04-state-machines.md` | İş ve olay durum geçişleri Mermaid şemalarıyla açıklandı. |
| `docs/architecture/05-system-architecture.md` | Katmanlı sistem yapısı ve bileşen iletişimi tasarlandı. |
| `docs/architecture/06-api-endpoints.md` | API uç noktaları ve hata kodları taslağı oluşturuldu. |
| `docs/architecture/07-ml-training-and-inference.md` | ML eğitim ve batch tahmin veri akışları tanımlandı. |
| `docs/cicids2017-analysis-report.md` | UNSW-NB15 ifadeleri kaldırıldı. |
| `implementation_plan.md` | Terminoloji düzeltildi. |
| `docs/github-workflow.md` | Merge kuralları güncellendi. |
| `docs/internship-diary/day-02.md` | Gün 2 staj günlüğü eklendi. |
| `docs/internship-diary/day-03.md` | Gün 3 staj günlüğü eklendi. |

---

## Öğrenilenler

- Gerçek veride bulunmayan (IP, port gibi) özelliklerin mimari aşamasında varmış gibi modellenmesinin veritabanı aşamasında yaratacağı zorluklar.
- Veri sızıntısını (data leakage) engellemek amacıyla veri dönüşümlerinin stratified split sonrası sadece eğitim seti üzerinde fit edilmesi kuralı.

---

## Referanslar

- **Branch:** `feature/14-system-architecture-design`
- **EPIC Issue:** [#2](https://github.com/mustafaemre027/securewatch-ai/issues/2)
- **Sub-Issue:** [#14](https://github.com/mustafaemre027/securewatch-ai/issues/14)
- **İlgili Commit'ler:**
    - `e197c33` (docs(data): remove stale UNSW-NB15 references)
    - `81a96b3` (docs(roadmap): use MachineLearningCSV terminology)
    - `c4f4f36` (docs(workflow): clarify advisor-controlled merge process)
    - `219aed9` (docs(requirements): define functional requirements)
    - `54c6342` (docs(use-cases): document admin and analyst scenarios)
    - `ebb4397` (docs(database): add ER model and data dictionary)
    - `2aa3572` (docs(workflow): define analysis and incident state machines)
    - `9886831` (docs(architecture): document layered system design)
    - `b7a6158` (docs(api): draft core API endpoints)
    - `2327a50` (docs(ml): document training and batch inference flows)
    - `5f56c84` (docs(diary): add missing day 02 internship entry)
    - `729afbd` (docs(diary): add day 03 internship entry)
    - `905a8a8` (docs(requirements): align upload schema and dashboard scope)
    - `ee44738` (docs(database): fix nullable relationships and dataset fields)
    - `edb6648` (docs(workflow): correct MVP state transitions)
    - `48e2714` (docs(architecture): correct layered component dependencies)
    - `8eef0ae` (docs(api): correct endpoint semantics and RBAC coverage)
    - `6b3ae40` (docs(ml): fix training diagram and risk boundaries)
    - `96af059` (docs(data): align preprocessing decisions and roadmap claims)
    - `96ec6d7` (docs(diary): refine day 02 technical statements)
    - `391c2e9` (docs(api): fix user created status code)
