# Gün 8 – Baseline Modeller ve İlk Model Değerlendirmesi

## Temel Bilgiler

- **Tarih:** 23.07.2026 Perşembe
- **Faz:** Faz 3 — Veri İşleme ve Makine Öğrenmesi
- **EPIC Issue:** [#4](https://github.com/mustafaemre027/securewatch-ai/issues/4)
- **Sub-Issue:** [#20](https://github.com/mustafaemre027/securewatch-ai/issues/20) — Gün 8: Baseline Modeller ve Metrikler
- **Branch:** `feature/20-baseline-model`

---

## Hedef

1. CIC-IDS2017 `Label` etiketlerini ikili sınıflandırma hedefine (`BENIGN → 0`, Saldırı → `1`) dönüştüren servisin geliştirilmesi.
2. Pozitif sınıfı saldırı (`1`) kabul eden, `zero_division=0` korumalı ve 2x2 karmaşıklık matrisi (`[[TN, FP], [FN, TP]]`) üreten metrik altyapısının kurulması.
3. En alt referans çizgisi olarak `DummyClassifier` (`most_frequent`) baseline modelinin eğitilmesi.
4. Sınıf dengesizliğini yöneten varsayılan `class_weight="balanced"` parametreli `LogisticRegression` modelinin geliştirilmesi.
5. Ön işleme ve etiket kodlamasını sızıntısız şekilde uçtan uca birleştiren eğitim iş akışının ve JSON çıktı üreten CLI betiğinin oluşturulması.

---

## Yapılanlar

### 1. İkili Etiketleme ve Metrik Servisleri
- `encode_binary_labels` servisi geliştirilerek ham `Label` metinleri `BENIGN → 0` ve diğer saldırı etiketleri → `1` olarak dönüştürüldü.
- `evaluate_binary_classification` fonksiyonu ile Accuracy, Precision, Recall, F1-Score ve `[[TN, FP], [FN, TP]]` matrisini üreten `ClassificationMetrics` yapısı kuruldu. Pozitif sınıf saldırı (`1`) seçilerek `zero_division=0` ile korundu.

### 2. Baseline Modeller (`DummyClassifier` & `LogisticRegression`)
- `train_dummy_classifier` servisi `strategy="most_frequent"` ve `random_state=42` ile eğitildi. Amaç model seçimi değil, en basit kuralın referans çizgisini belirlemektir.
- `train_logistic_regression` servisi `class_weight="balanced"`, `max_iter=1000` ve `solver="lbfgs"` ile geliştirildi. Her iki model yalnızca `X_train` üzerinde fit edildi.

### 3. Eğitim İş Akışı ve Veri Sızıntısı Koruması (`train_baseline_models` & CLI)
- Gün 7 ön işleme pipeline'ı ile Gün 8 etiket kodlaması ve baseline modelleri `train_baseline_models` altında birleştirildi.
- Etiket kodlaması stratified train/test ayrımından **önce** çalıştırıldı; bölme ikili `0/1` etiketler üzerinden gerçekleştirildi. Preprocessor yalnızca `X_train` üzerinde fit edildi; `X_test` verisinde yalnızca transform çalıştırıldı.
- `scripts.train_baseline_models` CLI betiği yazılarak komut satırından CSV kabul eden ve stdout'a JSON metrik raporu basan yapı kuruldu. Betik diske kalıcı model kaydetmemekte ve tahmin serisini rapora sızdırmamaktadır.

---

## Karşılaşılan Zorluklar

| Sorun | Çözüm |
| :--- | :--- |
| `pytest.warns(None)` kullanımının pytest 8+ sürümünde hata vermesi. | Context manager kaldırılıp test `-W error` altında yürütüldü. |
| Sentetik test verisinde mükerrer satır simülasyonunun rastgele sayılar üretmesi. | Test fixture'ı ilk satırları birebir kopyalayacak şekilde düzeltildi. |

---

## Test ve Sonuç

- Baseline modeller, ikili etiket kodlama, metrikler ve CLI için 45 yeni test eklendi.
- Toplam **213 otomatik test** (`python -m pytest -q -W error`) 0 hata ve 0 uyarı ile tamamlandı. (Bu sayı yazılım test sonucudur, model accuracy skoru değildir).
- Bağımsız teknik inceleme `PASS — Düzeltme gerektiren bulgu yok` sonucuyla tamamlandı.

---

## Öğrenilenler

- **Baseline Referansı:** Karmaşık modellere geçmeden önce kural bazlı ve doğrusal modellerle alt sınırı belirlemenin önemi.
- **Sınıf Dengesizliği:** `class_weight="balanced"` kullanımının recall ve F1 metriklerine olumlu etkisi.

---

## Henüz Uygulanmayanlar (Sonraki Adımlar)

- [ ] `RandomForestClassifier` eğitimi ve hiperparametre denemeleri (Gün 9).
- [ ] ROC-AUC, Precision-Recall eğrisi ve nihai model seçimi (Gün 10).
- [ ] Joblib model serileştirme ve batch inference.

---

## Referanslar

- **Branch:** `feature/20-baseline-model`
- **Sub-Issue:** [#20](https://github.com/mustafaemre027/securewatch-ai/issues/20)
- **ML Dokümanı:** [docs/architecture/07-ml-training-and-inference.md](../architecture/07-ml-training-and-inference.md)
- **Değerlendirme Raporu:** [docs/model-evaluation/day-08-baseline-report.md](../model-evaluation/day-08-baseline-report.md)

### Git Commit Mesajları

```text
[11:24] (96af05a) feat(ml): implement binary label encoding service
[12:19] (c92632f) feat(ml): add binary classification metrics
[13:24] (b0b0a06) feat(ml): add dummy classifier baseline training
[14:18] (1aaf6b9) feat(ml): add logistic regression training with balanced class weight
[17:52] (0650272) feat(ml): add baseline training workflow
[18:00] (22a11c5) docs(ml): document baseline model evaluation
```
