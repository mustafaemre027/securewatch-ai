# SecureWatch AI — Fonksiyonel Gereksinimler

Bu belge, SecureWatch AI projesinin işlevsel gereksinimlerini ve bu gereksinimlerin sistem içindeki izlenebilirliğini sağlamak amacıyla oluşturulan numaralandırma sistemini tanımlar.

## 1. Giriş ve Kapsam
SecureWatch AI, yapay zekâ destekli ağ trafiği analizi ve saldırı tespiti yapan bir karar destek platformudur. Bu doküman, MVP sürümünde geliştirilecek tüm işlevsel modüllerin sahip olması gereken özellikleri listeler.

## 2. Gereksinim Numaralandırma Standardı
Tüm gereksinimler `FR-[Bileşen]-[ÜçHaneliSayı]` biçiminde etiketlenmiştir:
*   **URB:** Kullanıcı Yönetimi ve Rol Yetkileri (User & Role-Based Access Control)
*   **DUD:** Ağ Trafiği Veri Yükleme ve Doğrulama (Data Upload & Validation)
*   **MLT:** Makine Öğrenmesi Model Eğitimi ve Karşılaştırma (Machine Learning Training)
*   **DET:** Saldırı Tespiti ve Risk Skorlaması (Detection & Risk Scoring)
*   **INC:** Güvenlik Olayı Yönetimi (Incident Management)
*   **DAB:** Dashboard ve Raporlama (Dashboard & Reporting)
*   **AUD:** Sistem Denetimi ve Audit Log (System Audit Log)

---

## 3. Kullanıcı Yönetimi ve Rol Yetkileri (URB)
*   **FR-URB-001:** Sistem, JWT (JSON Web Token) tabanlı güvenli bir kimlik doğrulama mekanizması sağlamalıdır.
*   **FR-URB-002:** Sistem, kullanıcılar için iki temel rol tanımlamalıdır: Yönetici (Admin) ve Güvenlik Analisti (Analyst).
*   **FR-URB-003:** Parolalar veritabanında düz metin olarak değil, bcrypt algoritması kullanılarak güvenli bir şekilde hashlenmiş olarak saklanmalıdır.
*   **FR-URB-004:** Yalnızca Admin rolüne sahip kullanıcılar yeni analist hesabı oluşturabilmeli, mevcut hesapları listeleyebilmeli ve yetkilerini yönetebilmelidir.
*   **FR-URB-005:** Sistem, tüm API uç noktalarında rol tabanlı erişim kontrolü (RBAC) doğrulaması yapmalıdır.

## 4. Ağ Trafiği Veri Yükleme ve Doğrulama (DUD)
*   **FR-DUD-001:** Yalnızca Analyst rolüne sahip kullanıcılar ağ trafiği CSV (MachineLearningCSV) dosyası yükleyebilmelidir.
*   **FR-DUD-002:** Yüklenen dosyaların boyutu 50MB'ı geçmemelidir. Boyut aşımı durumunda kullanıcıya hata mesajı gösterilmelidir.
*   **FR-DUD-003:** Sistem, yüklenen dosyanın MIME tipini ve `.csv` uzantısını doğrulamalıdır.
*   **FR-DUD-004:** Yüklenen dosyanın bütünlüğünü korumak ve mükerrer yüklemeleri önlemek için dosyanın SHA-256 hash değeri hesaplanıp veritabanında sorgulanmalıdır. Eğer aynı hash değerine sahip bir dosya daha önce yüklenmişse işlem reddedilmelidir.
*   **FR-DUD-005:** Yüklenen CSV dosyasının sütunları, CIC-IDS2017 şemasıyla (Label sütunu hariç 78 adet geçerli özellik) eşleşmelidir. Eksik veya geçersiz sütun içeren dosyalar reddedilmelidir.

## 5. Makine Öğrenmesi Model Eğitimi ve Karşılaştırma (MLT)
*   **FR-MLT-001:** Sistem, 8 adet resmî MachineLearningCSV dosyasını okuyup veri kalitesi analizi (NaN, Infinity, duplicate satır temizliği) yapacak bir ön işleme pipeline'ına sahip olmalıdır.
*   **FR-MLT-002:** Veri sızıntısını (data leakage) önlemek amacıyla Imputer ve Scaler gibi dönüşümler yalnızca eğitim verisinde fit edilmeli, test verisinde sadece uygulanmalıdır (transform).
*   **FR-MLT-003:** Eğitim ve test setleri ayrılırken etiket oranını korumak için stratified split yöntemi kullanılmalıdır.
*   **FR-MLT-004:** Modeller ikili sınıflandırma (Normal/Saldırı) hedefine göre eğitilmelidir (`BENIGN` = 0, diğer tüm saptanan saldırı sınıfları = 1).
*   **FR-MLT-005:** Sistem; DummyClassifier baseline, Logistic Regression ve Random Forest modellerini eğitip karşılaştırabilmelidir.
*   **FR-MLT-006:** Model değerlendirmesi; accuracy, precision, recall, F1, ROC-AUC, FPR (False Positive Rate) ve confusion matrix değerlerini içermelidir.
*   **FR-MLT-007:** Seçilen en başarılı model ve veri ön işleme adımları tek bir scikit-learn Pipeline nesnesi halinde Joblib kütüphanesiyle serialize edilerek saklanmalıdır.

