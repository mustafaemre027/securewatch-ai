# SecureWatch AI — API Tasarımı (API Endpoints Draft)

Bu belge, SecureWatch AI karar destek platformunun temel REST API uç noktalarını (endpoints), istek/yanıt (request/response) yapılarını, rol tabanlı erişim (RBAC) kurallarını ve standart hata kodlarını tanımlar.

## 1. REST API Tasarım Standartları
Sistemdeki tüm API uç noktaları aşağıdaki standartları takip eder:
*   **Temel URL:** `/api/v1`
*   **Veri Formatı:** İstek ve yanıt gövdeleri JSON formatındadır (Dosya yükleme hariç - `multipart/form-data`).
*   **Zaman Biçimi:** Tüm zaman damgaları ISO 8601 UTC formatındadır (`YYYY-MM-DDTHH:MM:SSZ`).
*   **Kimlik Doğrulama:** JWT token'ları HTTP Authorization başlığında `Bearer <token>` formatında iletilir.

---

## 2. Kimlik Doğrulama ve Yetkilendirme (RBAC) Kuralları

API uç noktalarına erişim, kullanıcı rolüne göre kısıtlanmıştır:
*   `ADMIN`: Sistem yönetimi, kullanıcı oluşturma, tüm analiz ve olayları görüntüleme, audit log inceleme, analist atama.
*   `ANALYST`: Dosya yükleme, analiz başlatma, tespit detaylarını inceleme, olayları güncelleme, yorum ekleme.
*   `ALL`: Hem Admin hem de Analyst rollerinin erişebildiği uç noktalar.

---

## 3. API Endpoint Taslakları

### 3.1. Kimlik Doğrulama (Authentication)

#### **POST `/api/v1/auth/login`**
*   **Açıklama:** Kullanıcı adı ve parola ile giriş yaparak JWT token üretir.
*   **Rol:** PUBLIC (Giriş/kimlik doğrulaması gerektirmez)
*   **İstek Gövdesi (Request Body):**
    ```json
    {
      "username": "analyst_emre",
      "password": "SecurePassword123"
    }
    ```
*   **Başarılı Yanıt (200 OK):**
    ```json
    {
      "access_token": "eyJhbGciOiJIUzI1NiIsIn...",
      "token_type": "bearer",
      "user": {
        "id": 2,
        "username": "analyst_emre",
        "email": "emre@securewatch.ai",
        "role": "ANALYST"
      }
    }
    ```

---

### 3.2. Kullanıcı Yönetimi (User Management)

#### **POST `/api/v1/users`**
*   **Açıklama:** Yeni bir kullanıcı hesabı oluşturur (hashlenmiş parola ile veritabanına kaydeder).
*   **Rol:** ADMIN
*   **İstek Gövdesi (Request Body):**
    ```json
    {
      "username": "analyst_ahmet",
      "email": "ahmet@securewatch.ai",
      "password": "TemporaryPass456!",
      "role": "ANALYST"
    }
    ```
*   **Başarılı Yanıt (21 Created):**
    ```json
    {
      "id": 3,
      "username": "analyst_ahmet",
      "email": "ahmet@securewatch.ai",
      "role": "ANALYST",
      "created_at": "2026-07-16T15:30:00Z"
    }
    ```

---

### 3.3. Ağ Trafiği ve Analiz Yönetimi (Analysis Management)

#### **POST `/api/v1/analysis/upload`**
*   **Açıklama:** Ağ trafiği inference CSV dosyasını sunucuya yükler ve batch tahmin (inference) sürecini başlatır.
*   **Rol:** ANALYST
*   **İstek Tipi:** `multipart/form-data`
*   **İstek Parametreleri:**
    - `file`: CSV dosyası (MIME: `text/csv`, dosya boyutu sistem ayarlarındaki upload limitine uygun olmalıdır)
*   **Başarılı Yanıt (202 Accepted):**
    ```json
    {
      "job_id": 45,
      "file_name": "Friday-WorkingHours-Afternoon-DDos.csv",
      "file_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "file_size": 25487622,
      "status": "PENDING",
      "created_at": "2026-07-16T15:31:00Z"
    }
    ```

