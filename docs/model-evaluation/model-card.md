# SecureWatch AI — Model Card

Bu Model Card, SecureWatch AI projesinde ağ trafiği saldırı tespiti için oluşturulan makine öğrenmesi model değerlendirme, karar eşiği optimizasyonu ve deterministik model seçim altyapısının özelliklerini, sözleşmelerini, operasyonel sınırlarını ve risklerini belgeler.

---

## 1. Model Card Durumu
> [!IMPORTANT]
> **Prototip Altyapı Kartı:** Bu belge, canlı prodüksiyon ortamında epeydir çalışan veya diske kalıcı olarak kaydedilmiş (`.joblib` / `.pkl`) tek bir nihai modelin kartı değildir. Bu belge, 5 farklı model adayını (`lr_baseline`, `rf_baseline`, `rf_deeper`, `rf_unweighted`, `rf_compact`) aynı veri sözleşmesi ve validation kısıtları altında değerlendirebilen, en uygun karar eşiğini seçen ve kazanan modeli deterministik olarak belirleyen **model seçim altyapısının kartıdır**. Henüz gerçek veri üzerinden bir üretim modeli seçilmemiş, kaydedilmemiş ve canlı inference servisine alınmamıştır.

---

## 2. Sistem ve Amaç
SecureWatch AI Makine Öğrenmesi Alt Sistemi, kurumsal ağlarda toplanan ve özetlenen ağ akış kayıtlarını analiz ederek trafiğin normal (`BENIGN`) mi yoksa bir siber saldırı (`Attack`) mı olduğunu yüksek doğruluk ve düşük yanlış alarm oranıyla sınıflandırmayı amaçlar. Sistem, güvenlik analistlerine otomatik risk skorları ve açıklanabilir karar destek verileri sunar.

---

## 3. Intended Use (Hedeflenen Kullanım)
- **Akademik ve Kurumsal Karar Destek:** Ağ analistlerinin incelenecek trafik akışlarını önceliklendirmesi ve riskli bağlantıları tespit etmesine yardımcı olmak.
- **Toplu Akış Analizi (Batch Analysis):** CIC-IDS2017 formatında yüklenen geçmiş veya özetlenmiş ağ trafiği CSV dosyalarının çevrimdışı/asenkron olarak tarayarak risk seviyelerini sınıflandırmak.
- **Model Deneyleri ve Kıyaslama:** Farklı makine öğrenmesi modellerinin ve karar eşiklerinin güvenlik operasyonları kısıtları (Recall vs FPR) altında objektif olarak karşılaştırılması.

---

## 4. Out-of-Scope Uses (Kapsam Dışı Kullanım)
- **Gerçek Zamanlı İhlal Engelleme (Inline IPS):** Canlı ağ trafiğini kablo üstünden (inline) kesmek, port engellemek veya güvenlik duvarı kurallarını otomatik değiştirmek amacıyla kullanılamaz.
- **Tam Otomatik Müdahale:** Yanlış pozitif (FP) ve yanlış negatif (FN) riskleri nedeniyle, insan analist incelemesi olmadan otomatik yaptırım veya yasal aksiyon alma amacıyla kullanılamaz.
- **Hedefli Saldırı Aracı:** Ağ tarama, zafiyet sömürme veya karşı saldırı (hack-back) faaliyetlerinde kullanılamaz.
- **Farklı Ağ Şemaları:** CIC-IDS2017 öznitelik uzayından (78 sütun) farklı şemalara sahip ağ akışlarının doğrudan sınıflandırılması için kullanılamaz.

---

## 5. Veri Sözleşmesi
- **Girdi Şeması:** Tam olarak CIC-IDS2017 şemasını takip eden 78 sütunluk ağ akışı verisi gereklidir.
- **Temizlik ve İzolasyon:** Yükleme ve hazırlama aşamasında redundant olan `Fwd Header Length.1` sütunu silinir, `±inf` değerler `NaN` ile değiştirilir ve tam mükerrer satırlar (`drop_duplicates()`) eleyerek overfit riski azaltılır.
- **Train / Test Ayrımı:** Temizlenmiş veri üzerinde %80 Eğitim ve %20 Test olacak şekilde sızıntı korumalı (leakage-safe) Stratified split uygulanır.

---

## 6. Hedef Kodlaması
- **İkili Sözleşme:** Sistem yalnızca ikili (`[0, 1]`) hedef sözleşmesiyle çalışır.
- **Etiket Dönüşümü:** Ham verideki metin tabanlı `Label` sütunu temizlenir; `BENIGN` etiketi `0` (Normal) sınıfına, `BENIGN` dışındaki tüm geçerli saldırı etiketleri (`DDoS`, `PortScan`, `Bot`, `Infiltration`, `Brute Force` vb.) ise `1` (Saldırı) sınıfına dönüştürülür.

---

