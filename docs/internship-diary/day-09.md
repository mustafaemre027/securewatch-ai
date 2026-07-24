# Gün 9 – Random Forest ve Model Karşılaştırması

## Temel Bilgiler
- **Gün:** 9
- **Tarih:** 24 Temmuz 2026
- **Çalışma Biçimi:** Online

## Hedef
Bugün ana hedefim, sızıntı korumalı veri hazırlama altyapısı üzerine Random Forest sınıflandırma servisini eklemek, kontrollü deneyler tasarlamak ve Lojistik Regresyon ile Random Forest modellerini karşılaştırılabilir bir yapıya kavuşturmaktı. Model performanslarını nesnel görebilmek için güvenli bir altyapı kurmayı amaçladım.

## Yapılanlar

### Random Forest Eğitim Servisi
İlk olarak `RandomForestClassifier` servisini geliştirdim. Modelin sızıntısız çalışabilmesi için yalnızca eğitim verisi (`X_train`, `y_train`) üzerinde öğrenmesini sağladım. Test verisi olan `X_test`, kesinlikle eğitime dâhil edilmedi; yalnızca tahmin (predict) almak için kullanıldı.
Sistemin bellek ve işlemci tüketimini izleyebilmek amacıyla, yalnızca modelin eğitim aşamasını kapsayan kesin bir eğitim süresi ölçümü ekledim. Eğitim sonrası elde edilen Gini tabanlı özellik önem derecelerini (feature importance), veri setindeki 77 değişkenle doğru biçimde eşleştirip deterministik sıralayan bir mekanizma geliştirdim.

### Kontrollü Parametre Deneyleri
Dışarıdan gelebilecek denetimsiz arama (grid search) risklerini engellemek için dört sabit deney hazırladım:
- `rf_baseline`: 100 ağaç, derinlik 10, balanced ağırlık.
- `rf_deeper`: 100 ağaç, derinlik 20, balanced ağırlık.
- `rf_unweighted`: 100 ağaç, derinlik 10, sınıf ağırlığı yok.
- `rf_compact`: 50 ağaç, derinlik 5, balanced ağırlık.
Bu yapı, deneylerin tamamen deterministik çalışmasını sağladı.

### Model Karşılaştırması ve CLI
Modelleri değerlendirmek amacıyla Lojistik Regresyon ile yukarıdaki dört Random Forest varyantını birleştirdim. Tüm modellerin aynı veri ayrımı üzerinde değerlendirilmesini garanti altına aldım. Tüm modeller için accuracy, precision, recall, F1-score ve confusion matrix sonuçlarını rapora ekledim. Random Forest için belirleyici olan ilk 10 özelliği de JSON çıktısına dâhil ettim.
CLI üzerinden kullanabilmek için eski baseline komutunun geriye dönük uyumluluğunu bozmadan `--compare-random-forest` seçeneğini ekledim. Güvenli entegrasyon için geçersiz değerleri engelleyen (`allow_nan=False`) serileştirilebilir JSON yapısı kurguladım.

## Karşılaşılan Zorluklar
Bütün modellerin aynı train/test ayrımı üzerinde değerlendirilmesi, veri sızıntısının (data leakage) engellenmesi açısından zorluydu. Deneyleri deterministik tutmak, immutable veri yapılarıyla çalışmayı zorunlu kıldı. Estimator objelerinin ve ham verilerin (raw data) JSON çıktısına sızmasını önlemek için ayrıntılı yapılar kurmak durumunda kaldım. Feature importance değerlerinin doğru adlarla eşleştirilmesi sırasında indekslerin korunmasına dikkat ettim.

## Test ve Sonuç
Yazdığım yeni senaryolarla toplam 237 testin sıfır hata ve sıfır uyarıyla geçtiğini doğruladım. CLI arayüzünün diskte model dosyası bırakmadığını kanıtladım.

## Öğrenilenler
Bugün, Random Forest ağaç sayısı ve derinlik parametrelerinin karmaşıklık ve eğitim süresine etkisini gözlemledim. Sınıf dengesizliğinde `class_weight` parametresinin amacını kavradım. Eğitim süresi ve performans metriklerinin birlikte ele alınması gerektiğini gördüm. Feature importance sonuçlarının tek başına kesin neden-sonuç (causality) göstermediğini öğrendim.

## Henüz Uygulanmayanlar
Bazı karar adımlarını kasti olarak sonraya bıraktım:
- ROC-AUC
- Precision-Recall eğrileri
- FPR analizi
- Nihai model seçimi
- Risk eşiklerinin belirlenmesi
- Joblib model kaydı
- Inference
Bu özellikler sonraki günlerin kapsamında olacaktır.

## Referanslar

### Git Commit Mesajları
- `1aa6980` (11:47) - feat(ml): implement random forest classifier training service
- `0af7af8` (12:15) - feat(ml): add controlled random forest experiments
- `3b3352e` (13:22) - feat(ml): compare random forest and logistic regression
- `e8c1723` (15:37) - feat(ml): add random forest evaluation to training cli
- `56c9cf0` (15:45) - docs(ml): document random forest evaluation and comparison
