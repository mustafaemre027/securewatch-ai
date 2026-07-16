# SecureWatch AI — Kullanıcı Senaryoları (User Scenarios)

Bu belge, SecureWatch AI platformunun iki ana aktörü olan Yönetici (Admin) ve Güvenlik Analisti (Security Analyst) rollerine ait iş akışlarını ve kritik kullanım senaryolarını detaylandırır.

## 1. Giriş
Kullanıcı senaryoları, platformun fonksiyonel gereksinimlerinin kullanıcı gözünden nasıl işletildiğini gösterir. Bu senaryolar, arayüz tasarımları ve backend servis akışları için temel oluşturur.

## 2. Kullanıcı Rolleri ve Genel Yetkiler

| Rol | Genel Açıklama | Temel Yetkiler |
| :--- | :--- | :--- |
| **Yönetici (Admin)** | Platformun idari işlerinden, kullanıcı yönetiminden ve sistemin denetiminden sorumlu roldür. | Kullanıcı yönetimi, audit log inceleme, güvenlik olaylarını belirli bir analiste atama. |
| **Güvenlik Analisti (Analyst)** | Ağ trafiği verilerini sisteme yükleyen, model sonuçlarını inceleyen ve tehditlere karşı olay yönetim süreçlerini yürüten teknik roldür. | CSV dosyası yükleme, analiz başlatma, tespit edilen tehditleri ve risk seviyelerini inceleme, olay oluşturma, olay durumunu güncelleme (`RESOLVED`, `FALSE_POSITIVE`), yorum yazma. |

---

## 3. Yönetici (Admin) Kullanıcı Senaryoları

### Senaryo A: Yeni Analist Hesabı Oluşturma ve Rol Yetkilendirme
*   **Amaç:** Ekibe katılan yeni bir siber güvenlik uzmanının platforma erişimini sağlamak.
*   **Aktör:** Yönetici (Admin)
*   **Ön Koşullar:** Yönetici sisteme giriş yapmış olmalıdır.
*   **Adımlar:**
    1. Admin, sol menüden "Kullanıcı Yönetimi" sayfasına girer.
    2. "Yeni Kullanıcı Ekle" butonuna basar.
    3. Kullanıcının adını, e-posta adresini ve geçici parolasını girer.
    4. Rol alanından `Analyst` seçeneğini seçer ve "Kaydet" butonuna tıklar.
    5. Sistem, girilen bilgileri doğrular, parolayı hashler ve yeni kullanıcıyı kaydeder.
    6. Yapılan bu işlem arka planda audit log tablosuna "Kullanıcı Oluşturuldu: [Username] (Role: Analyst)" açıklamasıyla kaydedilir.
*   **İlişkili Gereksinimler:** `FR-URB-002`, `FR-URB-004`, `FR-AUD-001`

### Senaryo B: Sistem Audit Log İnceleme ve Güvenlik Denetimi
*   **Amaç:** Sistemdeki eylemlerin izlenebilirliğini denetlemek ve geçmiş işlemleri incelemek.
*   **Aktör:** Yönetici (Admin)
*   **Ön Koşullar:** Admin sisteme giriş yapmış olmalıdır.
*   **Adımlar:**
    1. Admin, ana menüden "Sistem Günlükleri (Audit Logs)" sekmesine tıklar.
    2. Sayfada en son gerçekleştirilen işlemler zaman damgası, kullanıcı, eylem türü ve istemci IP adresi bilgileriyle listelenir.
    3. Admin, filtreleme alanını kullanarak belirli bir kullanıcının (örneğin bir analistin) eylemlerini listeler.
    4. Logların salt okunur olduğunu ve herhangi bir silme veya düzenleme seçeneğinin bulunmadığını doğrular.
*   **İlişkili Gereksinimler:** `FR-AUD-002`, `FR-AUD-004`

### Senaryo C: Çözülmemiş Olayları Belirli Bir Analiste Atama
*   **Amaç:** Boşta duran veya durumu `OPEN` olan bir güvenlik olayını çözmesi için belirli bir güvenlik analistine yönlendirmek.
*   **Aktör:** Yönetici (Admin)
*   **Ön Koşullar:** Sistemde çözülmemiş (`OPEN` veya `IN_PROGRESS`) bir olay ve aktif bir analist hesabı bulunmalıdır.
*   **Adımlar:**
    1. Admin, "Güvenlik Olayları" dashboard sayfasına girer.
    2. Durumu `OPEN` olan ve henüz kimseye atanmamış bir olay seçer.
    3. Detay sayfasında "Analiste Ata" açılır menüsünü açar.
    4. Ekipten uygun olan güvenlik analistini seçerek "Güncelle" butonuna tıklar.
    5. Sistem olayın durumunu korur veya `IN_PROGRESS` yapar ve `assigned_analyst_id` alanını günceller.
    6. Bu atama işlemi audit log kaydı olarak sisteme eklenir.
*   **İlişkili Gereksinimler:** `FR-INC-003`, `FR-AUD-001`

