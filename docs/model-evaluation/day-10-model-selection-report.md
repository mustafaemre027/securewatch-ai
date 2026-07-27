# Gün 10 — Model Değerlendirme, Karar Eşiği Seçimi ve Nihai Model Seçimi Raporu

Bu rapor, SecureWatch AI platformunun 10. geliştirme gününde tamamlanan gelişmiş olasılık tabanlı değerlendirme metrikleri (ROC-AUC, PR-AUC/AP), Out-of-Fold (OOF) validation tabanlı karar eşiği optimizasyonu, deterministik nihai model seçimi, operasyonel risk seviyesi sınıflandırması ve CLI entegrasyonu teknik altyapısını belgeler.

---

## 1. Amaç
Gün 10 çalışmalarının temel amacı, Gün 8'de oluşturulan Lojistik Regresyon baseline modeli ile Gün 9'da eklenen 4 kontrollü Random Forest deneyini aynı standart kısıtlar altında ve test verisinden tamamen yalıtılmış bir şekilde değerlendirebilen, en uygun model karar eşiğini otomatik seçen ve sistemin nihai kazanan modelini deterministik olarak belirleyen uçtan uca bir makine öğrenmesi seçim altyapısı kurmaktır.

---

## 2. Veri ve Hedef Sözleşmesi
- **İkili Sınıflandırma Hedefi:** Sistem yalnızca ikili (`[0, 1]`) hedef sözleşmesini destekler (`0: BENIGN`, `1: Attack`).
- **Veri Sızdırmazlığı:** Ham veriden özellik matrisine geçişte uygulanan şema doğrulamasının, redundant sütun elemenin ve `drop_duplicates()` temizliğinin ardından, `prepare_training_data` ve `split_and_transform_data` servisleri kullanılarak leakage-safe Stratified Train (%80) / Test (%20) ayrımı yapılır.
- **Gerçek Veri Seti Notu:** Gerçek CIC-IDS2017 ağ trafiği veri seti (büyük dosya boyutu ve lisans/güvenlik ilkeleri gereği) Git reponun içine **eklenmemiştir**. Geliştirme ve doğrulama süreçlerinde tam şema uyumlu sentetik test verileri ve mock katmanları kullanılmıştır.

---

## 3. Değerlendirilen Model Adayları
Nihai model seçim altyapısı, scikit-learn tabanlı 5 kontrollü deney adayını standart kısıtlar altında yarış Đtırır:
1. `lr_baseline`: Lojistik Regresyon (`max_iter=1000`, `class_weight="balanced"`).
2. `rf_baseline`: Random Forest (`n_estimators=100`, `max_depth=10`, `class_weight="balanced"`).
3. `rf_deeper`: Random Forest (`n_estimators=100`, `max_depth=20`, `class_weight="balanced"`).
4. `rf_unweighted`: Random Forest (`n_estimators=100`, `max_depth=10`, `class_weight=None`).
5. `rf_compact`: Random Forest (`n_estimators=50`, `max_depth=5`, `class_weight="balanced"`).

> [!NOTE]
> `DummyClassifier` modeli, yalnızca sistemin alt referans çizgisini (baseline accuracy/F1) göstermek amacıyla raporlarda yer alır; model seçimi havuzuna kesinlikle dâhil edilmez.

---

## 4. Olasılık Çıkarımı
- **Dinamik Pozitif Sınıf Tespiti:** Pozitif saldırı sınıfının (`1`) olasılık sütun indeksi, `estimator.classes_` dizisi üzerinden dinamik olarak tespit edilir.
- **Güvenli Olasılık Doğrulaması:** `predict_proba()` metodundan alınan olasılıkların sonlu (`finite`) ve `[0.0, 1.0]` aralığında olması doğrulanır. Olasılık üretimi desteklemeyen veya geçersiz sayı (`NaN`, `+inf`, `-inf`) üreten modeller anında `VALIDATION_ERROR` (422) ile reddedilir.
- **İzolasyon:** Estimator nesnesi, ham veri veya olasılık dizileri JSON raporuna girmez.

---

## 5. ROC-AUC ve PR-AUC/AP
Aday modellerin sınıfları ayırma gücünü ölçmek üzere sabit eşiklerden bağımsız eğri metrikleri hesaplanır:
- **ROC-AUC (`roc_auc_score`):** Farklı eşik seviyelerinde True Positive Rate (TPR) ile False Positive Rate (FPR) arasındaki genel ayrım performansını ölçer.
- **PR-AUC / Average Precision (`average_precision_score`):** Özellikle dengesiz (imbalanced) ağ saldırısı veri setlerinde pozitif sınıf (saldırı) üzerindeki hassasiyet (Precision) ve duyarlılık (Recall) dengesini özetler.
- **Eğri Noktaları:** `roc_curve` ve `precision_recall_curve` fonksiyonlarından elde edilen eşik (threshold) dizilerinde scikit-learn tarafından üretilebilen sonsuz değerler (`+inf`, `-inf`, `nan`), JSON serileştirme güvenliği için Python `None` değerine dönüştürülür.

