# Gün 10 - Model Değerlendirme, Karar Eşiği ve Nihai Model Seçimi

## Temel Bilgiler
- **Tarih:** 27 Temmuz 2026
- **Çalışma türü:** Online
- **Proje:** SecureWatch AI
- **Günün konusu:** Model değerlendirme ve seçim altyapısı

## Hedef
Bugün temel hedefim, Lojistik Regresyon ile dört kontrollü Random Forest deneyini adil ve sızıntısız değerlendirebilen, en uygun karar eşiğini otomatik belirleyen ve kazanan modeli deterministik olarak seçen gelişmiş bir altyapı kurmaktı.

## Yapılanlar

### 1. Olasılık Çıkarımı ve Gelişmiş Metrikler
Öncelikle Lojistik Regresyon ve Random Forest modellerinden güvenli pozitif saldırı sınıfı olasılıklarını çıkaran dinamik bir altyapı tasarladım. Sabit 0.50 eşiğine bağımlı kalmamak adına ROC-AUC ve dengesiz ağ verilerinde kritik olan PR-AUC (Average Precision) metriklerini hesaplayan servisler geliştirdim. ROC ve Precision-Recall eğrisi noktalarını sonlu ve güvenli hale getirdim. False Positive Rate (FPR) ve temel sınıflandırma metriklerini immutable yapılarla güvenceye aldım.

### 2. Validation Tabanlı Karar Eşiği Seçimi
Karar eşiğinin test verisine bakılmadan belirlenmesi için Stratified 5-Fold Out-of-Fold (OOF) validation yaklaşımını uyguladım. Her fold için modeli sıfırdan kopyalayarak eğittik ve her satırın modeli görmediği fold üzerinden olasılık almasını sağladım. 0.10 ile 0.90 aralığında 0.05 adımlı eşikler taranarak, varsayılan 0.95 minimum Recall ve 0.05 maksimum FPR kısıtlarını sağlayan en uygun eşiği belirleyen politika kurguladım. Kısıtlar sağlanamazsa sessiz fallback yapılmasını engelledim.

### 3. Nihai Model Seçimi ve Risk Seviyeleri
Sistemde tanımlı lr_baseline, rf_baseline, rf_deeper, rf_unweighted ve rf_compact aday modellerini aynı validation kısıtlarıyla yarıştıracak seçim motoru yazdım. DummyClassifier modelini yalnızca referans çizgisi olarak tuttum. Ayrıca karar eşiğinden bağımsız olarak olasılıkları LOW, MEDIUM, HIGH ve CRITICAL operasyonel risk aralıklarına ayıran sınıflandırma politikasını entegre ettim.

### 4. CLI ve Güvenli JSON Raporlaması
Seçim altyapısını komut satırına --select-final-model ile ekledim; --min-recall, --max-fpr ve --cv-splits gibi argümanlar tanıdım. Çıktıların güvenli JSON olarak basılmasını, ham veri ve mutlak sistem yollarının gizlenmesini sağladım.

## Karşılaşılan Zorluklar
Bağımsız denetimlerde, aday modeller arasındaki eşitlik (tie) durumunda eğitim süresinin tie-break anahtarında kullanılmasının milisaniyelik gecikmeler nedeniyle nondeterminism oluşturacağını fark ettim. Çözüm olarak eğitim süresini seçim kararından çıkarıp yalnızca gözlem alanında bıraktım. Eşitlik durumunda son kararı alfabetik variant adına bırakan deterministik tie-break sırasını kurarak düzeltmeyi doğruladım.

## Test ve Sonuç
Gün sonu kontrollerinde 304 otomatik testin sıfır hata ve uyarı ile geçtiğini kanıtladım. Bu sonucun model doğruluk başarısı değil, yazılım doğrulama kanıtı olduğunu not ettim. Gerçek CIC-IDS2017 verisi repoda yer almadığı için sahte model kazananı veya performansı üretilmedi. Model kaydı ve inference servisi çalıştırılmadı.

## Öğrenilenler
Dengesiz veri setlerinde Accuracy yerine PR-AUC ve Recall odaklı çalışmanın önemini kavradım. Test verisinde eşik seçmenin veri sızıntısı yarattığını ve OOF validation yaklaşımının bunu engellediğini öğrendim. Operasyonel risk seviyelerinin ikili karar eşiğinden neden bağımsız olması gerektiğini ve deterministik model seçiminde çalışma süresi gibi değişken ortam parametrelerinin kullanılmaması gerektiğini tecrübe ettim.

## Henüz Uygulanmayanlar
Projenin bu aşamasında aşağıdaki bileşenler sonraki günlerin geliştirme planına bırakılmıştır:
- Modelin Joblib/PKL ile diske kaydedilmesi
- Model registry arşivi
- Canlı inference servisi
- Tahmin API endpoint'i
- Background worker süreçleri
- Gerçek zamanlı trafik analizi ve frontend ekranları

## Referanslar
- [Makine Öğrenmesi Süreçleri](../architecture/07-ml-training-and-inference.md)
- [Gün 10 Model Seçim Raporu](../model-evaluation/day-10-model-selection-report.md)
- [Model Card](../model-evaluation/model-card.md)

### Git Commit Mesajları
- `[11:18]` (`1839bc0`) feat(ml): implement probability extraction and advanced ROC/PR metrics
- `[12:24]` (`5e378b7`) feat(ml): add validation-based decision threshold selection
- `[13:22]` (`cc9cb2d`) feat(ml): add deterministic final model selection
- `[14:37]` (`36ce544`) feat(ml): integrate final model selection into training cli
- `[15:35]` (`f5428bc`) fix(ml): remove runtime timing from model selection tie-break
- `[16:21]` (`70b11d7`) docs(ml): document model evaluation and selection
