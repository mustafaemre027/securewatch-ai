# SecureWatch AI — Gün 08 Baseline Model Değerlendirme Raporu

**Tarih:** 23 Temmuz 2026
**Kapsam:** Baseline Model Altyapısı (`DummyClassifier` & `LogisticRegression`), İkili Etiket Kodlaması, Metrik Servisleri, Uçtan Uca Eğitim İş Akışı ve CLI
**İlişkili Dokümanlar:** [docs/architecture/07-ml-training-and-inference.md](../architecture/07-ml-training-and-inference.md)

---

## 1. Amaç

Bu rapor, SecureWatch AI projesinin Gün 8 geliştirmeleri kapsamında hayata geçirilen baseline makine öğrenmesi modellerinin (`DummyClassifier` ve `LogisticRegression`), ikili sınıflandırma etiket kodlama servisinin, sızıntı korumalı değerlendirme altyapısının ve CLI eğitim betiğinin teknik tasarımını ve kabul kriterlerini belgelemek amacıyla hazırlanmıştır.

---

## 2. Veri ve Hedef Sözleşmesi

- **Girdi Özellik Sayısı:** CIC-IDS2017 veri setindeki 78 zorunlu özelliğin doğrulanmasının ardından, mükerrer olan `Fwd Header Length.1` sütunu elenerek model girdisi **77 sayısal özelliğe** düşürülür.
- **Sayısal Dönüşüm & Temizlik:** `Destination Port` dahil tüm özellikler sayısal formata dönüştürülür; `+inf` ve `-inf` değerleri `NaN` yapıldıktan sonra medyan imputer ve standart ölçekleyici (`StandardScaler`) uygulanır.
- **İkili Etiket Kodlaması (`encode_binary_labels`):**
  - `BENIGN` (Normal trafik) → `0`
  - Saldırı trafiği (tüm geçerli saldırı dizeleri) → `1`
- **Etiket Kodlama Zamanlaması:** Etiket kodlaması, train/test ayrımından **önce** gerçekleştirilir. Stratified split ham saldırı isimlerine göre değil, oluşturulan ikili `0/1` hedefe göre çalışır.

---

## 3. Değerlendirme Protokolü ve Veri Sızıntısı Önlemleri

Model değerlendirmesinin güvenilirliğini garanti altına almak için aşağıdaki sızıntı önleme kuralları uygulanmıştır:

1. **İkili Hedef Üzerinden Stratified Split:** Eğitim (%80) ve test (%20) ayrımı, `random_state=42` kullanılarak ikili `0/1` etiket dağılımını koruyacak şekilde (`stratify=binary_targets`) yapılır.
2. **Ön İşleyici İzolasyonu:** `ColumnTransformer` ön işleme pipeline'ı **yalnızca** `X_train` üzerinde `fit_transform` edilir. `X_test` verisi üzerinde kesinlikle `fit` çağrılmaz; yalnızca eğitilmiş ön işleyici üzerinden `transform` uygulanır.
3. **Model İzolasyonu:** `DummyClassifier` ve `LogisticRegression` modelleri yalnızca `X_train` ve `y_train` kopyaları üzerinde fit edilir. Test hedef değişkenleri (`y_test`) fit aşamasına hiçbir şekilde dahil edilmez.
4. **Derin Kopya (Defensive Copy):** Tüm girdi ve çıktı veri yapıları `copy(deep=True)` ile izole edilir; mutable pandas tampon alanlarının paylaşımı engellenir.

---

## 4. Model Yapılandırmaları

### 4.1. DummyClassifier (Referans Taban Çizgisi)
- **Strateji:** `strategy="most_frequent"`
- **Rastgelelik:** `random_state=42`
- **Amaç:** Eğitim setindeki en sık gözlenen sınıfa göre sabit tahmin üreten en temel referans çizgisidir. Model seçimi veya nihai başarı ölçütü olarak kullanılmaz.

### 4.2. Logistic Regression (Ağırlıklı İkili Sınıflandırıcı)
- **Parametreler:** `class_weight="balanced"`, `max_iter=1000`, `solver="lbfgs"`, `random_state=42`
- **Sınıf Ağırlığı Desteği:** Varsayılan `"balanced"` ayarının yanı sıra `None` ve geçerli özel sözlük yapısı (`{0: weight_0, 1: weight_1}`) desteklenir.
- **Katsayı Uyumu:** Eğitilen modelin `coef_` katsayı boyutu 77 sayısal özellik boyutuyla tam eşleşmektedir.

---

## 5. Değerlendirme Metrikleri ve Confusion Matrix Düzeni

