# SecureWatch AI — API Sözleşmesi (API Endpoints)

Bu belge, SecureWatch AI karar destek platformunun temel REST API uç noktalarını (endpoints), istek/yanıt (request/response) yapılarını, rol tabanlı erişim (RBAC) kurallarını ve standart hata kodlarını tanımlayan güncel ve uygulanmış API referansıdır.

## 1. REST API Tasarım Standartları
Sistemdeki tüm API uç noktaları aşağıdaki standartları takip eder:
*   **Temel URL:** `/api/v1`
*   **Veri Formatı:** İstek ve yanıt gövdeleri JSON formatındadır (Dosya yükleme hariç - `multipart/form-data`).
*   **Zaman Biçimi:** Tüm zaman damgaları ISO 8601 UTC formatındadır (`YYYY-MM-DDTHH:MM:SSZ`).
*   **Kimlik Doğrulama:** JWT token'ları HTTP Authorization başlığında `Bearer <token>` formatında iletilir.
*   **Otomatik Dokümantasyon:** FastAPI tarafından sağlanan etkileşimli API dokümantasyonuna çalışan backend sunucusu üzerinden `/docs` (Swagger UI) veya `/redoc` (ReDoc) adreslerinden erişilebilir.

---

## 2. Kimlik Doğrulama ve Yetkilendirme (RBAC) Kuralları

API uç noktalarına erişim, kullanıcı rolüne göre kısıtlanmıştır:
*   `ADMIN`: Sistem yönetimi, kullanıcı oluşturma, denetim (audit) günlüklerini inceleme, tüm analizleri ve tüm olayları (incident) görüntüleme, olay ataması yapma.
*   `ANALYST`: Dosya yükleme (analiz işi oluşturma), yalnızca kendi başlattığı analiz işlerini ve bunların sonuçlarını inceleme, olay oluşturma, olayları güncelleme ve yorum ekleme.
*   `ALL`: Hem Admin hem de Analyst rollerinin erişebildiği uç noktalar.
*   **Gizlilik İlkesi (404 Davranışı):** Bir ANALYST yetkisi olmayan bir analize (örn. başka bir analistin başlattığı işe) ID üzerinden erişmeye çalıştığında, sistem 403 (Forbidden) yerine, kaynak varlığını sızdırmamak adına 404 (Not Found) hatası döner.

---

## 3. Uygulanan API Uç Noktaları

### 3.1. Health (Sağlık)

#### **GET `/api/v1/health`**
*   **Açıklama:** Sistemin (uygulama ve veritabanı) çalışma durumunu kontrol eder.
*   **Rol:** PUBLIC
*   **Başarılı Yanıt (200 OK):**
    ```json
    {
      "status": "healthy",
      "version": "1.0.0",
      "environment": "development",
      "database": "connected",
      "timestamp": "2026-08-08T15:30:00Z"
    }
    ```

### 3.2. Kimlik Doğrulama (Authentication)

#### **POST `/api/v1/auth/login`**
*   **Açıklama:** Kullanıcı adı ve parola ile giriş yaparak JWT token üretir.
*   **Rol:** PUBLIC
*   **İstek Gövdesi:** (x-www-form-urlencoded - OAuth2PasswordRequestForm)
    ```
    username=analyst_demo&password=securepassword
    ```
*   **Başarılı Yanıt (200 OK):**
    ```json
    {
      "access_token": "eyJhbGciOiJIUzI1...",
      "token_type": "bearer"
    }
    ```

### 3.3. Kullanıcı Yönetimi (User Management)

#### **GET `/api/v1/users`**
*   **Açıklama:** Sistemdeki kullanıcıları listeler.
*   **Rol:** ADMIN
*   **Başarılı Yanıt (200 OK):**
    ```json
    [
      {
        "id": 1,
        "username": "admin_demo",
        "email": "admin@example.com",
        "role": "ADMIN",
        "is_active": true,
        "created_at": "2026-08-08T15:00:00Z",
        "updated_at": "2026-08-08T15:00:00Z"
      }
    ]
    ```

#### **POST `/api/v1/users`**
*   **Açıklama:** Yeni kullanıcı oluşturur.
*   **Rol:** ADMIN
*   **İstek Gövdesi:**
    ```json
    {
      "username": "analyst_new",
      "email": "analyst@example.com",
      "password": "StrongPassword123!",
      "role": "ANALYST"
    }
    ```
