# SecureWatch AI — Durum Makineleri (State Machines)

Bu belge, SecureWatch AI projesindeki iki dinamik iş akışı olan **Analiz Süreci (AnalysisJob)** ve **Güvenlik Olayı (Incident)** nesnelerinin yaşam döngülerini, geçerli durumlarını ve durum geçiş kurallarını açıklar.

## 1. Giriş
Sistemdeki veri tutarlılığını korumak ve iş kurallarını işletmek amacıyla, belirli nesnelerin durum geçişleri katı kurallara bağlanmıştır. Bu kurallar backend servis katmanında doğrulanır.

---

## 2. Analiz Süreci (AnalysisJob) Durum Makinesi

`AnalysisJob` nesnesi, bir analist tarafından yüklenen ağ trafiği CSV dosyasının kuyruğa alınmasından tahmin sonuçlarının üretilmesine kadar geçen süreci yönetir.

### 2.1. Geçerli Durumlar
*   **`PENDING` (Beklemede):** Dosya sisteme başarıyla yüklenmiş, SHA-256 ve şema doğrulamalarından geçmiş ve arka plan analiz sırasına (arka plan görev mekanizması/worker abstraction) eklenmiştir.
*   **`PROCESSING` (İşleniyor):** Arka plan işçisi (worker) görevi devralmış, CSV dosyasını satır satır okumaya, veri ön işlemeye ve makine öğrenmesi tahmini yürütmeye başlamıştır.
*   **`COMPLETED` (Tamamlandı):** CSV dosyasındaki tüm satırlar başarıyla işlenmiş, risk skorları hesaplanmış ve `detection_results` tablosuna yazılmıştır.
*   **`FAILED` (Başarısız):** Görevin başlatılamaması (işçi çökmesi, dosya erişim hatası vb.) veya dosya işleme sırasında herhangi bir hatanın (beklenmeyen veri formatı, bellek yetersizliği vb.) oluşması durumudur. Hata detayları `error_message` alanına kaydedilir.

### 2.2. Durum Geçiş Kuralları ve Tetikleyiciler

| Mevcut Durum | Hedef Durum | Tetikleyici Eylem | Yetki |
| :--- | :--- | :--- | :--- |
| **-** | `PENDING` | CSV dosyasının başarıyla yüklenmesi ve doğrulanması. | Analyst |
| `PENDING` | `PROCESSING` | Arka plan görev mekanizmasının sıradaki işi işleme almaya başlaması. | System (Worker) |
| `PROCESSING` | `COMPLETED` | Dosyadaki tüm akışların tahmin edilip veritabanına yazılması. | System (Worker) |
| `PROCESSING` | `FAILED` | İşleme esnasında sistemsel veya mantıksal bir hata oluşması. | System (Worker) |
| `PENDING` | `FAILED` | Görevin başlatılamaması (işçi çökmesi, dosya erişim hatası vb.). | System (Worker) |

### 2.3. Mermaid Durum Diyagramı

```mermaid
stateDiagram-v2
    [*] --> PENDING : Dosya Yükleme & Doğrulama (Analyst)
    PENDING --> PROCESSING : İşçi Görevi Devraldı (System)
    PROCESSING --> COMPLETED : Analiz Başarıyla Tamamlandı (System)
    PROCESSING --> FAILED : Beklenmeyen Hata Oluştu (System)
    PENDING --> FAILED : Görevin Başlatılamaması (System)
    COMPLETED --> [*]
    FAILED --> [*]
```

---

## 3. Güvenlik Olayı (Incident) Durum Makinesi

`Incident` nesnesi, riskli tespitlerden türetilen güvenlik olaylarının yaşam döngüsünü yönetir.

### 3.1. Geçerli Durumlar
*   **`OPEN` (Açık):** `HIGH` veya `CRITICAL` riskli bir tespit sonucundan olay oluşturulmuş, ancak henüz üzerinde çalışmaya başlanmamış ve atama yapılmamıştır.
*   **`IN_PROGRESS` (İncelemede):** Olay bir analiste atanmış (`assigned_analyst_id`) veya analist olayı kendi üzerine alarak inceleme sürecini başlatmıştır.
*   **`RESOLVED` (Çözüldü):** Analist tehdidin gerçek olduğunu doğrulamış, gerekli inceleme notlarını eklemiş ve olayı çözümlendi olarak işaretlemiştir (Sistem otomatik engelleme veya port kapatma yapmaz; yalnızca olay takibi ve karar desteği sağlar).
*   **`FALSE_POSITIVE` (Yanlış Alarm):** Analist yaptığı teknik inceleme sonucunda modelin tahmininin hatalı olduğunu (normal trafiğin saldırı olarak sınıflandırıldığını) tespit etmiş ve olayı bu statüyle kapatmıştır (İnceleme sonrası nihai karar durumudur).

### 3.2. Durum Geçiş Kuralları ve Yetkiler

| Mevcut Durum | Hedef Durum | Geçiş Koşulu ve Açıklama | Yetki |
| :--- | :--- | :--- | :--- |
| **-** | `OPEN` | Analistin riskli bir tespit sonucundan güvenlik olayı oluşturması. | Analyst |
| `OPEN` | `IN_PROGRESS` | Yönetici tarafından olayın bir analiste atanması veya analistin olayı üstlenmesi. | Admin / Analyst |
| `IN_PROGRESS` | `RESOLVED` | Tehdit analizi ve inceleme notlarının tamamlanıp olayın çözülmesi. | Admin / Analyst |
| `IN_PROGRESS` | `FALSE_POSITIVE` | İnceleme sonucu tespitin yanlış alarm olduğunun anlaşılması. | Admin / Analyst |

### 3.3. Mermaid Durum Diyagramı

```mermaid
stateDiagram-v2
    [*] --> OPEN : Olay Oluşturma (Analyst)
    OPEN --> IN_PROGRESS : Analist Atama / Üstlenme (Admin/Analyst)
    IN_PROGRESS --> RESOLVED : Tehdit Çözüldü (Analyst)
    IN_PROGRESS --> FALSE_POSITIVE : İnceleme Sonucu Yanlış Alarm (Analyst)
    RESOLVED --> [*]
    FALSE_POSITIVE --> [*]
```