#### **GET `/api/v1/analysis`**
*   **Açıklama:** Geçmiş analiz işlerini (`AnalysisJob`) listeler.
*   **Rol:** ALL (Yöneticiler tüm işleri, Analistler yalnızca kendi başlattıkları işleri listeleyebilir)
*   **Sorgu Parametreleri (Query Params):**
    - `status` (opsiyonel): `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`
    - `skip` (varsayılan: 0)
    - `limit` (varsayılan: 20)
*   **Başarılı Yanıt (200 OK):**
    ```json
    [
      {
        "id": 45,
        "file_name": "Friday-WorkingHours-Afternoon-DDos.csv",
        "file_size": 25487622,
        "status": "COMPLETED",
        "created_at": "2026-07-16T15:31:00Z",
        "completed_at": "2026-07-16T15:33:12Z"
      }
    ]
    ```

#### **GET `/api/v1/analysis/{job_id}/results`**
*   **Açıklama:** Belirli bir analiz işine ait tahmin ve risk seviyesi sonuçlarını listeler.
*   **Rol:** ALL (Yöneticiler tüm analiz sonuçlarına erişebilir. Analistler yalnızca kendi yetkili oldukları/oluşturdukları analiz işlerinin sonuçlarını listeleyebilir).
*   **Sorgu Parametreleri (Query Params):**
    - `risk_level` (opsiyonel): `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
    - `predicted_label` (opsiyonel): `0` veya `1`
*   **Başarılı Yanıt (200 OK):**
    ```json
    {
      "job_id": 45,
      "total_records": 225745,
      "results": [
        {
          "id": 1024501,
          "source_row_number": 12450,
          "destination_port": 80,
          "predicted_label": "1",
          "attack_probability": 0.942,
          "risk_score": 94,
          "risk_level": "CRITICAL",
          "ground_truth_label": "ATTACK",
          "model_version": "v1.0.0",
          "created_at": "2026-07-16T15:33:00Z"
        }
      ]
    }
    ```
    > **Not:** `ground_truth_label` değeri yalnızca etiketli değerlendirme dosyaları yüklenmişse dolu olarak döner; normal inference dosyalarında `null` olacaktır.

---

### 3.4. Güvenlik Olayı Yönetimi (Incident Management)

#### **POST `/api/v1/incidents`**
*   **Açıklama:** Belirli bir `DetectionResult` kaydını referans alarak yeni bir güvenlik olayı (`Incident`) oluşturur.
*   **Rol:** ANALYST
*   **İstek Gövdesi (Request Body):**
    ```json
    {
      "detection_result_id": 1024501,
      "title": "Port 80 Üzerinde Şüpheli Trafik Algılandı",
      "description": "Model %94 olasılıkla yüksek riskli şüpheli trafik tespit etmiştir. Hedef Port: 80, Kayıt Sırası: 12450.",
      "severity": "CRITICAL"
    }
    ```
*   **Başarılı Yanıt (201 Created):**
    ```json
    {
      "id": 12,
      "detection_result_id": 1024501,
      "assigned_analyst_id": null,
      "status": "OPEN",
      "severity": "CRITICAL",
      "title": "Port 80 Üzerinde Şüpheli Trafik Algılandı",
      "description": "Model %94 olasılıkla yüksek riskli şüpheli trafik tespit etmiştir...",
      "created_at": "2026-07-16T15:35:00Z",
      "updated_at": "2026-07-16T15:35:00Z"
    }
    ```

#### **PATCH `/api/v1/incidents/{incident_id}`**
*   **Açıklama:** Olayın durumunu (`status`) günceller veya olay ataması (`assigned_analyst_id`) yapar.
*   **Rol:** ALL (Analistler yalnızca kendilerine atanmış veya kendi üstlendikleri olayların durumunu güncelleyebilir. Yöneticiler tüm olaylarda atama ve durum güncellemelerini yapabilir).
*   **İstek Gövdesi (Request Body):**
    ```json
    {
      "assigned_analyst_id": 2,
      "status": "IN_PROGRESS"
    }
    ```
    *Veya olayın çözülmesi durumunda:*
    ```json
    {
      "status": "RESOLVED"
    }
    ```
*   **Başarılı Yanıt (200 OK):**
    ```json
    {
      "id": 12,
      "assigned_analyst_id": 2,
      "status": "IN_PROGRESS",
      "severity": "CRITICAL",
      "updated_at": "2026-07-16T15:38:00Z"
    }
    ```

#### **POST `/api/v1/incidents/{incident_id}/comments`**
*   **Açıklama:** Olayın altına analiz yorumu ekler.
*   **Rol:** ALL (Analistler yalnızca kendilerine atanmış veya kendi üstlendikleri olaylara yorum ekleyebilir)
*   **İstek Gövdesi (Request Body):**
    ```json
    {
      "comment_text": "Kayıt detayındaki TCP bayrakları incelendi. Yüksek riskli şüpheli trafik akışı doğrulandı."
    }
    ```
*   **Başarılı Yanıt (201 Created):**
    ```json
    {
      "id": 89,
      "incident_id": 12,
      "user_id": 2,
      "comment_text": "Kayıt detayındaki TCP bayrakları incelendi...",
      "created_at": "2026-07-16T15:40:00Z"
    }
    ```

---

### 3.5. Dashboard ve Audit Günlükleri

#### **GET `/api/v1/dashboard/summary`**
*   **Açıklama:** Dashboard ekranındaki görsel grafikler ve özet kartlar için toplulaştırılmış verileri döner.
*   **Rol:** ALL
*   **Başarılı Yanıt (200 OK):**
    ```json
    {
      "total_analysis_jobs": 45,
      "total_processed_flows": 2830743,
      "normal_flow_count": 2273097,
      "attack_flow_count": 557646,
      "risk_distribution": {
        "LOW": 2273097,
        "MEDIUM": 15450,
        "HIGH": 312000,
        "CRITICAL": 230196
      },
      "active_incidents_count": 8
    }
    ```
    > **Not:** Dashboard verilerindeki sayılar ve metrikler ham veri setinin orijinal etiket sayımları değil, sistemde tamamlanan batch tahmin işlerinin sonuçlarından hesaplanan örnek ve temsilî değerlerdir.

#### **GET `/api/v1/audit-logs`**
*   **Açıklama:** Sistemdeki idari ve güvenlik işlemlerine dair denetim loglarını listeler.
*   **Rol:** ADMIN
*   **Sorgu Parametreleri (Query Params):**
    - `user_id` (opsiyonel): Belirli bir kullanıcıya ait loglar.
    - `action_type` (opsiyonel): Belirli bir eylem türüne (örn. 'FILE_UPLOAD') ait loglar.
    - `start_date` / `end_date` (opsiyonel): Belirli bir zaman aralığı (ISO 8601).
*   **Başarılı Yanıt (200 OK):**
    ```json
    [
      {
        "id": 501,
        "user_id": 2,
        "action_type": "FILE_UPLOAD",
        "description": "User analyst_emre uploaded file: Friday-WorkingHours-Afternoon-Suspicious.csv (SHA-256: e3b0c4...)",
        "ip_address": "192.168.1.50",
        "created_at": "2026-07-16T15:31:00Z"
      }
    ]
    ```

---

### 3.6. Ek Temel API Endpoint Taslakları

#### **GET `/api/v1/users`**
*   **Açıklama:** Sistemde kayıtlı olan tüm kullanıcıları listeler.
*   **Rol:** ADMIN
*   **Başarılı Yanıt (200 OK):**
    ```json
    [
      {
        "id": 1,
        "username": "admin_mustafa",
        "email": "mustafa@securewatch.ai",
        "role": "ADMIN",
        "created_at": "2026-07-16T11:00:00Z"
      }
    ]
    ```

#### **GET `/api/v1/analysis/{job_id}`**
*   **Açıklama:** Belirli bir analiz işinin (`AnalysisJob`) detaylı durum ve meta bilgilerini getirir.
*   **Rol:** ALL (Analistler yalnızca kendi başlattıkları analiz işlerini görüntüleyebilir).
*   **Başarılı Yanıt (200 OK):**
    ```json
    {
      "id": 45,
      "user_id": 2,
      "file_name": "Friday-WorkingHours-Afternoon-Suspicious.csv",
      "file_hash": "e3b0c44298fc...",
      "file_size": 25487622,
      "status": "COMPLETED",
      "error_message": null,
      "created_at": "2026-07-16T15:31:00Z",
      "completed_at": "2026-07-16T15:33:12Z"
    }
    ```

#### **GET `/api/v1/detections/{detection_id}`**
*   **Açıklama:** Belirli bir tespit sonucunun (`DetectionResult`) detaylı öznitelik snapshot (JSONB) verilerini getirir.
*   **Rol:** ALL
*   **Başarılı Yanıt (200 OK):**
    ```json
    {
      "id": 1024501,
      "analysis_job_id": 45,
      "source_row_number": 12450,
      "destination_port": 80,
      "predicted_label": "1",
      "attack_probability": 0.942,
      "risk_score": 94,
      "risk_level": "CRITICAL",
      "ground_truth_label": "ATTACK",
      "feature_snapshot_json": {
        "Flow Duration": 112450,
        "Total Fwd Packets": 4,
        "Total Backward Packets": 3
      },
      "model_version": "v1.0.0",
      "created_at": "2026-07-16T15:33:00Z"
    }
    ```

#### **GET `/api/v1/incidents`**
*   **Açıklama:** Güvenlik olaylarını listeler ve filtreler.
*   **Rol:** ALL
*   **Sorgu Parametreleri (Query Params):**
    - `status` (opsiyonel): `OPEN`, `IN_PROGRESS`, `RESOLVED`, `FALSE_POSITIVE`
    - `assigned_analyst_id` (opsiyonel): Belirli bir analiste atanan olaylar
    - `severity` (opsiyonel): `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