*   **Başarılı Yanıt (201 Created):**
    ```json
    {
      "id": 3,
      "username": "analyst_new",
      "email": "analyst@example.com",
      "role": "ANALYST",
      "is_active": true,
      "created_at": "2026-08-08T15:05:00Z",
      "updated_at": "2026-08-08T15:05:00Z"
    }
    ```

### 3.4. Denetim Günlükleri (Audit Logs)

#### **GET `/api/v1/audit-logs`**
*   **Açıklama:** Sistem denetim günlüklerini listeler.
*   **Rol:** ADMIN
*   **Sorgu Parametreleri:** `user_id`, `action_type`, `start_date`, `end_date`, `skip`, `limit`
*   **Başarılı Yanıt (200 OK):**
    ```json
    [
      {
        "id": 1,
        "user_id": 1,
        "action_type": "USER_LOGIN",
        "description": "User logged in",
        "ip_address": "127.0.0.1",
        "created_at": "2026-08-08T15:10:00Z"
      }
    ]
    ```

### 3.5. Analiz İşlemleri (Analysis)

#### **POST `/api/v1/analysis/upload`**
*   **Açıklama:** Inference için CIC-IDS2017 uyumlu CSV dosyasını sunucuya yükler ve PENDING durumunda analiz işi oluşturur.
*   **Rol:** ANALYST
*   **İstek:** `multipart/form-data` (`file`)
*   **Başarılı Yanıt (202 Accepted):**
    ```json
    {
      "job_id": 10,
      "file_name": "traffic_data.csv",
      "file_hash": "e3b0c44298fc1c149afbf4...",
      "file_size": 1500000,
      "status": "PENDING",
      "created_at": "2026-08-08T15:20:00Z"
    }
    ```

#### **GET `/api/v1/analysis`**
*   **Açıklama:** Analiz işlerini listeler (Sayfalama içerir). Analistler sadece kendi işlerini görür.
*   **Rol:** ALL
*   **Sorgu Parametreleri:** `status`, `skip`, `limit`
*   **Başarılı Yanıt (200 OK):**
    ```json
    [
      {
        "id": 10,
        "file_name": "traffic_data.csv",
        "file_size": 1500000,
        "status": "COMPLETED",
        "created_at": "2026-08-08T15:20:00Z",
        "completed_at": "2026-08-08T15:21:00Z"
      }
    ]
    ```

#### **GET `/api/v1/analysis/{job_id}`**
*   **Açıklama:** Belirli bir analiz işinin detayını (özet durumunu) getirir.
*   **Rol:** ALL
*   **Başarılı Yanıt (200 OK):**
    ```json
    {
      "id": 10,
      "user_id": 2,
      "file_name": "traffic_data.csv",
      "file_hash": "e3b0c442...",
      "file_size": 1500000,
      "status": "COMPLETED",
      "error_message": null,
      "created_at": "2026-08-08T15:20:00Z",
      "completed_at": "2026-08-08T15:21:00Z"
    }
    ```

#### **POST `/api/v1/analysis/{job_id}/process`**
*   **Açıklama:** PENDING durumundaki analiz işini senkron olarak çalıştırır (Inference işlemi).
*   **Rol:** ALL
*   **Başarılı Yanıt (200 OK):**
    ```json
    {
      "job_id": 10,
      "records_processed": 5000,
      "final_status": "COMPLETED"
    }
    ```

#### **GET `/api/v1/analysis/{job_id}/results`**
*   **Açıklama:** Tamamlanmış analizin tespit sonuçlarını (DetectionResult) sayfalamalı olarak listeler.
*   **Rol:** ALL
*   **Sorgu Parametreleri:** `skip`, `limit`, `is_attack`, `risk_level`
*   **Başarılı Yanıt (200 OK):**
    ```json
    {
      "items": [
        {
          "id": 5001,
          "job_id": 10,
          "row_index": 145,
          "attack_probability": 0.95,
          "is_attack": true,
          "risk_level": "CRITICAL",
          "created_at": "2026-08-08T15:21:05Z"
        }
      ],
      "total": 1,
      "skip": 0,
      "limit": 50
    }
    ```

#### **GET `/api/v1/analysis/{job_id}/summary`**
*   **Açıklama:** Analize ait risk özet metriklerini döner.
*   **Rol:** ALL
*   **Başarılı Yanıt (200 OK):**
    ```json
    {
      "job_id": 10,
      "status": "COMPLETED",
      "total_records": 5000,
      "normal_count": 4800,
      "attack_count": 200,
      "risk_level_counts": {
        "LOW": 4800,
        "MEDIUM": 50,
        "HIGH": 100,
        "CRITICAL": 50
      },
      "completed_at": "2026-08-08T15:21:00Z"
    }
    ```

