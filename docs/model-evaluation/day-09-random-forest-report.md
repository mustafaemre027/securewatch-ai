# Gün 9 Model Değerlendirme Raporu: Random Forest ve Karşılaştırma Altyapısı

## Amaç
Bu rapor, ağ trafiği anomalilerini sınıflandırmak üzere sisteme entegre edilen `RandomForestClassifier` eğitim altyapısını, kontrollü deney (variant) tasarımını ve Lojistik Regresyon baseline modeliyle yapılan güvenli karşılaştırma (model comparison) sistemini belgelemektedir. Bu aşamada amaç, "en iyi" modeli seçmek değil, farklı model yapılandırmalarını aynı standart veri seti üzerinden, metrik sızıntısı olmadan ve tam otomatik biçimde değerlendirebilecek altyapıyı kurmaktır.

## Veri ve Değerlendirme Sözleşmesi
Random Forest eğitimi ve tüm karşılaştırma süreçleri, sistemdeki mevcut sızıntı korumalı (leakage-safe) veri ön işleme hattına tabidir:
- **Eğitim:** Model fit işlemi **yalnızca** `%80`'lik `X_train` ve `y_train` kümeleri kullanılarak yapılır.
- **Değerlendirme:** Test verisi (`X_test`), model tarafından asla görülmez; yalnızca `predict` metoduyla tahmin almak için kullanılır.
- **Veri Sızıntısı Koruması:** `X_test` içindeki hiçbir dağılım özelliği veya etiket sınıfı (`y_test`), transformer istatistiklerini veya model katsayılarını etkileyemez.
- **Güvenlik:** Karşılaştırma yapıları (immutable dataclass), raw (ham) veri matrislerini veya model/estimator nesnelerini içermez. Sadece nihai skaler değerler (metrikler) taşınır.

## Random Forest Yapılandırması
Sisteme dahil edilen Random Forest modeli, non-linear (doğrusal olmayan) ilişkileri yakalayabilmek için aşağıdaki varsayılan parametrelerle başlatılır:
- `n_estimators=100`: Karar ağacı sayısı.
- `max_depth=10`: Aşırı öğrenmeyi (overfitting) sınırlamak için maksimum ağaç derinliği.
- `min_samples_split=2`: Bir düğümün bölünmesi için gereken minimum örnek sayısı.
- `min_samples_leaf=1`: Bir yaprak düğümde bulunması gereken minimum örnek sayısı.
- `class_weight="balanced"`: Saldırı ve normal trafik arasındaki olası dengesizliği (class imbalance) gidermek için ters orantılı sınıf ağırlıkları.
- `random_state=42`: Deterministik ve tekrar edilebilir sonuçlar için sabit rastgelelik çekirdeği.
- `n_jobs=-1`: Performans için mevcut tüm CPU çekirdeklerinin kullanımı.

## Kontrollü Deneyler Tablosu
Dışarıdan (istemci veya API üzerinden) limitsiz ve potansiyel olarak güvensiz/kaynak tüketici rastgele hyperparameter grid search aramalarına izin verilmemiştir. Bunun yerine aşağıdaki 4 kontrollü varyant geliştirilmiştir:

| Varyant Adı | Ağaç Sayısı (`n_estimators`) | Derinlik (`max_depth`) | Sınıf Ağırlığı (`class_weight`) | Açıklama |
| :--- | :--- | :--- | :--- | :--- |
| `rf_baseline` | 100 | 10 | `balanced` | Varsayılan referans konfigürasyonu. |
| `rf_deeper` | 100 | 20 | `balanced` | Daha karmaşık ilişkileri öğrenme kapasitesi. |
| `rf_unweighted` | 100 | 10 | `None` | Sınıf ağırlıklandırmasının (imbalance penalty) kapatıldığı durum. |
| `rf_compact` | 50 | 5 | `balanced` | Hızlı eğitim ve düşük bellek tüketimi hedeflenen hafif konfigürasyon. |

## Lojistik Regresyon ve Random Forest Karşılaştırma Yöntemi
Model karşılaştırması `compare_models` servisi üzerinden tek bir çatı altında yapılır:
- Ayrılmış veri (Train/Test Split) hem Lojistik Regresyon hem de 4 Random Forest deneyi için tam olarak aynı referansı paylaşır. Modeller arasında rastgele varyans (random split variance) oluşmaz.
- Değerlendirme sonucu, değiştirilemez (immutable) `FullModelComparisonReport` yapısına yerleştirilir ve 5 satırdan oluşur.
- Hiçbir model algoritma tarafından "kazanan" veya "en iyi" olarak seçilmez; tüm metrikler objektif olarak listelenir.

## Kullanılan Sınıflandırma Performans Metrikleri
Her bir varyant (Lojistik Regresyon dâhil) için aşağıdaki temel sınıflandırma metrikleri hesaplanır:
- **Accuracy (Doğruluk):** Toplam tahminler içerisindeki doğru sınıflandırma oranı.
- **Precision (Kesinlik):** Saldırı olarak tahmin edilen akışların ne kadarının gerçekten saldırı olduğu.
- **Recall (Duyarlılık):** Gerçek saldırı akışlarının ne kadarının tespit edilebildiği.
- **F1-Score:** Precision ve Recall değerlerinin harmonik ortalaması.
- **Confusion Matrix:** `[[TN, FP], [FN, TP]]` formatında 2x2 matris.

