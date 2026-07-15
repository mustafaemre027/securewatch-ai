# SecureWatch AI – Uygulama Planı

## Genel Bakış

SecureWatch AI, ağ trafiği analizi ve saldırı tespiti için makine öğrenmesi yöntemleri kullanan web tabanlı bir karar destek platformudur. Bu belge, proje ekibine yönelik **geliştirici rehberi** olarak hazırlanmıştır; MVP teslimi için gereken tüm aşamaları, kilometre taşlarını, teknik kararları ve takım içi standartları tanımlar.

## Aşama Yapısı

Proje 9 aşamaya ayrılmıştır. Her aşama bir öncekine bağımlı olduğu için sıralı olarak tamamlanmalıdır.

| Faz | Başlık | Planlanan Gün |
|-----|--------|---------------|
| Faz 0 | Proje Yönetimi ve Dokümantasyon | Gün 1 |
| Faz 1 | Veri Analizi ve Sistem Mimarisi | Gün 2–3 |
| Faz 2 | Backend, Veritabanı ve Yetkilendirme | Gün 4–5 |
| Faz 3 | Veri İşleme ve Makine Öğrenmesi | Gün 6–10 |
| Faz 4 | Analiz, Tespit ve Olay Yönetimi | Gün 11–12 |
| Faz 5 | Frontend ve Kullanıcı Deneyimi | Gün 13–16 |
| Faz 6 | Dashboard ve Raporlama | Gün 17 |
| Faz 7 | Test, Güvenlik ve Entegrasyon | Gün 18 |
| Faz 8 | Docker, Dokümantasyon ve Final Teslimi | Gün 19–20 |

---

## Faz 0 – Proje Yönetimi ve Dokümantasyon (Gün 1)

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

## Faz 1 – Veri Analizi ve Sistem Mimarisi (Gün 2–3)

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

## Faz 2 – Backend, Veritabanı ve Yetkilendirme (Gün 4–5)

### Backend Temeli (Gün 4)
- FastAPI proje yapısı
- Ayar yönetimi (settings)
- PostgreSQL bağlantısı
- SQLAlchemy model yapılandırması
- Alembic migration kurulumu
- Merkezi hata yönetimi
- Health endpoint
- Backend başlangıç testleri

### Kimlik Doğrulama, RBAC ve Audit Log (Gün 5)
- User veritabanı modeli
- İlk migration
- Parola hashleme (bcrypt)
- JWT token oluşturma ve doğrulama
- Login endpoint
- Admin/analyst rol izinleri
- Kimlik doğrulama testleri
- Audit log yapısı ve entegrasyonu

**Teslim Çıktısı:** PostgreSQL bağlantılı ve rol tabanlı yetkilendirmeye sahip çalışan backend.

---

## Faz 3 – Veri İşleme ve Makine Öğrenmesi (Gün 6–10)

### CSV Yükleme (Gün 6)
- AnalysisJob modeli
- Dosya storage servisi
- CSV upload endpoint
- MIME/uzantı/boyut doğrulaması
- Dosya hash tekrar kontrolü
- Şema doğrulama
- Analiz durumu takibi
- Upload testleri

### Ön İşleme Pipeline'ı (Gün 7)
- Sayısal ve kategorik sütun ayrımı
- Eksik değer yönetimi
- Kategorik alanlar için OneHotEncoder
- Ölçeklendirme (gerekirse)
- ColumnTransformer yapılandırması
- Scikit-learn Pipeline
- Veri sızıntısı önleme
- Ön işleme testleri

### Baseline Model — DummyClassifier ve Logistic Regression (Gün 8)
- DummyClassifier baseline
- Logistic Regression eğitimi
- Sınıf ağırlık yönetimi
- Eğitim scripti
- İlk tahminler
- Accuracy, precision, recall, F1 raporu
- Confusion matrix
- İlk model raporu

### Random Forest (Gün 9)
- Random Forest pipeline
- Kontrollü parametre denemeleri
- Eğitim süresi ölçümü
- Feature importance çıkarımı
- Logistic Regression ile karşılaştırma
- Model testleri

### Model Karşılaştırması ve Seçimi (Gün 10)
- Logistic Regression ile Random Forest karşılaştırması
- ROC-AUC analizi
- False-positive rate (FPR) değerlendirmesi
- Precision-recall eğrileri
- Model seçim kriterlerinin belirlenmesi
- Risk eşiklerinin (threshold) kesinleştirilmesi
- Model card oluşturma
- Nihai model kararı ve gerekçesi