*   **Başarılı Yanıt (200 OK):**
    ```json
    [
      {
        "id": 12,
        "detection_result_id": 1024501,
        "assigned_analyst_id": 2,
        "status": "IN_PROGRESS",
        "severity": "CRITICAL",
        "title": "Port 80 Üzerinde Şüpheli Trafik Algılandı",
        "created_at": "2026-07-16T15:35:00Z",
        "updated_at": "2026-07-16T15:38:00Z"
      }
    ]
    ```

#### **GET `/api/v1/incidents/{incident_id}`**
*   **Açıklama:** Belirli bir güvenlik olayının (`Incident`) yorumları ile birlikte detaylarını getirir.
*   **Rol:** ALL
*   **Başarılı Yanıt (200 OK):**
    ```json
    {
      "id": 12,
      "detection_result_id": 1024501,
      "assigned_analyst_id": 2,
      "status": "IN_PROGRESS",
      "severity": "CRITICAL",
      "title": "Port 80 Üzerinde Şüpheli Trafik Algılandı",
      "description": "Model %94 olasılıkla yüksek riskli şüpheli trafik tespit etmiştir...",
      "created_at": "2026-07-16T15:35:00Z",
      "updated_at": "2026-07-16T15:38:00Z",
      "comments": [
        {
          "id": 89,
          "user_id": 2,
          "comment_text": "Kayıt detayındaki TCP bayrakları incelendi...",
          "created_at": "2026-07-16T15:40:00Z"
        }
      ]
    }
    ```

