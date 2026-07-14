# SecureWatch AI – Uygulama Planı

## Genel Bakış

SecureWatch AI, ağ trafiği analizi ve saldırı tespiti için makine öğrenmesi yöntemleri kullanan web tabanlı bir karar destek platformudur. Bu belge, MVP teslimi için gereken tüm aşamaları ve kilometre taşlarını tanımlar.

## Aşama Yapısı

Proje 9 aşamaya ayrılmıştır. Her aşama bir öncekine bağımlı olduğu için sıralı olarak tamamlanmalıdır.

| Aşama | Başlık | Planlanan Gün |
|-------|--------|---------------|
| Aşama 0 | Proje Yönetimi ve Dokümantasyon | Gün 1 |
| Aşama 1 | Veri Analizi ve Sistem Mimarisi | Gün 2–3 |
| Aşama 2 | Backend, Veritabanı ve Yetkilendirme | Gün 4–6 |
| Aşama 3 | Veri İşleme ve Makine Öğrenmesi | Gün 7–10 |
| Aşama 4 | Analiz, Tespit ve Olay Yönetimi | Gün 11–12 |
| Aşama 5 | Frontend ve Kullanıcı Deneyimi | Gün 13–16 |
| Aşama 6 | Dashboard ve Raporlama | Gün 17 |
| Aşama 7 | Test, Güvenlik ve Entegrasyon | Gün 18 |
| Aşama 8 | Docker, Dokümantasyon ve Final Teslimi | Gün 19–20 |

---

## Aşama 0 – Proje Yönetimi ve Dokümantasyon (Gün 1)

- Repository incelemesi ve proje kapsamının kesinleştirilmesi
- GitHub Project board yapılandırması
- Parent ve sub-issue backlog oluşturma
- Branch, commit ve PR standartlarının belirlenmesi
- README.md başlangıcı
- implementation_plan.md oluşturma
- Issue ve PR şablonları
- CONTRIBUTING.md oluşturma

**Teslim Çıktısı:** Proje backlog'u, GitHub çalışma sistemi ve başlangıç dokümantasyonu.

---

## Aşama 1 – Veri Analizi ve Sistem Mimarisi (Gün 2–3)

- UNSW-NB15 veri seti kaynağının incelenmesi
- Train/test CSV dosyalarının analizi
- Sütun ve hedef değişken incelemesi
- Sınıf dağılımı analizi
- Küçük geliştirme örneklemi oluşturma
- Fonksiyonel gereksinimlerin belirlenmesi
- Kullanıcı senaryolarının dokümantasyonu
- ER diyagramı
- Durum makinelerinin tanımlanması
- Katmanlı mimari tasarımı
- API endpoint taslağı
- ML eğitim ve inference akışı

**Teslim Çıktısı:** Veri seti analiz raporu, sütun sözlüğü, ER diyagramı, mimari diyagram ve API planı.

> **Teknik kontrol noktası:** Veri okunamıyorsa veya şema beklenenden farklıysa sonraki aşamaya geçmeden sorun çözülmelidir.

---

## Aşama 2 – Backend, Veritabanı ve Yetkilendirme (Gün 4–6)

### Backend Temeli (Gün 4)
- FastAPI proje yapısı
- Ayar yönetimi (settings)
- PostgreSQL bağlantısı
- SQLAlchemy model yapılandırması
- Alembic migration kurulumu
- Merkezi hata yönetimi
- Health endpoint
- Backend başlangıç testleri

### Kimlik Doğrulama ve RBAC (Gün 5–6)
- User veritabanı modeli
- İlk migration
- Parola hashleme (bcrypt)
- JWT token oluşturma ve doğrulama
- Login endpoint
- Admin/analyst rol izinleri
- Kimlik doğrulama testleri
- Temel audit log

**Teslim Çıktısı:** PostgreSQL bağlantılı ve rol tabanlı yetkilendirmeye sahip çalışan backend.

---

## Aşama 3 – Veri İşleme ve Makine Öğrenmesi (Gün 7–10)

### CSV Yükleme (Gün 7)
- AnalysisJob modeli
- Dosya storage servisi
- CSV upload endpoint
- MIME/uzantı/boyut doğrulaması
- Dosya hash tekrar kontrolü
- Şema doğrulama
- Analiz durumu takibi
- Upload testleri