*Not: Gerçek dünya CIC-IDS2017 verisine ait sayısal başarı grafikleri ve metrik eşikleri, veri seti bağlandıktan ve çalıştırıldıktan sonra üretilecektir. Testlerdeki sentetik veriler, model başarısını yansıtmaz.*

## Eğitim Süresi Ölçümü
Modelin karmaşıklığına (derinlik, ağaç sayısı) bağlı olarak değişen kaynak tüketimini takip edebilmek için "eğitim süresi" saniye (seconds) cinsinden ölçülmektedir. Zamanlama, yalnızca `model.fit(X_train, y_train)` işleminin hemen öncesinde başlar ve işlem bitiminde durdurulur. Disk I/O, veri kopyalama veya ön işleme adımları bu süreye dâhil edilmez.

## Feature Importance Değerlendirmesi
Random Forest tarafından hesaplanan *Gini tabanlı* özellik önem (feature importance) dereceleri rapora eklenmiştir.
- Model eğitildikten sonra, her varyant için en belirleyici **ilk 10 özellik** rapora (`feature_importances` listesi) dâhil edilir.
- Çıktılar, 77 boyutlu sütun adlarıyla (örneğin `Destination Port`, `Flow Duration`) otomatik olarak eşleştirilir ve büyükten küçüğe sıralanır.
- Lojistik Regresyon için özellik önem derecesi boş (`null`) bırakılır.

**Teknik Sınırlama (Limitation):** Random Forest modellerindeki Gini importance metriği, doğal olarak sürekli değişkenlere (continuous features) ve çok sayıda benzersiz değer içeren (high cardinality) özelliklere karşı matematiksel bir önyargıya (bias) sahiptir. Mutlak özellik kararı alınırken bu istatistiksel eğilim göz önünde bulundurulmalıdır.

## Uçtan Uca CLI Kullanımı
Yeni özellikler, `scripts/train_baseline_models.py` modülü üzerinden kullanıma açılmıştır. Eski uyumluluk bozulmamış, Random Forest karşılaştırması `--compare-random-forest` bayrağına bağlanmıştır.

```powershell
python -m scripts.train_baseline_models --input path/to/training.csv --compare-random-forest
```

Sistem terminale geçerli ve doğrulanmış bir JSON (JavaScript Object Notation) metni basar:
- JSON içerisinde `allow_nan=False` denetimi kullanılarak, web istemcilerinin veya diğer API'lerin parse edemeyeceği `NaN` ve sonsuz (`inf`) değer sızıntıları engellenmiştir.
- Model estimator nesneleri, geçici ham DataFrameler veya tam prediction (tahmin) vektörleri çıktıya dâhil edilmez.

## Otomatik Test Doğrulaması
Random Forest implementasyonu ve CLI çıktısı, pytest altında birim (unit) ve entegrasyon testleriyle doğrulanmıştır. Yeni eklenen testler:
- Sadece `X_train` üzerinde fit yapıldığının test edilmesi (Mock doğrulaması ve end-to-end sentetik test).
- Feature importance değerlerinin ilk 10 ile sınırlandırıldığının test edilmesi.
- Immutable yapıların kopyalanabilirliği ve read-only durumunun test edilmesi.
- Terminal entegrasyon testlerinde hata durumlarında mutlak yol ve traceback sızıntısı olmadığının (güvenli `stderr` mesajları) doğrulanması.
- Diskte hiçbir `.joblib`, `.pkl` veya kalıntı dosya oluşmadığının kontrolü.

## Kapsam Sınırları ve Sonraki Adımlar
Bu rapor ve çalışma bloğu (Gün 9) kapsamında aşağıdaki teknik bileşenler geliştirilmiş, ancak bazı karar mekanizmaları kasti olarak sonraki günlere bırakılmıştır. Sistemin henüz "üretim modeli" kararı almadığını önemle belirtmek gerekir.

- **Kapsam Dışı / Gün 10 Planı:** ROC-AUC skoru hesaplamaları, Precision-Recall eğrileri, işletme mantığına dayalı False Positive Rate (FPR) tolerans eşikleri ve bu bulgulara göre nihai (üretim) modelin kalıcı olarak seçilmesi (Model Selection) işlemleri Gün 10 hedeflerindedir.
- **Kapsam Dışı / İleri Aşama:** Eğitilen modelin diske serileştirilmesi (Joblib/PKL persistence), asenkron background worker süreçlerinde (Celery/RQ vb.) inference yapılması ve API / Veritabanı (AnalysisJob tablosu vb.) entegrasyonu, model seçimi tamamlandıktan sonraki geliştirme iterasyonlarında devreye alınacaktır.

## Sonuç
Gün 9 kapsamında Lojistik Regresyon referans çizgisine (baseline) ek olarak Random Forest eğitim, kontrollü parametre deneyleri ve feature importance çıkarım mimarisi sızıntısız ve güvenli bir şekilde inşa edilmiştir. Karşılaştırma altyapısı, Gün 10'da yapılacak detaylı ROC-AUC, FPR analizi ve nihai model seçimi için deterministik, genişletilebilir ve izole bir değerlendirme platformu sunmaktadır.
