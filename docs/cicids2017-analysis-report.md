# CIC-IDS2017 Veri Seti Analiz Raporu

## 1. Amaç
Bu raporun amacı, SecureWatch AI projesinin Gün 2 çalışmaları kapsamında UNSW-NB15 veri setinden geçiş yapılan **CIC-IDS2017** veri setinin yapısal ve niteliksel analizini gerçekleştirmektir. Elde edilen bulgular, model eğitim aşaması öncesinde veri ön işleme, veri temizleme ve mimari kararlar için temel oluşturacaktır.

## 2. Veri Setinin Resmî Kaynağı
Veri seti, New Brunswick Üniversitesi bünyesindeki Kanada Siber Güvenlik Enstitüsü (Canadian Institute for Cybersecurity - UNB) tarafından sağlanmaktadır.
*   **Kaynak Bağlantısı:** [CIC-IDS2017 Dataset](https://www.unb.ca/cic/datasets/ids-2017.html)

## 3. Analiz Kapsamı
Projenin ağ trafiği analizi ve saldırı tespiti hedeflerine yönelik olarak, ham PCAP dosyaları yerine siber güvenlik alanında standart kabul edilen **MachineLearningCSV** sürümü kullanılmıştır. Analiz süreci, tüm dosyaların taranması, bellek optimizasyonu için parçalı okuma (chunking), etiketlerin temizlenmesi ve veri kalitesinin (NaN, Infinity, mükerrer satırlar) belirlenmesini içermektedir.

## 4. Kullanılan 8 CSV Dosyası
CIC-IDS2017 MachineLearningCSV paketi içerisinde yer alan 8 adet resmî CSV dosyasının tamamı analiz edilmiştir:
1.  `Monday-WorkingHours.pcap_ISCX.csv`
2.  `Tuesday-WorkingHours.pcap_ISCX.csv`
3.  `Wednesday-workingHours.pcap_ISCX.csv`
4.  `Thursday-WorkingHours-Morning-WebAttacks.pcap_ISCX.csv`
5.  `Thursday-WorkingHours-Afternoon-Infiltration.pcap_ISCX.csv`
6.  `Friday-WorkingHours-Morning.pcap_ISCX.csv`
7.  `Friday-WorkingHours-Afternoon-PortScan.pcap_ISCX.csv`
8.  `Friday-WorkingHours-Afternoon-DDos.pcap_ISCX.csv`

## 5. Veri Setinin Genel Boyutu
*   **CSV Dosyası Sayısı:** 8 adet
*   **Toplam Kayıt Sayısı:** 2.830.743 satır
*   **Özellik (Sütun) Sayısı:** 79 adet
*   **Eksik Label Sayısı:** 0 adet

## 6. Dosya Bazında Analiz Sonuçları
Aşağıdaki tablo, veri setini oluşturan 8 dosyanın kendi içindeki kayıt sayılarını ve veri kalitesi metriklerini göstermektedir:

| Dosya Adı | Satır Sayısı | Normal Kayıt | Saldırı Kaydı | NaN Sayısı | Infinity Sayısı | Duplicate Sayısı |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `Monday-WorkingHours.pcap_ISCX.csv` | 529.918 | 529.918 | 0 | 0 | 0 | 16.745 |
| `Tuesday-WorkingHours.pcap_ISCX.csv` | 445.909 | 432.074 | 13.835 | 0 | 382 | 40.590 |
| `Wednesday-workingHours.pcap_ISCX.csv` | 692.703 | 440.031 | 252.672 | 1.358 | 1.942 | 96.082 |
| `Thursday-WorkingHours-Morning-WebAttacks.pcap_ISCX.csv` | 170.366 | 168.186 | 2.180 | 0 | 74 | 22.408 |
| `Thursday-WorkingHours-Afternoon-Infiltration.pcap_ISCX.csv` | 288.602 | 288.566 | 36 | 0 | 971 | 37.915 |
| `Friday-WorkingHours-Morning.pcap_ISCX.csv` | 191.033 | 189.067 | 1.966 | 0 | 102 | 17.653 |
| `Friday-WorkingHours-Afternoon-PortScan.pcap_ISCX.csv` | 286.467 | 127.537 | 158.930 | 0 | 185 | 16.480 |
| `Friday-WorkingHours-Afternoon-DDos.pcap_ISCX.csv` | 225.745 | 97.718 | 128.027 | 0 | 720 | 8.606 |
| **Genel Toplam** | **2.830.743** | **2.273.097** | **557.646** | **1.358** | **4.376** | **256.479** |

## 7. Genel Çok Sınıflı Etiket Dağılımı
Veri setindeki normalize edilmiş ve boşlukları temizlenmiş 15 farklı saldırı/normal sınıfının dağılımı şu şekildedir:

1.  `BENIGN` (Normal): 2.273.097 (%80,30)
2.  `DOS HULK`: 231.073 (%8,16)
3.  `PORTSCAN`: 158.930 (%5,61)
4.  `DDOS`: 128.027 (%4,52)
5.  `DOS GOLDENEYE`: 10.293 (%0,36)
6.  `FTP-PATATOR`: 7.938 (%0,28)
7.  `SSH-PATATOR`: 5.897 (%0,21)
8.  `DOS SLOWLORIS`: 5.796 (%0,20)
9.  `DOS SLOWHTTPTEST`: 5.499 (%0,19)
10. `BOT`: 1.966 (%0,07)
11. `WEB ATTACK - BRUTE FORCE`: 1.507 (%0,05)
12. `WEB ATTACK - XSS`: 652 (%0,02)
13. `INFILTRATION`: 36 (%0,001%)
14. `WEB ATTACK - SQL INJECTION`: 21 (%0,0007%)
15. `HEARTBLEED`: 11 (%0,0004%)

## 8. Genel İkili Sınıf Dağılımı
Projenin ilk modeli için tasarlanan ikili sınıflandırma (Normal/Saldırı) dağılımı:
*   **Normal (0 - BENIGN):** 2.273.097 adet (%80,30)
*   **Saldırı (1 - Tüm Saldırılar):** 557.646 adet (%19,70)

## 9. Veri Kalitesi Bulguları
*   **Eksik Label Durumu:** `Label` sütununda eksik (null) değer bulunmamıştır.
*   **Eksik Veri (NaN):** Veri setinde toplam **1.358** adet `NaN` değer bulunmaktadır. Bu değerlerin tamamı akış hızlarını temsil eden sayısal özelliklerde (özellikle `Flow Bytes/s`) toplanmıştır.
*   **Sonsuz Değer (Infinity):** Veri setinde toplam **4.376** adet `Infinity` (sonsuz) değer tespit edilmiştir. Bunlar `Flow Bytes/s` ve `Flow Packets/s` sütunlarında bulunmaktadır.
*   **Mükerrer Kayıt (Duplicate):** Her dosya kendi içinde analiz edildiğinde toplam **256.479** mükerrer satır tespit edilmiştir. Bu durum özellikle aynı akışın birden fazla kez kaydedilmesinden kaynaklanmaktadır.
*   **Tekrarlanan Özellik İsimleri:** `Fwd Header Length` ve `Fwd Header Length.1` şeklinde aynı bilgiyi taşıyan mükerrer sütunlar tespit edilmiştir.

## 10. Sınıf Dengesizliği Değerlendirmesi
Veri setinde belirgin bir sınıf dengesizliği (class imbalance) mevcuttur. Normal trafik oranı %80,30 iken, toplam saldırı oranı %19,70'tir. Çok sınıflı analiz yapılması durumunda `Heartbleed` (11 adet) ve `Web Attack - SQL Injection` (21 adet) gibi sınıfların çok az örneğe sahip olması, modelin bu saldırıları öğrenmesini zorlaştıracaktır.

## 11. Ön İşleme İçin Alınan Kararlar
*   **İkili Etiketleme:** İlk model geliştirme aşamasında hedef değişken `Label` ikili sınıflandırmaya tabi tutulacaktır (`BENIGN` = 0, diğer tüm saptanan saldırı sınıfları = 1).
*   **NaN ve Infinity Yönetimi:** Model eğitiminden önce `NaN` değerleri sütun ortalaması veya medianı ile doldurulacak, `Infinity` değerleri ise o sütunun maksimum değeriyle değiştirilecek veya ilgili satırlar elenecektir.
*   **Duplicate Temizliği:** Tekrarlanan (duplicate) kayıtlar, modelin ezberlemesini (overfitting) önlemek amacıyla eğitim seti oluşturulurken elenecektir.
*   **Mükerrer Sütun Eleme:** Aynı veriyi içeren `Fwd Header Length.1` sütunu modelleme öncesinde veri setinden düşürülecektir.
*   **Dosya Yönetimi:** Ham CSV dosyaları büyük boyutları nedeniyle Git repository'sine eklenmeyecek, `.gitignore` kuralları ile engellenmeye devam edilecektir.

## 12. Proje Açısından Sonuç ve Değerlendirme
UNSW-NB15 veri setine kıyasla CIC-IDS2017, daha güncel saldırı vektörlerini (örneğin modern DDoS, Web ve Infiltration saldırıları) barındırması ve daha zengin bir özellik setine (79 sütun) sahip olması nedeniyle SecureWatch AI platformuna daha yüksek karar destek doğruluğu sağlayacaktır. Gün 2 analizinde elde edilen bu metrikler, Faz 3'te geliştirilecek makine öğrenmesi pipeline'ı için yol haritası niteliğindedir.