### Ön İşleme Pipeline'ı (Gün 8)
- Sayısal ve kategorik sütun ayrımı
- Eksik değer yönetimi
- Kategorik alanlar için OneHotEncoder
- Ölçeklendirme (gerekirse)
- ColumnTransformer yapılandırması
- Scikit-learn Pipeline
- Veri sızıntısı önleme
- Ön işleme testleri

### Baseline Model (Gün 9)
- DummyClassifier baseline
- Logistic Regression eğitimi
- Sınıf ağırlık yönetimi
- Eğitim scripti
- İlk tahminler
- Accuracy, precision, recall, F1 raporu
- Confusion matrix
- İlk model raporu

### Random Forest (Gün 10)
- Random Forest pipeline
- Kontrollü parametre denemeleri
- Eğitim süresi ölçümü
- Feature importance çıkarımı
- Logistic Regression ile karşılaştırma
- Model testleri

**Teslim Çıktısı:** Eğitilmiş modeller, değerlendirme metrikleri ve model kartı ile eksiksiz ML pipeline'ı.

---

## Aşama 4 – Analiz, Tespit ve Olay Yönetimi (Gün 11–12)

### Inference API (Gün 11)
- Model yükleme servisi
- Tahmin servisi
- Analysis job işleme
- DetectionResult modeli
- Risk seviyesi hesaplama
- Örnek tahmin endpoint'leri
- Inference testleri
- Analiz özet toplulaştırması

### Olay Yönetimi (Gün 12)
- Incident modeli
- Incident comment modeli
- Tespitten olaya dönüştürme
- Analiste atama
- Durum geçişleri (OPEN, IN_PROGRESS, RESOLVED, FALSE_POSITIVE)
- Olay notları
- Olaylar için audit log
- Incident testleri

**Teslim Çıktısı:** Çalışan inference API ve olay yönetimi backend'i.

---

## Aşama 5 – Frontend ve Kullanıcı Deneyimi (Gün 13–16)

### Frontend Temeli (Gün 13)
- React + TypeScript + Vite kurulumu
- Tailwind CSS yapılandırması
- React Router kurulumu
- API client servisi
- Kimlik doğrulama state yönetimi
- Login sayfası
- Korumalı route'lar
- Responsive layout

### Analiz Ekranları (Gün 14)
- CSV yükleme formu
- Dosya doğrulama mesajları
- Analiz başlatma
- Analiz durumu takibi
- Loading ve error durumları
- Analiz geçmişi listesi
- API entegrasyonu

### Tespit Sonuçları (Gün 15)
- Tespit listesi görünümü
- Risk seviyesi filtresi
- Tahmin filtresi
- Sayfalama
- Tespit detay sayfası
- Model güven skoru gösterimi
- Feature importance gösterimi
- Olaya dönüştürme aksiyonu

### Olay Yönetimi Arayüzü (Gün 16)
- Olay listesi görünümü
- Olay detay görünümü
- Analiste atama
- Durum değiştirme kontrolleri
- Yorum/not ekleme
- Olay geçmişi
- Yetki kontrolleri

**Teslim Çıktısı:** Gerekli tüm kullanıcı arayüzlerine sahip eksiksiz frontend.

---

## Aşama 6 – Dashboard ve Raporlama (Gün 17)

- Dashboard özet servisleri
- Özet kartlar (toplam analiz, trafik kaydı, normal/şüpheli sayıları)
- Normal/saldırı dağılım grafiği
- Risk seviyesi dağılım grafiği
- Protokol dağılım grafiği
- Zamana göre tespit eğilim grafiği
- Model performans kartları
- Son tespitler ve olaylar listesi
- Responsive grafikler (Recharts)

**Teslim Çıktısı:** Gerçek backend verileriyle çalışan görsel dashboard.

---

## Aşama 7 – Test, Güvenlik ve Entegrasyon (Gün 18)

- Backend entegrasyon testleri
- Frontend component testleri
- RBAC senaryo testleri
- Geçersiz CSV testleri
- Yetkisiz erişim testleri
- Dosya güvenliği doğrulaması
- Backend lint (pylint/flake8)
- Frontend lint (ESLint)
- TypeScript type-check
- Responsive tasarım doğrulaması
- Hata düzeltmeleri

