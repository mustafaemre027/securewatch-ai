# Staj Günlüğü — Gün 2

## Temel Bilgiler

- **Tarih:** 14.07.2026
- **Faz:** Faz 1 — Veri Analizi ve Sistem Mimarisi
- **EPIC Issue:** [#2](https://github.com/mustafaemre027/securewatch-ai/issues/2)
- **Çalışılan Sub-Issue'lar:**
  - [#13](https://github.com/mustafaemre027/securewatch-ai/issues/13) — [Faz-1] Gün 2: CIC-IDS2017 Veri Analizi ve Sütun Sözlüğü
- **Branch:** `feature/13-cicids2017-dataset-analysis-v2`
- **PR:** [#35](https://github.com/mustafaemre027/securewatch-ai/pull/35)

---

## Hedef

1.  CIC-IDS2017 veri setindeki 8 adet MachineLearningCSV dosyasının taranması ve yapısal özelliklerinin keşfedilmesi.
2.  Veri kalitesini (NaN, Infinity, mükerrer kayıtlar ve tekrarlı sütunlar) belirleyecek tekrarlanabilir bir analiz betiği hazırlanması.
3.  Elde edilen bulgular doğrultusunda ön işleme kararlarını içeren Veri Seti Analiz Raporu ve Sütun Sözlüğü dokümanlarının oluşturulması.

---

## Yapılanlar

### 1. Keşifçi Veri Analizi Betiğinin Geliştirilmesi (#13)
- `data/analyze.py` analiz betiği geliştirildi.
- Dosya boyutu büyük (toplam ~2.8 milyon satır) olduğu için bellek tüketimini optimize etmek amacıyla pandas kütüphanesinin `chunksize` parametresi kullanılarak parçalı okuma altyapısı kuruldu.
- Her chunk okunduğunda sütun adlarının başındaki ve sonundaki boşluklar temizlendi (`strip`).
- Eksik veriler (`NaN`) ve sonsuz sayısal değerler (`Infinity`) her sütun bazında sayıldı.
- Mükerrer satırların (duplicate) tespiti için `pd.util.hash_pandas_object` ile satır seviyesinde hashing yapıldı ve benzersiz hash seti (`seen_hashes`) üzerinden çakışmalar sayıldı.
- `Label` sütunundaki değerler normalleştirilerek büyük harfe çevrildi ve encoding hataları giderildi.

### 2. Analiz Sonuçlarının Dokümantasyonu
- `docs/cicids2017-analysis-report.md` dosyası oluşturularak elde edilen veri kalitesi metrikleri ve sınıf dağılımları raporlandı:
    - **Toplam Kayıt:** 2.830.743 satır
    - **Sütun Sayısı:** 79 adet
    - **NaN Sayısı:** 1.358 adet (özellikle `Flow Bytes/s` sütununda)
    - **Infinity Sayısı:** 4.376 adet (`Flow Bytes/s` ve `Flow Packets/s` sütunlarında)
    - **Mükerrer Satır:** 256.479 adet
    - **Tekrarlı Sütun:** `Fwd Header Length.1` (aynı bilgiyi içeren mükerrer sütun)
    - **Sınıf Dağılımı:** `BENIGN` (Normal) oranı %80,30 iken, saptanan 14 farklı saldırı sınıfının toplam oranı %19,70'tir. Belirgin bir sınıf dengesizliği (class imbalance) tespit edilmiştir.
- `docs/cicids2017-column-dictionary.md` dosyası oluşturularak veri setindeki 79 sütunun tamamının tipi, kategorisi, tanımı ve ön işleme aşamasındaki değerlendirme notları tablo halinde belgelendi.

---

## Karşılaşılan Zorluklar

| Sorun | Çözüm |
| :--- | :--- |
| 2.8 milyon satırlık verinin tek seferde pandas ile okunması yüksek bellek tüketimi riski oluşturdu. | Verinin `chunksize=100000` parametresi kullanılarak parçalı okunması sağlandı; bu yöntem tam DataFrame'in bellekte tutulma ihtiyacını azaltmıştır. |
| Orijinal veri setindeki bazı `Label` değerlerinde görünmeyen boşluklar ve geçersiz karakter kodlamaları (anomaliler) mevcuttu. | Regex tabanlı normalizasyon ile `BENIGN` ve saldırı etiketleri temizlendi, çok sınıflı dağılım netleştirildi. |

---

## Değişiklik Özeti

| Dosya | Değişiklik |
| :--- | :--- |
| `data/analyze.py` | Bellek optimizasyonlu veri analiz scripti oluşturuldu. |
| `docs/cicids2017-analysis-report.md` | Detaylı veri seti kalitesi ve sınıf dağılımı raporu hazırlandı. |
| `docs/cicids2017-column-dictionary.md` | 79 sütun için açıklamaları ve ön işleme notlarını barındıran veri sözlüğü oluşturuldu. |

---

## Öğrenilenler

- Büyük veri setlerini parça parça işleyerek RAM sınırları dahilinde çalışabilme (chunking yöntemi).
- Veri sızıntısını önlemek ve modelin ezberlemesini (overfitting) engellemek için model eğitimi öncesinde mükerrer kayıtların elenmesi gerektiği.
- CIC-IDS2017 veri setindeki bazı akış parametrelerinin NaN ve Infinity içermesi sebebiyle model eğitimi öncesi bu değerlerin ele alınması gerekliliği.

---

## Referanslar

- **Branch:** `feature/13-cicids2017-dataset-analysis-v2`
- **PR:** [#35](https://github.com/mustafaemre027/securewatch-ai/pull/35)
- **EPIC Issue:** [#2](https://github.com/mustafaemre027/securewatch-ai/issues/2)
- **Sub-Issue:** [#13](https://github.com/mustafaemre027/securewatch-ai/issues/13)
- **İlgili Commit'ler:**
    - `6955612` (chore(data): configure dataset directories)
    - `9ddf1cc` (feat(data): add CIC-IDS2017 analysis script)
    - `d9e3fd4` (docs(data): document CIC-IDS2017 analysis)
