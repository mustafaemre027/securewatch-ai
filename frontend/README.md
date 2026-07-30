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
- **Wildcard (`*`):** Bilinmeyen rotalar güvenli şekilde `/login` hedefine yönlendirilir.
- **Güvenli Yönlendirme (Safe Redirect):** Oturum açtıktan sonra `state.from` üzerinden yönlendirme yapılırken yalnızca dahili (internal) göreli yollara izin verilir; harici protokol ve domain yönlendirmeleri reddedilir.

## Kimlik Doğrulama Modeli (Authentication)

- **Kimlik İstek Sözleşmesi:** Login isteği `username` ve `password` alanlarını kabul eder.
- **Bellek İçi (In-Memory) State:** Erişim token'ı (`access_token`) ve kullanıcı bilgisi yalnızca React `AuthProvider` bellek durumunda saklanır.
- **Sıfır Kalıcılık (Zero Persistence):** Token veya kullanıcı parolası kesinlikle `localStorage`, `sessionStorage`, `IndexedDB` veya `cookie` içine kaydedilmez. Sayfa yenilendiğinde oturum sıfırlanır.
- **Güvenli Çıkış (Logout):** Logout işlemi bellek durumundaki token ve kullanıcı bilgisini tamamen temizler.
- **RBAC İlkesi:** Kullanıcı rolleri (`ADMIN`, `ANALYST`) yalnızca istemci arayüzü görünümü içindir; nihai yetkilendirme kararları backend API katmanı tarafından verilir.

## API İstemcisi ve Development Proxy

- **Native Fetch:** API istekleri tip güvenli `apiClient` sarmalayıcısı üzerinden `fetch` ile yapılır.
- **Göreli Yollar:** Tüm istekler `/api/v1/...` bağıl yolları kullanır.
- **Development Proxy:** `vite.config.ts` içerisindeki proxy yapılandırması, yerel geliştirme sırasında `/api/v1` isteklerini `http://127.0.0.1:8000` adresine yönlendirir.

## Test ve Kalite Standartları

Frontend altyapısı aşağıdaki test ve kalite araçlarıyla korunmaktadır:

- **Vitest & React Testing Library:** İzolasyonlu bileşen, hook ve rota testleri.
- **Hata Yönetimi:** Ağ veya sunucu hatalarında (`502 Bad Gateway`, `5xx`, bağlantı kopması) teknik detaylar sızdırılmaz; kullanıcıya güvenli Türkçe servis mesajı gösterilir (`Sunucuya şu anda ulaşılamıyor. Lütfen daha sonra tekrar deneyin.`). `401` hatalarında ise kullanıcı adı mevcudiyetini açığa çıkarmayan genel mesaj verilir (`Kullanıcı adı veya parola hatalı.`).

## Mevcut Kapsam Sınırları

Bu aşamada geliştirilen ve doğrulanan bileşenler:
- [x] Responsive Login ekranı ve marka bileşenleri
- [x] Bellek içi AuthProvider ve AuthContext altyapısı
- [x] React Router declarative guard sistemi (`ProtectedRoute`, `PublicOnlyRoute`)
- [x] Responsive AppLayout uygulama kabuğu ve HomePage
- [x] ESLint, Vitest, TypeScript kalite ve test altyapısı

*Henüz geliştirilmeyen özellikler (Sonraki Aşamalar):* CSV yükleme ekranı, analiz sonuç tabloları, olay yönetimi arayüzü ve dashboard grafik bileşenleri.