### 3.6. Güvenlik Olayı Yönetimi (Incident Management)

#### **POST `/api/v1/incidents`**
*   **Açıklama:** Yüksek riskli bir tespitten (`detection_result_id`) yeni güvenlik olayı (`Incident`) oluşturur.
*   **Rol:** ANALYST
*   **İstek Gövdesi:**
    ```json
    {
      "title": "Şüpheli TCP Trafiği (Kayıt 145)",
      "description": "Model tarafından %95 olasılıkla saldırı olarak değerlendirildi.",
      "severity": "CRITICAL",
      "detection_result_id": 5001
    }
    ```
*   **Başarılı Yanıt (201 Created):**
    ```json
    {
      "id": 1,
      "title": "Şüpheli TCP Trafiği (Kayıt 145)",
      "description": "Model tarafından %95 olasılıkla saldırı olarak değerlendirildi.",
      "severity": "CRITICAL",
      "detection_result_id": 5001,
      "assigned_analyst_id": null,
      "status": "OPEN",
      "created_at": "2026-08-08T15:25:00Z",
      "updated_at": "2026-08-08T15:25:00Z"
    }
    ```

#### **GET `/api/v1/incidents`**
*   **Açıklama:** Güvenlik olaylarını sayfalamalı ve filtrelenebilir listeler.
*   **Rol:** ALL
*   **Sorgu Parametreleri:** `status`, `severity`, `assigned_analyst_id`, `skip`, `limit`
*   **Başarılı Yanıt (200 OK):**
    ```json
    [
      {
        "id": 1,
        "title": "Şüpheli TCP Trafiği (Kayıt 145)",
        "description": "Model tarafından %95 olasılıkla...",
        "severity": "CRITICAL",
        "detection_result_id": 5001,
        "assigned_analyst_id": null,
        "status": "OPEN",
        "created_at": "2026-08-08T15:25:00Z",
        "updated_at": "2026-08-08T15:25:00Z"
      }
    ]
    ```

#### **GET `/api/v1/incidents/{incident_id}`**
*   **Açıklama:** Güvenlik olayının detayını ve eklenmiş olan tüm yorumları (comments) listeler.
*   **Rol:** ALL
*   **Başarılı Yanıt (200 OK):**
    ```json
    {
      "id": 1,
      "title": "Şüpheli TCP Trafiği (Kayıt 145)",
      "description": "Model tarafından %95 olasılıkla...",
      "severity": "CRITICAL",
      "detection_result_id": 5001,
      "assigned_analyst_id": null,
      "status": "OPEN",
      "created_at": "2026-08-08T15:25:00Z",
      "updated_at": "2026-08-08T15:25:00Z",
      "comments": []
    }
    ```

#### **PATCH `/api/v1/incidents/{incident_id}`**
*   **Açıklama:** Olayın durumunu (`status`) günceller veya atamasını (`assigned_analyst_id`) yapar.
*   **Rol:** ALL
*   **İstek Gövdesi:**
    ```json
    {
      "status": "IN_PROGRESS",
      "assigned_analyst_id": 2
    }
    ```
*   **Başarılı Yanıt (200 OK):**
    ```json
    {
      "id": 1,
      "title": "Şüpheli TCP Trafiği (Kayıt 145)",
      "description": "Model tarafından %95 olasılıkla...",
      "severity": "CRITICAL",
      "detection_result_id": 5001,
      "assigned_analyst_id": 2,
      "status": "IN_PROGRESS",
      "created_at": "2026-08-08T15:25:00Z",
      "updated_at": "2026-08-08T15:26:00Z"
    }
    ```

#### **POST `/api/v1/incidents/{incident_id}/comments`**
*   **Açıklama:** Olayın altına analiz notu/yorum ekler.
*   **Rol:** ALL
*   **İstek Gövdesi:**
    ```json
    {
      "comment_text": "Kayıt üzerinde inceleme yapıldı. Aksiyon alındı."
    }
    ```
*   **Başarılı Yanıt (201 Created):**
    ```json
    {
      "id": 1,
      "incident_id": 1,
      "user_id": 2,
      "comment_text": "Kayıt üzerinde inceleme yapıldı. Aksiyon alındı.",
      "created_at": "2026-08-08T15:28:00Z"
    }
    ```