## 7. Feature Sözleşmesi
- **Öznitelik Uzayı:** Redundant sütun ve etiket ayrıldıktan sonra model girdisi tam olarak 77 sayısal özellikten (`X_train` / `X_test`) oluşur.
- **Sıralama Garantisi:** Sütun sıralaması her zaman deterministik ve sabittir. `Destination Port` dahil tüm alanlar sayısal pipeline'dan geçirilir.
- **Ön İşleme Pipeline'ı:** Scikit-learn `ColumnTransformer` ile medyan doldurma (`SimpleImputer(strategy="median", keep_empty_features=True)`) ve standart ölçeklendirme (`StandardScaler`) uygulanır. Transformer **yalnızca** `X_train` üzerinde `fit_transform` edilir; `X_test` üzerinde sadece `transform` çalışır.

---

## 8. Aday Modeller ve Parametreler
Sistem, sonsuz grid search yerine kod içine gömülü 5 sabit ve kontrollü model adayını yarıştırır:
1. `lr_baseline`: Lojistik Regresyon (`max_iter=1000`, `class_weight="balanced"`, `solver="lbfgs"`).
2. `rf_baseline`: Random Forest (`n_estimators=100`, `max_depth=10`, `class_weight="balanced"`, `n_jobs=-1`).
3. `rf_deeper`: Random Forest (`n_estimators=100`, `max_depth=20`, `class_weight="balanced"`, `n_jobs=-1`).
4. `rf_unweighted`: Random Forest (`n_estimators=100`, `max_depth=10`, `class_weight=None`, `n_jobs=-1`).
5. `rf_compact`: Random Forest (`n_estimators=50`, `max_depth=5`, `class_weight="balanced"`, `n_jobs=-1`).

> [!NOTE]
> `DummyClassifier` (`strategy="most_frequent"`) yalnızca referans çizgisi olarak hesaplanır, model adayları arasında sayılmaz.

---

## 9. Değerlendirme Metrikleri
- **Eğri Bağımsız Metrikler:** ROC-AUC (`roc_auc_score`) ve PR-AUC / Average Precision (`average_precision_score`). Dengesiz verilerde özellikle PR-AUC modeli ayırma gücünü gösterir.
- **Eşik Tabanlı Metrikler:** Seçilen karar eşiğinde hesaplanan Accuracy, Precision, Recall, F1-score ve tam 2x2 Confusion Matrix `((TN, FP), (FN, TP))`.
- **Sıfır Bölme Güvenliği:** Sıfıra bölme durumlarında uyarı fırlatılmaz, `zero_division=0` kuralı uygulanır.

---

## 10. Validation ve Eşik Seçimi
- **OOF Olasılık Üretimi:** Karar eşiği testi verisi görülmeden, yalnızca `X_train` ve `y_train` üzerinde `StratifiedKFold(n_splits=5, shuffle=True, random_state=42)` Out-of-Fold olasılıklarıyla optimize edilir. Her fold'da estimator bağımsız clone edilir.
- **Aday Eşik Tarama:** `0.10` ile `0.90` aralığında `0.05` adımlı 17 eşik taranır (`score >= threshold`).
- **Operasyonel Kısıtlar:** Varsayılan olarak `min_recall = 0.95` ve `max_fpr = 0.05` şartları aranır. Bu şartları sağlayan eşikler arasında sırasıyla en yüksek Recall, F1, Precision, en düşük FPR ve en düşük eşik seçilir.
- **Test Seti İzolasyonu:** Test kümesi (`X_test`/`y_test`) eşik seçimine kesinlikle girmez; sadece en son raporlama için kullanılır.

---

## 11. Nihai Model Seçim Politikası
- **Uygunluk Kriteri (Eligibility):** Bir adayın geçerli sayılması için OOF validation üzerinde `min_recall` ve `max_fpr` kısıtlarını sağlayan bir eşik bulması ve tüm `X_train` üzerinde eğitilebilmesi gerekir.
- **Deterministik Tie-Break:** Kısıtları sağlayan adaylar arasında eşitlik yaşanırsa sırasıyla şu kural işletilir:
  1. En yüksek validation Recall (`descending`)
  2. En düşük validation False Positive Rate (`ascending`)
  3. En yüksek validation F1-score (`descending`)
  4. En yüksek validation Average Precision (`descending`)
  5. Variant adının alfabetik sırası (`ascending`)
- **Süre Bağımsızlığı:** Eğitim süresi (`training_duration_seconds`) OS ve donanım yüküne göre dalgalandığı için tie-break kararından çıkarılmıştır; yalnızca bilgi amaçlı raporlanır.
- **Sessiz Fallback Yoktur:** Uygun aday yoksa model seçilmez (`is_selected = False`), varsayılan adaya gizli fallback yapılmaz.
- **Gerçek Performans İddiası Yoktur:** Gerçek CIC-IDS2017 verisi repoda yer almadığı ve üretim eğitimi tamamlanmadığı için bu kartta uydurma metrik sayıları veya kazanan model adı verilmemektedir.