---

## 6. Out-of-Fold Validation Yaklaşımı
Karar eşiğinin ve aday başarısının test verisi görülmeden objektif biçimde ölçülmesi için Stratified K-Fold Out-of-Fold (OOF) yöntemi uygulanır:
- **Yapılandırma:** Varsayılan olarak `StratifiedKFold(n_splits=5, shuffle=True, random_state=42)` kullanılır.
- **Klonlama ve Eğitmeme İzolasyonu:** Her fold denemesinde bağımsız bir unfitted estimator kopyası (`sklearn.base.clone`) yaratılır. Eğitim yalnızca o fold'un train kesitinde (`4/5`) gerçekleşir.
- **OOF Olasılık Bütünlüğü:** Her eğitim satırı, modelin kendisini görmediği validation kesitinde (`1/5`) tam olarak bir kez tahmin edilir. Böylece tüm eğitim seti (`X_train`) için aşırı öğrenmeden (overfitting) uzak validation olasılık dizisi elde edilir.

---

## 7. Karar Eşiği Seçim Politikası
Mevcut OOF olasılıkları üzerinde `0.10` ile `0.90` arasında `0.05` adımlı (17 adet) aday karar eşiği taranır:
- **Tahmin Kuralı:** Olasılık değeri seçilen eşikten büyük veya eşitse (`score >= threshold`) saldırı (`1`), küçükse normal (`0`) olarak tahmin edilir.
- **Varsayılan Operasyonel Kısıtlar:**
  - `min_recall = 0.95`: Gerçek saldırıların en az %95'inin yakalanması zorunludur.
  - `max_false_positive_rate = 0.05`: Normal trafiğin en fazla %5'ine yanlış alarm verilmesi toleransıdır.
- **Eşik Seçim Önceliği:** Kısıtları sağlayan eşikler arasından sırasıyla en yüksek Recall, en yüksek F1-score, en yüksek Precision, en düşük FPR ve en düşük eşik (threshold) tercih edilir.
- **Fallback Yoktur:** Hiçbir eşik kısıtları sağlamazsa varsayılan 0.50 eşiğine gizli fallback yapılmaz; modelin bu kısıtlar altında uygun eşik bulamadığı (`is_selected = False`) raporlanır.

---

## 8. Nihai Model Uygunluk Kriterleri
Bir model adayının nihai model olarak seçilebilmesi (eligible) için aşağıdaki şartların tamamını sağlaması zorunludur:
1. Karar eşiği taramasında varsayılan veya kullanıcı tanımlı `min_recall` ve `max_fpr` kısıtlarını sağlayan geçerli bir eşik (`selected_threshold`) bulmuş olması.
2. OOF validation verisi üzerinde hesaplanan metriklerinin sonlu ve geçerli olması.
3. Klonlanıp tüm `X_train` üzerinde başarıyla eğitilebilmesi.

---

## 9. Deterministik Tie-Break Sırası
Uygunluk kriterlerini karşılayan aday modeller arasında seçim yapılırken tam determinizm sağlanır. Aynı metrik skorlarına sahip iki aday arasında eşitlik (tie) olması durumunda aşağıdaki kesin sıralama kuralı uygulanır:

1. **En yüksek validation Recall** (`validation_recall descending`)
2. **En düşük validation False Positive Rate** (`validation_false_positive_rate ascending`)
3. **En yüksek validation F1-score** (`validation_f1_score descending`)
4. **En yüksek validation Average Precision / PR-AUC** (`validation_average_precision descending`)
5. **Variant adının alfabetik sırası** (`variant_name ascending` — kesin ve son eşitlik bozucu)

> [!IMPORTANT]
> **Çalışma Zamanı Bağımsızlığı:** Eğitim süresi (`training_duration_seconds`) işletim sistemi thread zamanlaması, arka plan CPU yükü ve önbellek gibi dış etkenlere göre dalgalanma gösterdiği için seçim anahtarından (tie-break) tamamen çıkarılmıştır. Eğitim süresi ölçülür ancak model seçim kararını kesinlikle etkilemez.

---

## 10. Test Verisi İzolasyonu
- **Sıfır Sızıntı Kuralı:** Test verisi (`X_test`/`y_test`), ön işleme fit aşamasına, Stratified K-Fold OOF olasılık üretimine, karar eşiği optimizasyonuna ve aday model sıralama kararına **kesinlikle dâhil edilmez**.
- **Raporlama Amaçlı Kullanım:** Test seti yalnızca nihai model seçim politikası tamamlandıktan sonra, seçilen modelin (veya adayların) generalizasyon başarısını raporlamak amacıyla sadece bir kez `predict_proba` üzerinden değerlendirilir.
- **Karara Etkisizlik:** Test seti üzerindeki performans metrikleri (`test_metrics`), kazanan modeli hiçbir koşulda değiştiremez.

