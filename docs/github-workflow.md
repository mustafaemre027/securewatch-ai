# GitHub Workflow

## Branch Stratejisi

```
main                          (production-ready)
 ├── docs/*                   (documentation changes)
 ├── feature/*                (new features)
 ├── fix/*                    (bug fixes)
 ├── test/*                   (test additions/fixes)
 └── chore/*                  (maintenance, config)
```

## Issue Yönetimi

1. **EPIC Issues** (`[EPIC]` prefix) — büyük fazları temsil eder, birden çok günü kapsar.
2. **Sub-Issues** (`[Faz-N] Gün X:` prefix) — tek bir günde tamamlanabilecek doğrulanabilir görevlerdir.
3. Her sub-issue, ait olduğu EPIC'in gövdesinde checklist olarak listelenir.

## Süreç Akışı

```
To Do → In Progress → Branch Oluştur → Commit & Push → PR Aç → PR Review → PR Merge → Done
```

## Commit Standartları

Conventional Commits formatı kullanılır:

```
<type>(<scope>): <description>
```

| Type | Kullanım |
|------|----------|
| `feat` | Yeni özellik |
| `fix` | Hata düzeltme |
| `docs` | Dokümantasyon |
| `test` | Test ekleme/düzeltme |
| `refactor` | Kod yeniden düzenleme |
| `chore` | Bakım, yapılandırma |

## Pull Request Süreci

1. Branch oluştur → `type/issue-number-short-description`
2. Değişiklikleri commit et (küçük ve anlamlı)
3. Branch'i push et
4. GitHub'da PR aç (`Closes #IssueNumber`)
5. Review sürecini bekle
6. Onay sonrası merge et

## Label Kullanımı

### Type Labels
- `type:feature` — Yeni özellik
- `type:bug` — Hata düzeltme
- `type:documentation` — Dokümantasyon
- `type:refactor` — Kod yeniden düzenleme
- `type:test` — Test
- `type:chore` — Bakım

### Area Labels
- `area:backend` — Backend
- `area:frontend` — Frontend
- `area:docs` — Dokümantasyon
- `area:ml` — Makine öğrenmesi

### Priority Labels
- `priority:critical` — Kritik
- `priority:high` — Yüksek
- `priority:medium` — Orta
- `priority:low` — Düşük

## Project Board

| Sütun | Açıklama |
|-------|----------|
| To Do | Henüz başlanmamış işler |
| In Progress | Üzerinde çalışılan işler |
| Review | PR açılmış, inceleme bekleyen işler |
| Done | Tamamlanmış işler |