---

## 12. Risk Seviyeleri
Modelin ürettiği sonlu olasılık değeri (`p`), karar eşiğinden bağımsız operasyonel kategorilere ayrılır:
- `LOW` (Düşük): `0.00 <= p < 0.30` (Normal trafik, analist eylemi gerekmez).
- `MEDIUM` (Orta): `0.30 <= p < 0.60` (Şüpheli trafik, izlenmesi önerilir).
- `HIGH` (Yüksek): `0.60 <= p < 0.85` (Yüksek tehdit riski, güvenlik olayına dönüştürülmelidir).
- `CRITICAL` (Kritik): `0.85 <= p <= 1.00` (Acil tehdit, anlık müdahale ve alarm gerektirir).

---

## 13. Güvenlik ve Gizlilik
- **Hata ve Log Güvenliği:** Sistem hatalarında traceback, veritabanı bağlantı detayları veya mutlak dosya yolları (`C:\...` vb.) dışarı basılmaz.
- **Artefakt Yalıtımı:** CLI çalıştırması diskte kalıcı model dosyası, `.joblib` veya `.pkl` kalıntısı oluşturmaz; rapor yalnızca güvenli JSON (`allow_nan=False`) olarak stdout'tan döner.
- **Veri Sızdırmazlığı:** JSON raporlarında hiçbir model katsayısı, estimator nesnesi veya ham veri dizisi bulunmaz.

---

## 14. Sınırlamalar ve Bilinen Riskler
- **Veri Seti Temsil Sınırı:** CIC-IDS2017 veri seti, yayınlandığı tarihteki ağ saldırı karakterizasyonunu yansıtır. Sıfırıncı gün (zero-day) saldırılarını veya çok modern, şifrelenmiş (encrypted C2) ve yavaş/gizli (slow-and-low) sızma akışlarını tam temsil etmeyebilir.
- **Gini Importance Yanlılığı:** Random Forest modellerinde raporlanan Gini tabanlı özellik önem dereceleri, yüksek kardinaliteli veya sürekli sayısal değişkenlere doğru doğal bir eğilim (bias) gösterebilir.
- **Ortam Bağımlı Süreler:** Raporlanan eğitim süreleri donanım işlemcisine, önbellek durumuna ve sistem yüküne göre değişkenlik gösterecektir.

---

## 15. Adalet ve Veri Önyargısı (Fairness & Bias)
- **Ağ Trafiği Odaklılık:** Model demografik veya kişisel nitelikler (cinsiyet, yaş, ırk) üzerinde eğitilmez; yalnızca IP paketi istatistikleri, bayt sayıları ve bayrakları (flags) kullanır.
- **Veri Seti Önyargısı:** Eğitim veri setindeki normal trafik davranışı laboratuvar ortamında üretildiği için, gerçek kurumsal ağlardaki olağan yüksek hacimli dosya transferlerini (ör. büyük veritabanı yedeklemeleri) yanlış pozitif (False Positive) olarak saldırı şeklinde sınıflandırabilir. Bu nedenle risk skorları insan incelemesiyle doğrulanmalıdır.

---

## 16. Tekrarlanabilirlik (Reproducibility)
- **Sabit Tohum (Random State):** Stratified K-Fold ayrımı, ön işleme imputer'ı, Lojistik Regresyon ve Random Forest eğitim adımlarının tamamında `random_state=42` sabiti kullanılmıştır.
- **Çalışma Süresi İzolasyonu:** Algoritma tie-break kararından çalışma süresi çıkarıldığı için, aynı veri seti ve aynı bağımlılık sürümleri kullanıldığında sistem her ortamda %100 aynı modeli ve aynı karar eşiğini seçecektir.
- **Yazılım Doğrulaması:** Sistem, 304 adet otomatik birim/entegrasyon testiyle (`304 passed`) doğrulanan deterministik bir kural setine dayanır.

---

## 17. Model Saklama ve Dağıtım Durumu
Bu Model Card'ın kapsadığı sistem, Gün 10 itibarıyla henüz diske model kaydetme (Joblib/PKL serialization), model arşivi (registry), canlı tahmin API uç noktası veya production deployment aşamalarını **tamamlamamıştır**. Bu bileşenler sonraki günlerin geliştirme planındadır.

---

## 18. Gelecek Çalışmalar
- Seçilen nihai modelin ve preprocessor nesnesinin `.joblib` olarak güvenli bir şekilde diske kaydedilmesi.
- Kaydedilen modelin otomatik bir Registry sistemine entegre edilerek aktif/pasif model versiyonlamasının sağlanması.
- FastAPI üzerinde `/api/v1/inference` uç noktasının açılarak asenkron background worker (Celery/ARQ) üzerinden batch trafik analizi yapılması.
- Canlı tespitlerin analist onay mekanizmaları ile güvenlik olayına (Incident) dönüştürülme iş akışlarının entegrasyonu.