Model tahminleri `evaluate_binary_classification` servisi tarafından aşağıdaki kurallarla değerlendirilir:

- **Pozitif Sınıf:** `1` (Saldırı)
- **Negatif Sınıf:** `0` (`BENIGN`)
- **Hesaplanan Metrikler:** Accuracy, Precision, Recall, F1-Score.
- **Sıfır Bölme Yönetimi:** Metrik hesaplamalarında `zero_division=0` kullanılarak sıfıra bölme durumlarında uyarı (warning) oluşması engellenmiştir.
- **Confusion Matrix Formatı:** `((TN, FP), (FN, TP))` biçiminde 2x2 matris yapısı döndürülür:
  - `TN` (True Negative): Doğru tahmin edilen BENIGN
  - `FP` (False Positive): BENIGN olduğu halde Saldırı tahmin edilen
  - `FN` (False Negative): Saldırı olduğu halde BENIGN tahmin edilen
  - `TP` (True Positive): Doğru tahmin edilen Saldırı

---

## 6. Uçtan Uca Eğitim İş Akışı ve CLI

Uçtan uca eğitim süreci `train_baseline_models(df)` fonksiyonu ve `scripts.train_baseline_models` CLI betiği ile otomatize edilmiştir.

### CLI Kullanımı
PowerShell / Bash üzerinden `backend/` dizininden çalıştırma:

```bash
python -m scripts.train_baseline_models --input path/to/training.csv
```

### Çıktı ve Güvenlik
- **JSON Formatı:** Başarılı yürütmede stdout'a JSON biçiminde veri istatistiklerini ve her iki modelin performans sonuçlarını basar (`allow_nan=False`).
- **Tahmin Örnekleme:** Büyük tahmin dizilerinin tamamı yerine yalnızca ilk 10 tahmini içeren `prediction_sample` sunulur.
- **Güvenli Hata Yönetimi:** Hatalı dosya veya şema durumlarında traceback, veri satırları veya mutlak yerel dizin yolları verilmeden stderr'e kısa mesaj basılır ve sıfırdan farklı exit code dönülür.
- **Kalıcı Artifact Üretilmeme:** Script diske kalıcı model (`.pkl`/`.joblib`) veya rapor dosyası kaydetmez.

---

## 7. Otomatik Yazılım Test Doğrulaması

Projenin yazılım kalitesi ve veri sızıntısı önleme mekanizmaları Pytest test suit ile doğrulanmıştır:

- **Toplam Çalıştırılan Test Sayısı:** **213 test**
- **Test Sonucu:** `213 passed, 0 warnings in 28.01s`

> [!IMPORTANT]
> Yukarıda belirtilen **213 passed** değeri, projedeki birim (unit), entegrasyon ve CLI yazılım testlerinin başarıyla geçtiğini gösteren **yazılım doğrulama metriğidir**. Gerçek dünya veri seti üzerindeki model doğruluk (accuracy) veya başarı skoru olarak yorumlanmamalıdır.

---

## 8. Kapsam Sınırları ve Gelecek Planı

Bu rapor ve Gün 8 geliştirmeleri aşağıdaki sınırlar dahilinde tamamlanmıştır:

- **Sentetik Veri İzolasyonu:** Birim ve entegrasyon testleri deterministik sentetik verilerle yürütülmüştür; veri setine ait uydurma doğruluk metrikleri rapora eklenmemiştir.
- **Nihai Model Seçimi Yoktur:** `DummyClassifier` ve `LogisticRegression` sonuçları iki ayrı baseline olarak raporlanır; bu aşamada kazanan veya nihai model ilan edilmemiştir.
- **Henüz Uygulanmayan Özellikler:**
  - `RandomForestClassifier` eğitimi (Gün 9 kapsamındadır).
  - ROC-AUC, Precision-Recall eğrisi, FPR analizi ve nihai model seçimi (Gün 10 kapsamındadır).
  - `.joblib` model serileştirme / kalıcılık (İlerleyen aşamalardır).
  - Asenkron batch inference ve web API entegrasyonu (İlerleyen aşamalardır).

---

## 9. Sonuç

Gün 8 itibarıyla SecureWatch AI projesinin ikili sınıflandırma etiket kodlama, baseline model eğitimi, sızıntısız train/test ayrımı, performans değerlendirme ve CLI altyapısı eksiksiz ve güvenli şekilde tamamlanmıştır. Sistem Gün 9'da gerçekleştirilecek olan `RandomForestClassifier` geliştirmelerine hazır durumdadır.
