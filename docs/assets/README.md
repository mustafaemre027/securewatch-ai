# Görsel Varlıklar

Bu dizin, SecureWatch AI projesine ait tüm görsel ve marka varlıklarını barındırır.

## Dizin Yapısı

```
docs/assets/
├── README.md
├── brand/          # Marka varlıkları
├── mockups/        # UI/UX ekran tasarımları
└── screenshots/    # Tamamlanan uygulama ekran görüntüleri
```

## Kullanım Kuralları

### brand/

- Logo, uygulama ikonu, renk paleti ve diğer marka varlıkları burada saklanır.
- Dosya adlarında kebab-case kullanılmalıdır (ör. `securewatch-logo.svg`, `color-palette.png`).

### mockups/

- UI geliştirmeye başlamadan önce ilgili ekranın mockup'ı hazırlanmalı ve gözden geçirilmelidir.
- Mockup dosyaları, ilişkili oldukları Issue veya Pull Request numarasıyla bağlantılı olmalıdır.
- Dosya adlarında kebab-case kullanılmalıdır (ör. `login-screen-v1.png`, `dashboard-layout-v2.png`).

### screenshots/

- Uygulama tamamlandıktan sonra ekran görüntüleri burada saklanır.
- Her ekran görüntüsü, ilişkili olduğu Issue/PR ile bağlantılı olmalıdır.
- Dosya adlarında kebab-case kullanılmalıdır (ör. `analysis-results.png`, `incident-detail.png`).

## Önemli Notlar

- Bu dizin yalnızca görsel varlıklar içindir; kod veya dokümantasyon dosyaları buraya eklenmemelidir.
- Şimdilik gerçek logo, mockup veya ekran görüntüsü üretilmemiştir. İlgili aşamalarda eklenecektir.
- Tüm görsel varlıklar, projenin [implementation_plan.md](../../implementation_plan.md) dosyasında tanımlanan aşama ve kilometre taşlarıyla ilişkilendirilmelidir.
