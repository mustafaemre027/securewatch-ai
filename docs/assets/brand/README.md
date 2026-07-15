# Marka Kimliği ve Tasarım Sistemi (Brand Assets)

Bu dizin, SecureWatch AI projesinin marka kimliğini tanımlayan logoları ve renk sistemini barındırır.

## Görsel Varlıklar

1.  **Logo (`securewatch-ai-logo.svg`):**
    *   Projenin ana logosudur. Yatay düzlemde siber güvenlik ve ağ analizi simgesi (kalkan ve bağlantılı ağ düğümleri) ile modern "SecureWatch AI" metninden oluşur.
    *   [securewatch-ai-logo.svg](securewatch-ai-logo.svg) üzerinden erişilebilir.

2.  **Simge / Mark (`securewatch-ai-mark.svg`):**
    *   Projenin logosundaki kalkan ve ağ simgesinin metin içermeyen, kare/yuvarlak alanlarda kullanılabilen ikon versiyonudur. Uygulama ikonu (favicon) veya avatar olarak kullanılır.
    *   [securewatch-ai-mark.svg](securewatch-ai-mark.svg) üzerinden erişilebilir.

3.  **Renk Paleti Şeması (`color-palette.svg`):**
    *   Projenin tasarım sisteminde kullanılan ana renkleri görselleştiren şemadır.
    *   [color-palette.svg](color-palette.svg) üzerinden erişilebilir.

## Renk Sistemi (Tasarım Kodları)

Uygulamanın arayüzünde kullanılan renkler ve kullanım alanları:

| Renk İsmi | HEX Kodu | RGB Değeri | Kullanım Alanı / Amacı |
| :--- | :--- | :--- | :--- |
| **Deep Dark** | `#0A0E1A` | `rgb(10, 14, 26)` | Genel uygulama arka planı |
| **Rich Navy** | `#0B132B` | `rgb(11, 19, 43)` | Birincil kartlar, yan menü ve ana paneller |
| **Space Blue** | `#1C2541` | `rgb(28, 37, 65)` | İkincil paneller, buton arka planları |
| **Muted Blue** | `#3A506B` | `rgb(58, 80, 107)` | Sınırlar (borders), pasif ikonlar ve ikincil metinler |
| **Cyber Cyan** | `#5BC0BE` | `rgb(91, 192, 190)` | Birincil aksiyonlar, siber güvenlik vurguları ve aktif durumlar |
| **AI Teal** | `#6FFFE9` | `rgb(111, 255, 233)` | Yapay zekâ analiz vurguları, kritik başarı durumları ve vurgu metinleri |

## Tipografi

Tasarım sisteminde dış kaynaklı font bağımlılıklarını önlemek ve hızlı yüklenmeyi sağlamak amacıyla standart sistem font ailesi tercih edilmiştir:
```css
font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
```