**Teslim Çıktısı:** Test edilmiş ve güvenlik kontrolleri yapılmış uygulama.

---

## Aşama 8 – Docker, Dokümantasyon ve Final Teslimi (Gün 19–20)

- Backend Dockerfile
- Frontend Dockerfile
- Docker Compose (PostgreSQL volume dahil)
- Environment örneği (.env.example)
- Seed/demo kullanıcıları
- Küçük demo CSV dosyası
- README.md güncellemesi
- API dokümantasyonu
- Mimari ve ER diyagramları
- Model değerlendirme tablosu
- Final ekran görüntüleri
- Final Pull Request

**Teslim Çıktısı:** Konteynerize edilmiş, belgelenmiş ve incelemeye hazır proje.

---

## MVP Kapsamı

### Zorunlu Özellikler
- JWT ile kullanıcı kimlik doğrulama
- Rol tabanlı erişim kontrolü (admin, analyst)
- CSV dosya yükleme ve doğrulama
- Veri ön işleme pipeline'ı (scikit-learn)
- ML modelleri: DummyClassifier, Logistic Regression, Random Forest
- Model karşılaştırması: accuracy, precision, recall, F1, ROC-AUC
- Risk skorlaması (LOW, MEDIUM, HIGH, CRITICAL)
- Tespitten olaya dönüştürme
- Olay durum yönetimi ve audit log
- Gerçek backend verileriyle dashboard

### Zaman Kalırsa
- Çok sınıflı saldırı türü tahmini
- HistGradientBoostingClassifier
- Isolation Forest ile anomali tespiti
- Feature importance görselleştirmesi
- Gelişmiş model karşılaştırma ekranı
- CSV/PDF rapor dışa aktarma
- Gelişmiş filtreleme
- Model sürüm geçmişi
- Bildirim sistemi

### Kapsam Dışı
- Canlı ağ dinleme
- PCAP dosyası işleme
- Wireshark entegrasyonu
- Port tarama veya Nmap entegrasyonu
- Saldırı üretme
- Exploit geliştirme
- Güvenlik duvarı yönetimi
- Otomatik IP engelleme
- Gerçek zamanlı IDS/IPS
- SIEM entegrasyonu
- Mikroservis mimarisi
- Kubernetes dağıtımı
- Mobil uygulama
- Derin öğrenme modelleri
- Çoklu kiracılık (multi-tenancy)

---

## Başlangıç Risk Eşikleri

Aşağıdaki eşikler, geliştirme öncesi belirlenmiş **başlangıç (provisional)** değerlerdir.

| Risk Seviyesi | Olasılık Aralığı | Açıklama |
|---------------|------------------|----------|
| DÜŞÜK (LOW) | 0.00 – 0.30 | Normal trafik, işlem gerekmez |
| ORTA (MEDIUM) | 0.31 – 0.60 | Şüpheli, inceleme önerilir |
| YÜKSEK (HIGH) | 0.61 – 0.85 | Olası saldırı, acil inceleme gerekli |
| KRİTİK (CRITICAL) | 0.86 – 1.00 | Kesin saldırı tespiti, olaya dönüştür |

**Kesin eşikler, Gün 10'da gerçek model sonuçları, precision-recall analizi ve false-positive oranı değerlendirmesi sonucunda belirlenecektir.** Bu başlangıç değerleri, model eğitimi tamamlandıktan sonra güncellenecektir.

---

## Tamamlanma Kriterleri

Bir görev yalnızca şu koşullarda tamamlanmış kabul edilir:

- [ ] Kabul kriterleri karşılanmıştır
- [ ] Kod doğru mimari katmandadır
- [ ] İlgili testler yazılmış ve başarılıdır
- [ ] Lint ve type-check başarılıdır
- [ ] Güvenlik ve RBAC kontrol edilmiştir
- [ ] Migration gerekiyorsa oluşturulmuştur
- [ ] Dokümantasyon güncellenmiştir
- [ ] UI değişikliği varsa ekran görüntüsü eklenmiştir
- [ ] ML değişikliği varsa metrikler paylaşılmıştır
- [ ] Küçük ve anlamlı commitler oluşturulmuştur
- [ ] Branch Issue ile ilişkilidir
- [ ] Pull Request açılmıştır
- [ ] Project durumu Review yapılmıştır
- [ ] İncelemeci değerlendirmesine hazırdır