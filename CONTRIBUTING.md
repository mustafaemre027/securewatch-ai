# Katkıda Bulunma Rehberi

SecureWatch AI projesine katkıda bulunmak için aşağıdaki standartları takip edin.

## Issue Oluşturma

1. Kodlamaya başlamadan önce mutlaka Issue oluşturun.
2. Mevcut Issue'ları kontrol edin, aynı konuda Issue varsa yorum ekleyin.
3. Issue şablonlarını kullanın (`.github/ISSUE_TEMPLATE/`).
4. Uygun label'ları ekleyin (bug, enhancement, documentation, vs.)

## Branch Stratejisi

- `main` branch'i üretim hazır kod içerir.
- Doğrudan `main` branch'ine push yapmayın.
- Her Issue için ayrı bir branch oluşturun.
- Branch adı formatı: `type/issue-number-short-description`

| Prefix | Kullanım |
|--------|----------|
| `docs/` | Dokümantasyon değişiklikleri |
| `feature/` | Yeni özellik geliştirme |
| `fix/` | Hata düzeltme |
| `test/` | Test ekleme/düzeltme |
| `chore/` | Bakım, yapılandırma, bağımlılık |

Örnekler: `docs/12-project-readme`, `feature/18-authentication`, `fix/75-risk-score-calculation`

## Commit Standartları

**Conventional Commits** formatını kullanın:

```
<type>(<scope>): <description>
```

| Type | Açıklama |
|------|----------|
| `feat` | Yeni özellik |
| `fix` | Hata düzeltme |
| `docs` | Dokümantasyon değişikliği |
| `test` | Test ekleme/düzeltme |
| `refactor` | Kod yeniden düzenleme |
| `chore` | Bakım, yapılandırma, bağımlılık |

Örnekler:
- `docs: add project overview`
- `feat(auth): implement password hashing`
- `test(ml): add inference pipeline tests`

Kurallar:
- Her commit tek bir amacı taşımalıdır
- İlgisiz değişiklikleri aynı committe birleştirmeyin
- Commit mesajları kısa ve İngilizce olmalıdır
- Sırf commit sayısını artırmak için anlamsız commit oluşturmayın

## Pull Request Süreci

1. İlgili testleri çalıştırın ve başarılı olduğunu doğrulayın
2. Branch'i remote'a push edin
3. `.github/pull_request_template.md` şablonunu kullanarak PR açın
4. PR açıklamasında `Closes #IssueNumber` kullanarak Issue'yu bağlayın
5. İncelemeci(ler) atayın
6. Gelen düzeltme taleplerini aynı PR üzerinden yeni commitlerle uygulayın
7. PR incelemeci tarafından onaylanmadan merge etmeyin

## Kod Standartları

### Backend (Python/FastAPI)
- PEP 8 standartlarına uyun
- Type hint kullanın
- Docstring ekleyin (Google formatı)
- Service katmanı iş kurallarını içermeli, Router doğrudan DB sorgusu yapmamalı

### Frontend (React/TypeScript)
- TypeScript strict mode kullanın
- Bileşenleri küçük ve odaklı tutun
- API tiplerini açıkça tanımlayın
- Her sayfa loading, empty, success ve error durumlarını ele almalıdır

### Test
- Yeni özellik için test yazın
- Mevcut testleri bozmayın
- Backend: pytest + HTTPX/FastAPI TestClient
- Frontend: Vitest + React Testing Library

## Code Review Süreci

- Tüm PR'lar en az bir incelemeci tarafından onaylanmalıdır
- İnceleme sırasında güvenlik ve RBAC kontrolleri yapılmalıdır
- Migration gerekiyorsa doğrulanmalıdır
- Test sonuçları ve lint/type-check çıktıları kontrol edilmelidir

## Proje Yönetimi

- GitHub Project board üzerinden iş akışı takip edilir
- Issue durumları: **To Do** → **In Progress** → **Review** → **Done**
- Çalışılmaya başlanan Issue **In Progress** yapılmalıdır
- PR açıldığında Issue **Review** yapılmalıdır
- PR onaylanıp merge edildikten sonra **Done** yapılmalıdır

## Sorun Bildirme

Hata bulduğunuzda `bug_report.md` şablonunu kullanarak Issue açın. Sorunu yeniden üretmek için gerekli adımları, beklenen davranışı ve çevre bilgilerini ekleyin.