---

## 11. Risk Seviyesi Sözleşmesi
Modelin ürettiği saldırı olasılığı (`p`), karar eşiğinden bağımsız olarak operasyonel önem aralıklarına ayrılır:
- `LOW` (Düşük): `0.00 <= p < 0.30` (Normal ağ trafiği, analist aksiyonu gerekmez).
- `MEDIUM` (Orta): `0.30 <= p < 0.60` (Şüpheli ağ akışı, izleme önerilir).
- `HIGH` (Yüksek): `0.60 <= p < 0.85` (Yüksek saldırı riski, güvenlik olayına dönüştürülebilir).
- `CRITICAL` (Kritik): `0.85 <= p <= 1.00` (Acil tehdit, anlık müdahale ve alarm gerektirir).

Risk seviyeleri operasyonel önceliklendirme katmanıdır; modelin ikili `0/1` tahmin kararı ise seçilen dinamik eşiğe (`selected_threshold`) göre verilir.

---

## 12. CLI ve JSON Raporlaması
Eğitim betiği (`scripts.train_baseline_models`), `--select-final-model` parametresiyle çalıştırıldığında uçtan uca validation tabanlı model seçimini gerçekleştirir:
```bash
python -m scripts.train_baseline_models \
  --input path/to/training.csv \
  --select-final-model \
  --min-recall 0.95 \
  --max-fpr 0.05 \
  --cv-splits 5
```
- **JSON Güvenliği:** Çıktı raporu `json.dumps(..., allow_nan=False)` ile stdout'a yazılır.
- **Veri Sızıntısı Koruması:** Rapor sözlüğünde model katsayıları, estimator nesneleri, ham tahmin dizileri veya sistem yolları yer almaz.
- **İstisnai Durumlar:** Gerçek bir çalıştırmada hiçbir model adayı `min-recall` ve `max-fpr` şartlarını sağlayamazsa, sistem sessizce statik sıradaki modeli seçmez; `selected_model.is_selected = False` olarak model seçmeden sonuç döndürür.

---

## 13. Otomatik Test Doğrulaması
Gün 10 kapsamında eklenen tüm altyapı, `backend/tests/test_model_service.py` ve `test_baseline_training.py` altında 100'ün üzerinde yeni birim ve entegrasyon testiyle doğrulanmıştır.
- **Doğrulama Sonucu:** Tüm backend test seti (`python -m pytest -q -W error`) çalıştırıldığında alınan `304 passed` sonucu, yazılımın şema, mantık, izolasyon, determinizm ve hata yönetimi sözleşmelerine uygunluğunu kanıtlayan **yazılım doğrulama sonucudur**.
- **Performans Ayrımı:** `304 passed` değeri kesinlikle modelin gerçek veri seti üzerindeki doğruluk (accuracy) veya yakalama performansı değildir. Gerçek CIC-IDS2017 verisi repoda yer almadığı ve gerçek çalıştırma performansı ölçülmediği için bu raporda uydurma başarı oranı, sentetik metrik tablosu veya uydurma "kazanan model adı" verilmemektedir.

---

## 14. Güvenlik ve Gizlilik
- **Hata Düzenlemesi:** Terminal çıktılarında mutlak sistem yolları (`C:\...`), veritabanı şifreleri veya dahili Python traceback dökümleri engellenmiştir.
- **Artefakt Yalıtımı:** Komut satırı betiği çalışma esnasında diske geçici dosya, `.pkl`, `.joblib` veya log kalıntısı yazmaz.

---

## 15. Kapsam Sınırları
Bu belgede açıklanan altyapı, 5 adayı değerlendiren, eşik optimize eden ve kazananı belirleyen bir **seçim sistemidir**. Aşağıdaki özellikler Gün 10 itibarıyla **uygulanmamıştır**:
- Eğitilen modelin diske serileştirilmesi (`.joblib` / `.pkl` persistence).
- Model registry ve model versiyonlama arşivi.
- Canlı tahmin (inference) servisi veya API uç noktaları (`/api/v1/inference`).
- Arka plan işleyicileri (worker/queue) ile batch analiz.
- Gerçek zamanlı ağ trafiği dinlenmesi (IDS deployment).
- React frontend arayüzünde model seçim raporlarının görselleştirilmesi.

---

## 16. Sonuç
Gün 10 geliştirme bloğu ile SecureWatch AI projesi, model değerlendirmesini basit doğruluk (accuracy) metriklerinin ötesine taşıyarak operasyonel güvenlik gereksinimlerine (yüksek Recall, düşük FPR) duyarlı, test verisinden yalıtılmış, çalışma zamanı dalgalanmalarına karşı tam deterministik ve sızıntı korumalı bir model seçim altyapısına kavuşmuştur. Sistem, bir sonraki aşamada gerçekleştirilecek model saklama (persistence) ve inference API geliştirme aşamaları için hazır hâle gelmiştir.
