# Gün 7 – Ön İşleme Pipeline'ı ve Veri Sızıntısı Önleme

## Temel Bilgiler

- **Tarih:** 22.07.2026 Çarşamba
- **Faz:** Faz 3 — Veri İşleme ve Makine Öğrenmesi
- **EPIC Issue:** [#4](https://github.com/mustafaemre027/securewatch-ai/issues/4)
- **Sub-Issue:** [#19](https://github.com/mustafaemre027/securewatch-ai/issues/19) — Gün 7: Ön İşleme Pipeline'ı
- **Branch:** `feature/19-preprocessing-pipeline`

---

## Hedef

1. Ön işleme bağımlılıklarının (`pandas`, `numpy`, `scikit-learn`, `joblib`) `requirements.txt` dosyasına tam pin (`==`) olarak eklenmesi.
2. Ham CIC-IDS2017 verisini temizleyen, `Label` sütununu ayıran ve 77 deterministik sayısal model özelliğine dönüştüren `prepare_training_data` servisinin geliştirilmesi.
3. Eksik verileri ve sayısal ölçeklendirmeyi yöneten unfitted `build_sklearn_preprocessing_pipeline` katmanının kurulması.
4. `fit` işlemini yalnızca eğitim verisinde çalıştıran, sızıntı korumalı (leakage-safe) `split_and_transform_data` servisinin yazılması.
5. Mutable pandas nesnelerini yalıtan defensive-copy mimarisinin kurulması ve kapsamlı testlerin tamamlanması.

---

## Yapılanlar

### 1. Bağımlılıkların Eklendiği Çevre Hazırlığı
`backend/requirements.txt` içerisine `pandas==2.2.3`, `numpy==2.2.3`, `scikit-learn==1.6.1` ve `joblib==1.4.2` exact pin sürümleriyle eklendi.

### 2. Eğitim Verisi Hazırlama Servisi (`prepare_training_data`)
- Ham verideki 78 canonical CIC-IDS2017 özelliği doğrulandı. `Label` sütunu zorunlu kılınarak özellik matrisinden ayrıldı.
- `Fwd Header Length.1` redundant sütunu düşürülerek model girdisi 77 deterministik sayısal özelliğe indirgendi.
- `Destination Port` dahil tüm özellikler sayısal türe dönüştürüldü; `±inf` değerler `NaN` yapıldı.
- Mükerrer satırlar split öncesinde `drop_duplicates()` ile temizlendi.

### 3. Scikit-Learn Transformer Builder (`build_sklearn_preprocessing_pipeline`)
- Sayısal özellikler için median `SimpleImputer` (`keep_empty_features=True`) ve `StandardScaler` adımlarından oluşan scikit-learn `Pipeline` nesnesi yapılandırıldı.
- Gelecek kullanım için most-frequent imputer ve unknown-safe `OneHotEncoder` barındıran opsiyonel kategorik pipeline eklendi.
- Builder'ın her çağrıda yeni, unfitted `ColumnTransformer(remainder="drop")` döndürmesi sağlandı.

### 4. Veri Sızıntısını Önleyen Train/Test Ayrımı (`split_and_transform_data`)
- Split işlemi preprocessor fit edilmeden önce `%80 train / %20 test` ve `stratify=targets` parametreleriyle yapıldı. Stratification başarısızlığında HTTP 422 `AppException` fırlatıldı.
- Preprocessor `fit_transform` işlemi **yalnızca** `X_train` üzerinde çalıştırıldı; `X_test` verisinde **yalnızca** `transform` çağrılarak test kümesinden sızıntı engellendi.

### 5. Defensive-Copy İzolasyonu ve Test Kapsamı
- `@dataclass(frozen=True)` konteynerinin pandas nesnelerini derinden korumadığı fark edilerek `copy(deep=True)` yalıtımı eklendi; indeksler `tuple` tipine çevrildi.
- Sızıntı koruması, imputer/scaler doğrulamaları ve mutasyon engelleme senaryolarını içeren testler yazıldı.

---

## Karşılaşılan Zorluklar

| Sorun | Çözüm |
| :--- | :--- |
| Dondurulmuş dataclass'ın iç pandas buffer'larını mutate edilmekten koruyamaması. | `split_and_transform_data` içinde `copy(deep=True)` kullanıldı; `train_indices` ve `test_indices` alanları Python `tuple` yapıldı. |
| Scikit-learn `ColumnTransformer` çıktısında sütun isimlerinin `num__` ön eki alması sonucu testlerde `KeyError` çıkması. | Testlerde dinamik `result.X_test.columns[0]` ismi ve `.iloc` indekslemesi kullanıldı. |

---

## Test ve Sonuç

- Ön işleme pipeline'ı için 26 yeni test eklendi.
- Toplam **116 test** (`python -m pytest -q -W error`) 0 hata ve 0 uyarı ile tamamlandı.
- `compileall`, `pip check` ve `git diff --check` denetimleri başarıyla geçti.

---

## Öğrenilenler

- **Data Leakage Koruması:** `fit_transform`'un yalnızca eğitim kümesinde, `transform`'un ise test kümesinde çağrılmasının önemi.
- **Pandas Memory & Immutability:** Dataclass `frozen=True` ifadesinin karmaşık nesneleri derinden korumadığı, açık defensive copy gerektiğini öğrenmek.

---

## Henüz Uygulanmayanlar (Sonraki Adımlar)

- [ ] `Label` sütunu etiket kodlaması (`BENIGN` -> `0`, Saldırı -> `1`) yapılmadı (Gün 8 kapsamı).
- [ ] Baseline (`DummyClassifier`), Logistic Regression ve Random Forest eğitilmedi.
- [ ] Joblib model serialization ve batch inference yazılmadı.

---

## Referanslar

- **Branch:** `feature/19-preprocessing-pipeline`
- **Sub-Issue:** [#19](https://github.com/mustafaemre027/securewatch-ai/issues/19)
- **ML Dokümanı:** [docs/architecture/07-ml-training-and-inference.md](../architecture/07-ml-training-and-inference.md)

### Git Commit Mesajları

```text
[11:12] (923cbd1) chore(deps): add ML preprocessing dependencies
[11:32] (d7a86c8) feat(preprocessing): prepare CIC-IDS2017 training data
[12:07] (b5ae87c) feat(preprocessing): build sklearn preprocessing pipeline
[12:50] (5c1637b) feat(preprocessing): add leakage-safe train test split
[14:22] (f7e07b3) fix(preprocessing): isolate mutable split data
[15:08] (aa7be0b) docs(preprocessing): document leakage-safe pipeline
```
