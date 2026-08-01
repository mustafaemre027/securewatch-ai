# SecureWatch AI — Frontend

SecureWatch AI platformunun React, TypeScript, Vite ve Tailwind CSS tabanlı kullanıcı arayüzü ve istemci mimarisi.

## Genel Bakış

Frontend katmanı; güvenlik analistleri ve sistem yöneticileri için modern, responsive, erişilebilir ve yüksek performanslı bir karar destek arayüzü sunar. Güvenli bellek içi oturum yönetimi, tip güvenli API istemcisi, korumalı rota korumaları ve marka kimliğine uygun tasarım sistemi içerir.

## Ön Gereksinimler

- **Node.js:** `^20.19.0 || >=22.12.0` (Vite 8 package metadata gereksinimi; yerel ortam `v24.18.1` ile doğrulanmıştır)
- **npm:** 9.0.0 veya üzeri
- **İşletim Sistemi:** Windows, macOS veya Linux

## Kurulum

Bağımlılıkları yüklemek için `frontend` dizininde aşağıdaki komutu çalıştırın:

```bash
npm install
```

*(Windows PowerShell execution policy kısıtlamaları olan ortamlarda `npm.cmd install` komutu kullanılabilir).*

## Geliştirme Sunucusu

Geliştirme sunucusunu (Vite HMR destekli) başlatmak için:

```bash
npm run dev
```

Varsayılan geliştirme sunucusu adresi: `http://localhost:5173/`

## Kullanılabilir Komutlar (Scripts)

`package.json` içerisinde tanımlı doğrulama ve çalıştırma komutları:

| Komut | Açıklama |
|-------|----------|
| `npm run dev` | Vite geliştirme sunucusunu (HMR) başlatır. |
| `npm run build` | TypeScript tip kontrolü (`tsc -b`) sonrasında production çıktısını `dist/` klasörüne derler. |
| `npm run preview` | Derlenmiş production çıktısını yerel preview sunucusunda (`127.0.0.1:4173`) çalıştırır. |
| `npm run lint` | ESLint ile tüm kod tabanında statik kod analizi yapar. |
| `npm run type-check` | TypeScript tip kontrolünü (`tsc --noEmit`) çalıştırır. |
| `npm run test` | Vitest ile birim (unit) ve bileşen testlerini çalıştırır. |

## Rota (Routing) Mimarisi

React Router (`react-router`) tabanlı declarative rota yönetimi uygulanmıştır:

- `/login`: Kimlik doğrulama sayfası (`PublicOnlyRoute` ile korumalıdır; oturum açmış kullanıcıları ana sayfaya yönlendirir).
- `/`: Korumalı uygulama kabuğu ve başlangıç ana ekranı (`ProtectedRoute` ile korumalıdır; oturum açmamış kullanıcıları `/login` sayfasına yönlendirir).
- `/analysis`: Analiz yönetimi, CSV yükleme ve yürütme paneli (`ProtectedRoute` ile korumalıdır; oturum açmamış kullanıcıları `/login` sayfasına yönlendirir).
- **Wildcard (`*`):** Bilinmeyen rotalar güvenli şekilde `/login` hedefine yönlendirilir.
- **Güvenli Yönlendirme (Safe Redirect):** Oturum açtıktan sonra `state.from` üzerinden yönlendirme yapılırken yalnızca dahili (internal) göreli yollara izin verilir; harici protokol ve domain yönlendirmeleri reddedilir.

## Analiz Ekranları İş Akışı ve Kullanıcı Deneyimi

`/analysis` rotası üzerinde aşağıdaki kullanıcı adımları gerçekleştirilir:

1. **Güvenli Oturum:** `ANALYST` rolündeki kullanıcı oturum açarak `/analysis` ekranına erişir.
2. **Dosya Seçimi / Sürükle-Bırak:** Kullanıcı CIC-IDS2017 formatındaki bir `.csv` dosyasını sürükleyip bırakır veya dosya seçici ile seçer.
3. **İstemci Tarafı Ön Doğrulama:** Dosya uzantısı (`.csv`), boş dosya kontrolü (0 byte) ve maksimum 50 MB boyutu istemci tarafında denetlenir.
4. **Backend Yükleme:** Dosya `multipart/form-data` biçiminde (`file` alanı) `POST /api/v1/analysis/upload` ucuna gönderilir.
5. **Yürütme Paneli:** Başarılı yükleme sonrası dönen `job_id` ile analiz yürütme paneli açılır.
6. **Manuel Analiz Başlatma:** Kullanıcı *"Doğrulanmış Analizi Başlat"* butonuna basarak `POST /api/v1/analysis/{job_id}/process` isteği gönderir.
7. **Sonuç Gösterimi ve Yenileme:** İşlem sonucu (`COMPLETED` veya `FAILED`) ve işlenen kayıt sayısı ekranda gösterilir; analiz geçmişi listesi otomatik yenilenir.
8. **Yeni Yükleme:** İşlem sonrasında kullanıcı isteğe bağlı olarak yeni bir CSV yükleme akışına dönebilir.

## Gerçek API Sözleşmeleri

Backend ile iletişim kuran uç noktalar:

- `POST /api/v1/analysis/upload`: `multipart/form-data` kabul eder. Başarılı yanıtta `AnalysisUploadResponse` (`job_id`, `file_name`, `file_hash`, `file_size`, `status`, `created_at`) döner.
- `POST /api/v1/analysis/{job_id}/process`: Yüklenmiş bir analiz işini senkron olarak çalıştırır. `AnalysisProcessingResponse` (`job_id`, `final_status`, `records_processed`) döner.
- `GET /api/v1/analysis`: Analiz işlerini listeler.
  - **Sorgu Parametreleri:** `status` (opsiyonel filtre), `skip` (varsayılan 0), `limit` (varsayılan 20, en fazla 100).
  - **Liste Yapısı:** Yanıt sahte bir `total` veya sayfalama sarmalayıcısı içermez; doğrudan `AnalysisJobListItem[]` dizisi döndürür.