**Teslim Çıktısı:** Eğitilmiş modeller, değerlendirme metrikleri (ROC-AUC, FPR dâhil), model karşılaştırma raporu, model card ve kesinleştirilmiş risk eşikleri ile eksiksiz ML pipeline'ı.

---

## Faz 4 – Analiz, Tespit ve Olay Yönetimi (Gün 11–12)

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

## Faz 5 – Frontend ve Kullanıcı Deneyimi (Gün 13–16)

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

## Faz 6 – Dashboard ve Raporlama (Gün 17)

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

## Faz 7 – Test, Güvenlik ve Entegrasyon (Gün 18)

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

## Faz 8 – Docker, Dokümantasyon ve Final Teslimi (Gün 19–20)

### Docker ve Dağıtım (Gün 19)
- Backend Dockerfile
- Frontend Dockerfile
- Docker Compose (PostgreSQL volume dahil)
- Environment örneği (.env.example)
- Seed/demo kullanıcıları
- Küçük demo CSV dosyası

### Dokümantasyon ve Final Teslim (Gün 20)
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
| KRİTİK (CRITICAL) | 0.86 – 1.00 | Yüksek olasılıklı saldırı tespiti, olaya dönüştür |

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

---

## Kullanıcı Rolleri

| Rol | Yetkiler |
|-----|----------|
| **Yönetici (Admin)** | Kullanıcı yönetimi, tüm analiz ve olayları görüntüleme, model bilgileri, audit log, olay atama |
| **Güvenlik Analisti (Analyst)** | Trafik verisi yükleme, analiz başlatma, tespit sonuçlarını inceleme, olay yönetimi, not ekleme |

---

## Veri Seti

Ana veri seti olarak **UNSW-NB15** kullanılmaktadır.

- Kaynak: [UNSW-NB15 Dataset](https://research.unsw.edu.au/projects/unsw-nb15-dataset)
- Eğitim ve test CSV dosyaları: `UNSW_NB15_training-set.csv`, `UNSW_NB15_testing-set.csv`
- Ham veri seti Git repository'sine eklenmemiştir. Veri setini indirme ve hazırlama adımları `data/` dizininde belgelenmiştir.

---

## Görsel ve Mockup Entegrasyonu

### Kapsam

Bu bölüm, projenin görsel varlıklarının (marka, mockup, ekran görüntüsü) nasıl yönetileceğini ve geliştirme sürecine nasıl entegre edileceğini tanımlar.

### Dizin Yapısı

Tüm görsel varlıklar `docs/assets/` dizini altında tutulur:

```
docs/assets/
├── README.md          # Kullanım kuralları
├── brand/             # Logo, uygulama ikonu, renk paleti ve marka varlıkları
├── mockups/           # UI/UX ekran tasarımları
└── screenshots/       # Tamamlanan uygulama ekran görüntüleri
```

### Kurallar

- **Dosya adlandırma:** Tüm görsel dosya adlarında kebab-case kullanılmalıdır (ör. `dashboard-layout-v2.png`).
- **İlişkilendirme:** Mockup ve ekran görüntüleri, ilgili oldukları Issue veya Pull Request numarasıyla bağlantılı olmalıdır.
- **Öncelik:** UI geliştirmeye başlamadan önce ilgili ekranın mockup'ı hazırlanmalı ve ekip içinde gözden geçirilmelidir.
- **Zamanlama:** Uygulama ekran görüntüleri, ilgili özellik tamamlandıktan sonra `docs/assets/screenshots/` altına eklenir.

### Aşama İlişkisi

Bu süreç doğrudan **Faz 5 – Frontend ve Kullanıcı Deneyimi (Gün 13–16)** ile ilişkilidir:

- Gün 13 öncesinde ilgili ekranların mockup'ları hazırlanmış ve onaylanmış olmalıdır.
- Gün 13–16 boyunca frontend geliştirme, onaylanan mockup'lara sadık kalınarak ilerletilir.
- Gün 17 – Faz 6 Dashboard ve Raporlama sonrasında ekran görüntüleri alınarak `docs/assets/screenshots/` dizinine eklenir.
- Final teslim (Gün 20) öncesinde tüm ekran görüntüleri güncellenmiş olmalıdır.