### 3.7. Dashboard

#### **GET `/api/v1/dashboard/summary`**
*   **Açıklama:** Dashboard panelinde kullanılmak üzere sistemdeki analiz, tespit ve olay (incident) özet verilerini tek potada döndürür.
*   **Rol:** ALL
*   **Başarılı Yanıt (200 OK):**
    ```json
    {
      "generated_at": "2026-08-08T15:30:00Z",
      "analysis_summary": {
        "total_jobs": 1,
        "status_distribution": {
          "COMPLETED": 1
        },
        "completed_jobs": 1
      },
      "detection_summary": {
        "total_detections": 5000,
        "benign_count": 4800,
        "attack_count": 200
      },
      "detection_class_distribution": {
        "benign": 4800,
        "attack": 200
      },
      "risk_distribution": {
        "LOW": 4800,
        "MEDIUM": 50,
        "HIGH": 100,
        "CRITICAL": 50
      },
      "incident_summary": {
        "total_incidents": 1,
        "status_distribution": {
          "IN_PROGRESS": 1
        },
        "severity_distribution": {
          "CRITICAL": 1
        }
      },
      "trend_7_days": [
        {
          "date": "2026-08-08",
          "total": 5000,
          "benign": 4800,
          "attack": 200
        }
      ],
      "recent_detections": [],
      "recent_incidents": []
    }
    ```

---

## 4. Hata Kodları ve Hata Yanıt Şeması (Exceptions)

Platform, bir hata durumunda istemciye standart olarak aşağıdaki formatta yanıt döner:
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Analysis job not found.",
    "details": null
  }
}
```

*Doğrulama (Validation) Hatalarında (`422`):*
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "loc": ["body", "password"],
        "msg": "String should have at least 8 characters",
        "type": "string_too_short"
      }
    ]
  }
}
```

### Standart Hata Kodları Tablosu

| HTTP Durumu | Hata Kodu (`code`) | Açıklama |
| :--- | :--- | :--- |
| **400 Bad Request** | `DUPLICATE_USERNAME` | Belirtilen kullanıcı adı sistemde zaten kayıtlı. |
| **400 Bad Request** | `DUPLICATE_EMAIL` | Belirtilen e-posta adresi sistemde zaten kayıtlı. |
| **400 Bad Request** | `DUPLICATE_FILE` | Aynı SHA-256 hash değerine sahip bir dosya daha önce yüklenmiş. |
| **401 Unauthorized** | `CREDENTIALS_INVALID` | Yanlış kullanıcı adı veya parola girildi. |
| **401 Unauthorized** | `TOKEN_EXPIRED` | JWT oturum token'ının süresi dolmuş. |
| **401 Unauthorized** | `TOKEN_INVALID` | JWT token doğrulanamadı veya formatı geçersiz. |
| **403 Forbidden** | `PERMISSION_DENIED` | Kullanıcının bu işlemi gerçekleştirmek için yetkisi (rolü) yetersiz. |
| **404 Not Found** | `NOT_FOUND` | İstenilen kaynak bulunamadı veya kullanıcı bu kaynağa erişim yetkisine sahip değil. |
| **413 Payload Too Large** | `FILE_TOO_LARGE` | Yüklenecek dosya sunucu tarafından izin verilen maksimum boyutu aşıyor. |
| **422 Unprocessable** | `VALIDATION_ERROR` | İstek gövdesi (JSON) veya Query parametreleri Pydantic doğrulamalarından geçemedi. |
| **422 Unprocessable** | `SCHEMA_MISMATCH` | Yüklenen CSV dosyasının sütunları veya yapısı CIC-IDS2017 şemasıyla eşleşmiyor. |
| **500 Internal Error** | `INTERNAL_SERVER_ERROR` | Beklenmeyen bir sunucu veya veritabanı (SQLAlchemy) hatası oluştu. |

---

## 5. Kapsam ve Sınırlar

- **Sınır:** API sadece CSV tabanlı toplu veri analizine (Batch Inference) hizmet eder.
- **Dışında:** Gerçek zamanlı trafik yakalama (Packet Capture/Sniffing), IPS/Firewall otomasyonu, Celery/Redis gibi dış iş kuyrukları ve Production Cloud ortamlarında Deployment süreçleri bu sürümün kapsamı dışındadır.