---

## 4. Hata Kodları ve Hata Yanıt Şeması

Platform, bir hata durumunda istemciye standart olarak aşağıdaki formatta yanıt döner:
```json
{
  "error_code": "RESOURCE_NOT_FOUND",
  "message": "Aranılan kayıt veritabanında bulunamadı.",
  "details": {
    "resource": "Incident",
    "id": 999
  }
}
```

### Standart Hata Kodları Tablosu

| HTTP Durumu | Hata Kodu (`error_code`) | Açıklama |
| :--- | :--- | :--- |
| **400 Bad Request** | `INVALID_INPUT` | Gönderilen istek gövdesindeki veriler doğrulanmadı (eksik alan vb.). |
| **400 Bad Request** | `DUPLICATE_FILE` | Aynı SHA-256 hash değerine sahip bir dosya zaten yüklenmiş. |
| **401 Unauthorized** | `CREDENTIALS_INVALID` | Yanlış kullanıcı adı veya parola girildi. |
| **401 Unauthorized** | `TOKEN_EXPIRED` | JWT oturum token'ının süresi dolmuş. |
| **403 Forbidden** | `PERMISSION_DENIED` | Kullanıcının bu işlemi gerçekleştirmek için yetkisi (rolü) yetersiz. |
| **404 Not Found** | `RESOURCE_NOT_FOUND` | Belirtilen ID'ye sahip kaynak (Analiz, Olay vb.) bulunamadı. |
| **422 Unprocessable** | `SCHEMA_MISMATCH` | Yüklenen CSV dosyasının sütunları CIC-IDS2017 şemasıyla eşleşmiyor. |
| **500 Internal Error** | `SERVER_ERROR` | Beklenmeyen bir sunucu hatası oluştu. |