## 6. Saldırı Tespiti ve Risk Skorlaması (DET)
*   **FR-DET-001:** Sistem, yüklenen ağ trafiği CSV dosyaları üzerinde batch tahmin (inference) işlemlerini gerçekleştirmelidir.
*   **FR-DET-002:** Sistem, her bir trafik akışı için modelin ürettiği saldırı olasılığına (`attack_probability`) göre 0-100 arasında bir risk skoru (`risk_score`) üretmelidir.
*   **FR-DET-003:** Sistem, risk skoruna bağlı olarak `LOW`, `MEDIUM`, `HIGH` ve `CRITICAL` risk seviyelerini (`risk_level`) atamalıdır. Risk seviyeleri başlangıçta geçici (provisional) olacak, Gün 10 sonrasında kesinleştirilecektir.
*   **FR-DET-004:** Analiz sonuçları, `DetectionResult` tablosunda; flow record ID, hedef port, tahmin edilen etiket, saldırı olasılığı, risk skoru, risk seviyesi ve özellik snapshot'ı (JSONB) bilgileri ile saklanmalıdır.
*   **FR-DET-005:** Analizler gerçek zamanlı paket dinleme (sniffing) yapılmadan, tamamen yüklenen CSV'ler üzerinden batch şeklinde çalıştırılmalıdır (karar destek prototipi).

## 7. Güvenlik Olayı Yönetimi (INC)
*   **FR-INC-001:** Güvenlik Analisti, `HIGH` veya `CRITICAL` seviyedeki tespit sonuçlarını tek bir tıklama ile yeni bir Güvenlik Olayına (Incident) dönüştürebilmelidir.
*   **FR-INC-002:** Güvenlik Olayları ilk oluşturulduğunda otomatik olarak `OPEN` durumunda başlamalıdır.
*   **FR-INC-003:** Admin ve Analyst, güvenlik olayını kendi üzerine alabilmeli ya da Admin rolündeki bir kullanıcı olayı başka bir analiste atayabilmelidir (`assigned_analyst_id`).
*   **FR-INC-004:** Güvenlik Olayı durum geçişleri yalnızca `OPEN`, `IN_PROGRESS`, `RESOLVED` ve `FALSE_POSITIVE` durumları arasında yapılabilmelidir.
*   **FR-INC-005:** Sistem, her bir güvenlik olayı altına analistlerin yorum eklemesine (`incident_comments`) izin vermelidir.
*   **FR-INC-006:** Bir olay oluşturulmuş bir tespit sonucu veritabanından silinememelidir (`RESTRICT` kısıtı).

## 8. Dashboard ve Raporlama (DAB)
*   **FR-DAB-001:** Dashboard, tamamlanan analiz işlerinin istatistiklerini (toplam analiz, toplam trafik kaydı, normal/şüpheli sayıları) özet kartlar halinde göstermelidir.
*   **FR-DAB-002:** Dashboard, tespit edilen saldırı türlerinin oranlarını ve risk seviyesi dağılımlarını grafiklerle (pie/bar chart) görselleştirmelidir.
*   **FR-DAB-003:** Dashboard, son tespit edilen yüksek riskli kayıtları ve bekleyen aktif olayları listelemelidir.
*   **FR-DAB-004:** Dashboard arayüzü responsive tasarım kurallarına uygun olmalıdır.

## 9. Sistem Denetimi ve Audit Log (AUD)
*   **FR-AUD-001:** Sistem; kullanıcı girişleri, dosya yüklemeleri, olay oluşturma ve durum değişiklikleri gibi tüm kritik eylemleri otomatik olarak audit log tablosuna kaydetmelidir.
*   **FR-AUD-002:** Audit log kayıtları; ilgili kullanıcı ID'si, eylem türü (`action_type`), detaylı açıklama (`description`), istemci IP adresi (`ip_address`) ve zaman damgası içermelidir.
*   **FR-AUD-003:** Bir kullanıcı silindiğinde, veritabanı bütünlüğü gereği denetim kayıtları korunmalı ve silinen kullanıcının ID alanı `SET NULL` yapılarak eylem detayındaki açıklama bilgisi muhafaza edilmelidir.
*   **FR-AUD-004:** Audit log kayıtları yalnızca Admin rolüne sahip kullanıcılar tarafından görüntülenebilmelidir; üzerinde silme veya değiştirme işlemi yapılamamalıdır (salt okunur).