- `GET /api/v1/analysis/{job_id}`: Belirli bir analiz işinin detayını getirir.

## Rol ve Yetkilendirme (RBAC) Davranışları

- **ANALYST Rolü:** CSV dosyası yükleyebilir, analiz işlerini başlatabilir ve yalnızca kendi oluşturduğu analiz işlerini listeleyebilir/görüntüleyebilir.
- **ADMIN Rolü:** Tüm analiz işlerini listeleyebilir ve görüntüleyebilir. ADMIN kullanıcılara arayüz seviyesinde CSV yükleme formu gösterilmez.
- **Güvenlik Katmanı:** Frontend rol denetimleri yalnızca kullanıcı deneyimi katmanındadır; kesin yetkilendirme ve sahiplik kontrolleri backend RBAC tarafından uygulanır. Oturum açmamış kullanıcılar `/analysis` içeriğini göremez.

## Güvenlik ve Hata Yönetimi İlkeleri

- **Bellek İçi (In-Memory) State:** Access token yalnızca React `AuthProvider` bellek durumunda saklanır. `localStorage`, `sessionStorage`, `IndexedDB` veya `cookie` içine kaydedilmez.
- **Teknik Hata Maskeleme:** Backend'den dönen teknik detaylar, dosya yolları, stack trace, model yolu, hash veya token bilgisi DOM'a veya kullanıcı arayüzüne yazılmaz.
- **Güvenli Hata Eşlemeleri:**
  - `err.status === 404` & `err.code === 'MODEL_NOT_FOUND'` → `"Analiz modeli şu anda kullanılamıyor. Lütfen daha sonra tekrar deneyin."`
  - `err.status === 400` & `err.code === 'DUPLICATE_FILE'` veya `err.status === 409` → `"Bu CSV dosyası daha önce yüklenmiş."`
  - Diğer 400/422 → `"CSV dosyası doğrulanamadı. Dosya biçimini kontrol edin."`
  - 401 → `"Oturumunuz geçersiz. Lütfen yeniden giriş yapın."`
  - 403 → `"Bu işlem için yetkiniz bulunmuyor."`
  - 5xx / 0 → `"Sunucuya şu anda ulaşılamıyor. Lütfen daha sonra tekrar deneyin."`
- **Eşzamanlılık ve Temizlik:** Devam eden istekler bileşen unmount olduğunda `AbortController` ile iptal edilir. Duplicate-submit (mükerrer tıklama) engellenir; unmount sonrası state güncellemeleri önlenir (`isMountedRef`).

## Erişilebilirlik ve Responsive Tasarım

- **Semantik HTML:** `<h2>`, `<form>`, `<label>`, `<button>`, `<ul>` yapıları.
- **ARIA Bölgeleri:** Hata mesajlarında `role="alert"`, durum güncellemelerinde `role="status"`, `aria-live="polite"`, `aria-busy` alanları.
- **Klavye Erişilebilirliği:** Dosya seçimi ve butonlar klavye odaklanabilirdir (`focus-visible`).
- **Görsel Tasarım:** Durumlar (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`) yalnızca renk ile anlatılmaz; durum metinleri ve ikonlarla desteklenir.
- **Responsive Uyum:** Masaüstü, tablet ve 320px mobil ekran genişliklerine kadar uyumlu esnek düzen (`Flexbox` / `Grid`).

## Test ve Kalite Standartları

Frontend altyapısı aşağıdaki test ve kalite araçlarıyla korunmaktadır:

- **Vitest & React Testing Library:** İzolasyonlu bileşen, hook, API ve rota testleri (14 test dosyasında 141 başarılı test).
- **Hata ve İptal Testleri:** `AbortError` durumunun yutulması, duplicate submit engellemesi, model ve mükerrer yükleme hata maskeleme testleri.

## Mevcut Kapsam Sınırları

Bu aşamada (Gün 14 itibarıyla) geliştirilen ve doğrulanan bileşenler:
- [x] Responsive Login ekranı ve marka bileşenleri
- [x] Bellek içi AuthProvider ve AuthContext altyapısı
- [x] React Router declarative guard sistemi (`ProtectedRoute`, `PublicOnlyRoute`)
- [x] Responsive AppLayout uygulama kabuğu ve HomePage
- [x] CSV Yükleme bileşeni (`CsvUploadForm`) ve ön doğrulamaları
- [x] Analiz yürütme paneli (`AnalysisExecutionPanel`)
- [x] Analiz geçmişi listesi (`AnalysisHistoryList`) ve filtrelenebilir `/analysis` ekranı
- [x] Güvenli `MODEL_NOT_FOUND` ve `DUPLICATE_FILE` hata eşlemeleri
- [x] ESLint, Vitest, TypeScript kalite ve test altyapısı

*Henüz geliştirilmeyen / kapsam dışı olan özellikler:*
- Kalıcı veya gerçek bir ML modeli üretimi / `.pkl` veya `.joblib` artefact eklenmesi (Model bulunamadığında güvenli mesaj verilir).
- Dashboard istatistik ve grafik bileşenleri.
- Olay yönetimi (Incident management) ve Detection Result detay ekranları.
- Bildirim sistemi (Notification UI).
- Celery / Redis arka plan görev entegrasyonu.
