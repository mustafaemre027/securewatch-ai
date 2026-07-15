# Görsel Varlıklar (Visual Assets)

Bu dizin, SecureWatch AI projesine ait tüm görsel ve marka kimliği varlıklarını barındırır.

## Dizin Yapısı

```
docs/assets/
├── README.md
├── brand/          # Marka kimliği ve logo varlıkları
├── mockups/        # Kullanıcı arayüzü (UI) taslakları (mockup'lar)
└── screenshots/    # Tamamlanan gerçek uygulama ekran görüntüleri
```

---

## 1. Marka Kimliği (Brand Assets)

Projenin kurumsal kimliği ve tasarım diliyle ilişkili görsel varlıklar `docs/assets/brand/` dizininde saklanmaktadır. Detaylı bilgi için [brand/README.md](brand/README.md) dosyasını inceleyebilirsiniz.

*   **Ana Logo ([securewatch-ai-logo.svg](brand/securewatch-ai-logo.svg)):** Siber güvenlik (kalkan) ve yapay zekâ ağını simgeleyen grafik ile "SecureWatch AI" metnini içeren yatay ana logodur.
*   **Logo Simgesi ([securewatch-ai-mark.svg](brand/securewatch-ai-mark.svg)):** Logonun metinsiz, kare/yuvarlak alanlar (favicon, profil vb.) için optimize edilmiş simge versiyonudur.
*   **Renk Paleti Şeması ([color-palette.svg](brand/color-palette.svg)):** Tasarım sisteminde kullanılan ana renklerin dökümünü içeren şemadır.

---

## 2. Kullanıcı Arayüzü Mockup'ları (UI Mockups)

Uygulamanın tasarım aşamasında hedeflenen arayüzlerin 1440x900 çözünürlüğündeki SVG formatlı taslak çizimleri `docs/assets/mockups/` dizininde yer almaktadır.

*   **Giriş Ekranı ([login-screen.svg](mockups/login-screen.svg)):** Yetkilendirme ve RBAC girişi için e-posta, parola alanları ile güvenlik uyarısını içeren ekran tasarımı.
*   **Veri Yükleme Ekranı ([data-upload-screen.svg](mockups/data-upload-screen.svg)):** CSV formatında ağ trafik verilerinin yüklenmesi, şema doğrulaması ve analiz başlatma ekran tasarımı.
*   **Dashboard Genel Bakış ([dashboard-overview.svg](mockups/dashboard-overview.svg)):** Toplam trafik, şüpheli kayıt ve olay istatistiklerini gösteren metrik kartları ile pasta ve çizgi grafik taslaklarını barındıran özet ekran tasarımı.
*   **Tespit Sonuçları Ekranı ([detection-results.svg](mockups/detection-results.svg)):** Sınıflandırma ve risk skorlarına göre filtreleme yapılabilen detaylı ağ kayıtları tablosu ve olay dönüştürme eylemleri.
*   **Olay Yönetim Ekranı ([incident-management.svg](mockups/incident-management.svg)):** Güvenlik olaylarının listelendiği, seçilen olayın analiste atanması, durumunun değiştirilmesi ve yorum ekleme geçmişi arayüz tasarımı.

### Mockup ve Ekran Görüntüsü Farkı
> [!IMPORTANT]
> **Mockup (Taslak):** Arayüz geliştirmeye başlanmadan önce, hedeflenen tasarımı ve kullanıcı deneyimi akışını planlamak amacıyla hazırlanan **statik şemalardır**. Üzerlerinde açıkça *"UI Mockup — Uygulama Ekranı Değildir"* ibaresi bulunur.
> 
> **Ekran Görüntüsü (Screenshot):** Uygulama kodu geliştirilip çalışır hale geldikten sonra, çalışan gerçek tarayıcı üzerinden alınan **gerçek ekran görüntüleridir**.

---

## 3. Gerçek Ekran Görüntüleri (Screenshots)

Bu bölüm, geliştirme tamamlandıktan sonra çalışan uygulamadan alınan ekran görüntülerinin saklanacağı `docs/assets/screenshots/` dizinini temsil eder.

> [!NOTE]
> Bu dizinde yer alacak gerçek ekran görüntüleri (örneğin ana kontrol paneli, analiz sonuçları ve olay yönetimi pencereleri), uygulamadaki özellikler **aktif olarak geliştirildikten sonra kullanıcı tarafından** alınarak bu dizine eklenecektir. Şu anda geliştirme aşamasında olunduğu için herhangi bir sahte/temsili ekran görüntüsü eklenmemiştir ve bağlantı verilmemiştir.