---

## 4. Güvenlik Analisti (Security Analyst) Kullanıcı Senaryoları

### Senaryo A: Ağ Trafiği Inference CSV Dosyası Yükleme ve Analiz Başlatma
*   **Amaç:** Kullanıcıya ait ağ trafiği kayıtlarını içeren inference CSV dosyasını makine öğrenmesi modeliyle analiz etmek üzere sisteme göndermek (bu dosya, model eğitimi için kullanılan 8 resmî MachineLearningCSV dosyasından bağımsızdır).
*   **Aktör:** Güvenlik Analisti (Security Analyst)
*   **Ön Koşullar:** Analist sisteme giriş yapmış olmalı ve elinde CIC-IDS2017 şemasına uygun, yapılandırılmış limitlerin altındaki bir inference CSV dosyası bulunmalıdır.
*   **Adımlar:**
    1. Analist, "Yeni Analiz" sayfasına girer.
    2. Sürükle-bırak alanına ağ trafiği inference CSV dosyasını ekler.
    3. Sistem istemci tarafında dosya uzantısını (`.csv`) ve settings üzerinden tanımlanan dosya boyut limitini kontrol eder.
    4. Analist "Analizi Başlat" butonuna tıklar.
    5. Backend tarafında dosya yüklenir, SHA-256 hash değeri kontrol edilir (aynı dosya önceden yüklendiyse reddedilir) ve sütun isimleri doğrulanır.
    6. Doğrulama başarılıysa sistem veritabanında `PENDING` durumunda bir `AnalysisJob` oluşturur ve arka planda analiz işlemini başlatarak durumu `PROCESSING` yapar.
    7. Analist arayüzdeki ilerleme çubuğundan analiz durumunu izler.
*   **İlişkili Gereksinimler:** `FR-DUD-001`, `FR-DUD-002`, `FR-DUD-003`, `FR-DUD-004`, `FR-DUD-005`, `FR-DET-001`

### Senaryo B: Tehdit Analizi, Tespit Sonuçlarını İnceleme ve Yorum Ekleme
*   **Amaç:** Tamamlanan analiz sonucunda model tarafından yüksek riskli sınıflandırılan trafik akışlarını incelemek ve teknik yorum eklemek.
*   **Aktör:** Güvenlik Analisti (Security Analyst)
*   **Ön Koşullar:** En az bir analiz işi başarıyla tamamlanmış (`COMPLETED`) olmalıdır.
*   **Adımlar:**
    1. Analist, "Analiz Geçmişi" listesinden tamamlanmış bir işin üzerine tıklar.
    2. Sistem analisti tespit detayları sayfasına yönlendirir.
    3. Analist, modelin atadığı risk seviyelerini (`risk_level`), saldırı olasılığını (`attack_probability`) ve hedef port (`destination_port`) bilgilerini inceler.
    4. **Not:** Analist modelin belirlediği risk skorunu veya seviyesini doğrudan değiştiremez; yalnızca bu tespitlerin detaylarındaki 78 adet orijinal özelliğin snapshot'ını inceler.
    5. Analist, incelediği yüksek riskli bir tespit için "Yeni Güvenlik Olayı Oluştur" butonuna basar. Sistem bu tespiti referans alan `OPEN` durumunda yeni bir olay oluşturur.
    6. Analist olay altına analiz notlarını eklemek için "Yorum Ekle" kutusuna teknik açıklamasını ("Yüksek riskli şüpheli trafik akışı doğrulandı, hedef port 22.") yazar ve gönderir.
*   **İlişkili Gereksinimler:** `FR-DET-004`, `FR-INC-001`, `FR-INC-002`, `FR-INC-005`

### Senaryo C: Olay Yaşam Döngüsü Yönetimi
*   **Amaç:** Atanan veya kendi üzerine aldığı bir güvenlik olayına müdahale etmek ve durumu güncellemek.
*   **Aktör:** Güvenlik Analisti (Security Analyst)
*   **Ön Koşullar:** Analiste atanmış veya analist tarafından üstlenilmiş aktif bir güvenlik olayı (`IN_PROGRESS`) bulunmalıdır.
*   **Adımlar:**
    1. Analist, "Olaylarım" sekmesine tıklar ve üzerinde çalıştığı güvenlik olayını seçer.
    2. Olayın detaylarını ve bağlı tespit sonuçlarını inceler.
    3. Eğer saldırının gerçek bir tehdit oluşturduğunu doğrularsa ve sistem üzerinde gerekli mitigasyon adımlarını tamamladıysa olayın durumunu `RESOLVED` olarak günceller.
    4. Eğer tespitin modelin ürettiği bir yanlış alarm (false positive) olduğunu anlarsa durumunu `FALSE_POSITIVE` olarak günceller.
    5. Sistem bu durum geçişini kaydeder, olayın `updated_at` zamanını günceller ve denetim günlüğü olarak audit log tablosuna ekler.
*   **İlişkili Gereksinimler:** `FR-INC-004`, `FR-AUD-001`
