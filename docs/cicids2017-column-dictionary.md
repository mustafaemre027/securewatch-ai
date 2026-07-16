# CIC-IDS2017 Veri Sözlüğü (Column Dictionary)

Bu belge, **CIC-IDS2017** veri setinde yer alan **79 sütunun** tamamının tanımını, ait olduğu kategoriyi, veri tipini ve veri ön işleme aşamasındaki değerlendirme notlarını içerir.

## Sütun Listesi ve Tanımları

| Sıra | Sütun Adı | Veri Tipi | Kategori | Kısa Açıklama | Ön İşleme Notu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `Destination Port` | Integer | Flow bilgileri | Hedef port numarası | Kategoriye dönüştürülebilir veya sayısal olarak ölçeklenebilir. |
| 2 | `Flow Duration` | Integer | Flow bilgileri | Akışın toplam süresi (mikrosaniye) | Sayısal ölçeklendirme uygulanacaktır. |
| 3 | `Total Fwd Packets` | Integer | Paket sayıları | İleri yönde gönderilen toplam paket sayısı | Sayısal ölçeklendirme uygulanacaktır. |
| 4 | `Total Backward Packets` | Integer | Paket sayıları | Geri yönde gönderilen toplam paket sayısı | Sayısal ölçeklendirme uygulanacaktır. |
| 5 | `Total Length of Fwd Packets` | Float | Paket uzunlukları | İleri yöndeki paketlerin toplam boyutu (byte) | Sayısal ölçeklendirme uygulanacaktır. |
| 6 | `Total Length of Bwd Packets` | Float | Paket uzunlukları | Geri yöndeki paketlerin toplam boyutu (byte) | Sayısal ölçeklendirme uygulanacaktır. |
| 7 | `Fwd Packet Length Max` | Float | Paket uzunlukları | İleri yöndeki maksimum paket boyutu | Sayısal ölçeklendirme uygulanacaktır. |
| 8 | `Fwd Packet Length Min` | Float | Paket uzunlukları | İleri yöndeki minimum paket boyutu | Sayısal ölçeklendirme uygulanacaktır. |
| 9 | `Fwd Packet Length Mean` | Float | Paket uzunlukları | İleri yöndeki paketlerin ortalama boyutu | Sayısal ölçeklendirme uygulanacaktır. |
| 10 | `Fwd Packet Length Std` | Float | Paket uzunlukları | İleri yöndeki paket boyutlarının standart sapması | Sayısal ölçeklendirme uygulanacaktır. |
| 11 | `Bwd Packet Length Max` | Float | Paket uzunlukları | Geri yöndeki maksimum paket boyutu | Sayısal ölçeklendirme uygulanacaktır. |
| 12 | `Bwd Packet Length Min` | Float | Paket uzunlukları | Geri yöndeki minimum paket boyutu | Sayısal ölçeklendirme uygulanacaktır. |
| 13 | `Bwd Packet Length Mean` | Float | Paket uzunlukları | Geri yöndeki paketlerin ortalama boyutu | Sayısal ölçeklendirme uygulanacaktır. |
| 14 | `Bwd Packet Length Std` | Float | Paket uzunlukları | Geri yöndeki paket boyutlarının standart sapması | Sayısal ölçeklendirme uygulanacaktır. |
| 15 | `Flow Bytes/s` | Float | Paket hızları | Saniye başına aktarılan akış byte miktarı | **Kritik:** NaN ve Infinity değerler içerir. Temizlik gereklidir. |
| 16 | `Flow Packets/s` | Float | Paket hızları | Saniye başına aktarılan akış paket miktarı | **Kritik:** Infinity değerler içerir. Temizlik gereklidir. |
| 17 | `Flow IAT Mean` | Float | IAT zaman özellikleri | İki akış arasındaki ortalama süre (IAT) | Sayısal ölçeklendirme uygulanacaktır. |
| 18 | `Flow IAT Std` | Float | IAT zaman özellikleri | Akışlar arası sürenin standart sapması | Sayısal ölçeklendirme uygulanacaktır. |
| 19 | `Flow IAT Max` | Float | IAT zaman özellikleri | Akışlar arasındaki maksimum süre | Sayısal ölçeklendirme uygulanacaktır. |
| 20 | `Flow IAT Min` | Float | IAT zaman özellikleri | Akışlar arasındaki minimum süre | Sayısal ölçeklendirme uygulanacaktır. |
| 21 | `Fwd IAT Total` | Float | IAT zaman özellikleri | İleri yöndeki akışlar arası toplam süre | Sayısal ölçeklendirme uygulanacaktır. |
| 22 | `Fwd IAT Mean` | Float | IAT zaman özellikleri | İleri yöndeki akışlar arası ortalama süre | Sayısal ölçeklendirme uygulanacaktır. |
| 23 | `Fwd IAT Std` | Float | IAT zaman özellikleri | İleri yöndeki akışlar arası sürenin standart sapması | Sayısal ölçeklendirme uygulanacaktır. |
| 24 | `Fwd IAT Max` | Float | IAT zaman özellikleri | İleri yöndeki akışlar arası maksimum süre | Sayısal ölçeklendirme uygulanacaktır. |
| 25 | `Fwd IAT Min` | Float | IAT zaman özellikleri | İleri yöndeki akışlar arası minimum süre | Sayısal ölçeklendirme uygulanacaktır. |
| 26 | `Bwd IAT Total` | Float | IAT zaman özellikleri | Geri yöndeki akışlar arası toplam süre | Sayısal ölçeklendirme uygulanacaktır. |
| 27 | `Bwd IAT Mean` | Float | IAT zaman özellikleri | Geri yöndeki akışlar arası ortalama süre | Sayısal ölçeklendirme uygulanacaktır. |
| 28 | `Bwd IAT Std` | Float | IAT zaman özellikleri | Geri yöndeki akışlar arası sürenin standart sapması | Sayısal ölçeklendirme uygulanacaktır. |
| 29 | `Bwd IAT Max` | Float | IAT zaman özellikleri | Geri yöndeki akışlar arası maksimum süre | Sayısal ölçeklendirme uygulanacaktır. |
| 30 | `Bwd IAT Min` | Float | IAT zaman özellikleri | Geri yöndeki akışlar arası minimum süre | Sayısal ölçeklendirme uygulanacaktır. |
| 31 | `Fwd PSH Flags` | Integer | TCP flag özellikleri | İleri yöndeki PSH bayrağı sayısı | Sayısal ölçeklendirme veya One-Hot encoding. |
| 32 | `Bwd PSH Flags` | Integer | TCP flag özellikleri | Geri yöndeki PSH bayrağı sayısı | Sayısal ölçeklendirme veya One-Hot encoding. |
| 33 | `Fwd URG Flags` | Integer | TCP flag özellikleri | İleri yöndeki URG bayrağı sayısı | Sayısal ölçeklendirme veya One-Hot encoding. |
| 34 | `Bwd URG Flags` | Integer | TCP flag özellikleri | Geri yöndeki URG bayrağı sayısı | Sayısal ölçeklendirme veya One-Hot encoding. |
| 35 | `Fwd Header Length` | Integer | Header özellikleri | İleri yöndeki TCP başlık uzunluğu | Sayısal ölçeklendirme uygulanacaktır. |
| 36 | `Bwd Header Length` | Integer | Header özellikleri | Geri yöndeki TCP başlık uzunluğu | Sayısal ölçeklendirme uygulanacaktır. |
| 37 | `Fwd Packets/s` | Float | Paket hızları | Saniye başına ileri yönde aktarılan paket sayısı | Sayısal ölçeklendirme uygulanacaktır. |
| 38 | `Bwd Packets/s` | Float | Paket hızları | Saniye başına geri yönde aktarılan paket sayısı | Sayısal ölçeklendirme uygulanacaktır. |
| 39 | `Min Packet Length` | Float | Paket uzunlukları | Akıştaki minimum paket boyutu | Sayısal ölçeklendirme uygulanacaktır. |
| 40 | `Max Packet Length` | Float | Paket uzunlukları | Akıştaki maksimum paket boyutu | Sayısal ölçeklendirme uygulanacaktır. |
| 41 | `Packet Length Mean` | Float | Paket uzunlukları | Akıştaki paketlerin ortalama boyutu | Sayısal ölçeklendirme uygulanacaktır. |
| 42 | `Packet Length Std` | Float | Paket uzunlukları | Akıştaki paket boyutlarının standart sapması | Sayısal ölçeklendirme uygulanacaktır. |
| 43 | `Packet Length Variance` | Float | Paket uzunlukları | Akıştaki paket boyutlarının varyansı | Sayısal ölçeklendirme uygulanacaktır. |
| 44 | `FIN Flag Count` | Integer | TCP flag özellikleri | FIN bayrağı taşıyan paketlerin sayısı | Sayısal ölçeklendirme uygulanacaktır. |
| 45 | `SYN Flag Count` | Integer | TCP flag özellikleri | SYN bayrağı taşıyan paketlerin sayısı | Sayısal ölçeklendirme uygulanacaktır. |
| 46 | `RST Flag Count` | Integer | TCP flag özellikleri | RST bayrağı taşıyan paketlerin sayısı | Sayısal ölçeklendirme uygulanacaktır. |
| 47 | `PSH Flag Count` | Integer | TCP flag özellikleri | PSH bayrağı taşıyan paketlerin sayısı | Sayısal ölçeklendirme uygulanacaktır. |
| 48 | `ACK Flag Count` | Integer | TCP flag özellikleri | ACK bayrağı taşıyan paketlerin sayısı | Sayısal ölçeklendirme uygulanacaktır. |
| 49 | `URG Flag Count` | Integer | TCP flag özellikleri | URG bayrağı taşıyan paketlerin sayısı | Sayısal ölçeklendirme uygulanacaktır. |
| 50 | `CWE Flag Count` | Integer | TCP flag özellikleri | CWE bayrağı taşıyan paketlerin sayısı | Sayısal ölçeklendirme uygulanacaktır. |
| 51 | `ECE Flag Count` | Integer | TCP flag özellikleri | ECE bayrağı taşıyan paketlerin sayısı | Sayısal ölçeklendirme uygulanacaktır. |
| 52 | `Down/Up Ratio` | Float | Flow bilgileri | İndirme / Yükleme oranı | Sayısal ölçeklendirme uygulanacaktır. |
| 53 | `Average Packet Size` | Float | Paket uzunlukları | Akıştaki ortalama paket boyutu | Sayısal ölçeklendirme uygulanacaktır. |
| 54 | `Avg Fwd Segment Size` | Float | Paket uzunlukları | İleri yöndeki ortalama segment boyutu | Sayısal ölçeklendirme uygulanacaktır. |
| 55 | `Avg Bwd Segment Size` | Float | Paket uzunlukları | Geri yöndeki ortalama segment boyutu | Sayısal ölçeklendirme uygulanacaktır. |
| 56 | `Fwd Header Length.1` | Integer | Header özellikleri | Tekrarlanan ileri yön başlık uzunluğu | **Tekrarlı Sütun:** Modelleme öncesinde düşürülmelidir. |
| 57 | `Fwd Avg Bytes/Bulk` | Float | Bulk ve subflow özellikleri | CICFlowMeter tarafından üretilen akış özelliği | Sayısal ölçeklendirme veya sabit değer kontrolü. |
| 58 | `Fwd Avg Packets/Bulk` | Float | Bulk ve subflow özellikleri | CICFlowMeter tarafından üretilen akış özelliği | Sayısal ölçeklendirme veya sabit değer kontrolü. |
| 59 | `Fwd Avg Bulk Rate` | Float | Bulk ve subflow özellikleri | CICFlowMeter tarafından üretilen akış özelliği | Sayısal ölçeklendirme veya sabit değer kontrolü. |
| 60 | `Bwd Avg Bytes/Bulk` | Float | Bulk ve subflow özellikleri | CICFlowMeter tarafından üretilen akış özelliği | Sayısal ölçeklendirme veya sabit değer kontrolü. |
| 61 | `Bwd Avg Packets/Bulk` | Float | Bulk ve subflow özellikleri | CICFlowMeter tarafından üretilen akış özelliği | Sayısal ölçeklendirme veya sabit değer kontrolü. |
| 62 | `Bwd Avg Bulk Rate` | Float | Bulk ve subflow özellikleri | CICFlowMeter tarafından üretilen akış özelliği | Sayısal ölçeklendirme veya sabit değer kontrolü. |
| 63 | `Subflow Fwd Packets` | Integer | Bulk ve subflow özellikleri | Alt akışlardaki ileri yön paket sayısı | Sayısal ölçeklendirme uygulanacaktır. |
| 64 | `Subflow Fwd Bytes` | Integer | Bulk ve subflow özellikleri | Alt akışlardaki ileri yön byte sayısı | Sayısal ölçeklendirme uygulanacaktır. |
| 65 | `Subflow Bwd Packets` | Integer | Bulk ve subflow özellikleri | Alt akışlardaki geri yön paket sayısı | Sayısal ölçeklendirme uygulanacaktır. |
| 66 | `Subflow Bwd Bytes` | Integer | Bulk ve subflow özellikleri | Alt akışlardaki geri yön byte sayısı | Sayısal ölçeklendirme uygulanacaktır. |
| 67 | `Init_Win_bytes_forward` | Integer | Window özellikleri | İleri yönde başlatılan pencere boyutu (TCP window) | Sayısal ölçeklendirme uygulanacaktır. |
| 68 | `Init_Win_bytes_backward` | Integer | Window özellikleri | Geri yönde başlatılan pencere boyutu (TCP window) | Sayısal ölçeklendirme uygulanacaktır. |
| 69 | `act_data_pkt_fwd` | Integer | Paket sayıları | İleri yöndeki aktif veri taşıyan paket sayısı | Sayısal ölçeklendirme uygulanacaktır. |
| 70 | `min_seg_size_forward` | Integer | Header özellikleri | İleri yöndeki minimum segment boyutu | Sayısal ölçeklendirme uygulanacaktır. |
| 71 | `Active Mean` | Float | Active/Idle özellikleri | Akışın aktif olduğu ortalama süre | Sayısal ölçeklendirme uygulanacaktır. |
| 72 | `Active Std` | Float | Active/Idle özellikleri | Akışın aktif olduğu sürenin standart sapması | Sayısal ölçeklendirme uygulanacaktır. |
| 73 | `Active Max` | Float | Active/Idle özellikleri | Akışın aktif olduğu maksimum süre | Sayısal ölçeklendirme uygulanacaktır. |
| 74 | `Active Min` | Float | Active/Idle özellikleri | Akışın aktif olduğu minimum süre | Sayısal ölçeklendirme uygulanacaktır. |
| 75 | `Idle Mean` | Float | Active/Idle özellikleri | Akışın boşta (idle) kaldığı ortalama süre | Sayısal ölçeklendirme uygulanacaktır. |
| 76 | `Idle Std` | Float | Active/Idle özellikleri | Akışın boşta kaldığı sürenin standart sapması | Sayısal ölçeklendirme uygulanacaktır. |
| 77 | `Idle Max` | Float | Active/Idle özellikleri | Akışın boşta kaldığı maksimum süre | Sayısal ölçeklendirme uygulanacaktır. |
| 78 | `Idle Min` | Float | Active/Idle özellikleri | Akışın boşta kaldığı minimum süre | Sayısal ölçeklendirme uygulanacaktır. |
| 79 | `Label` | String | Hedef değişken | Trafik bağlantı sınıfı (Normal veya Saldırı Türü) | **Hedef Değişken:** İkili veya çoklu sınıflandırmada hedef olacaktır. |
