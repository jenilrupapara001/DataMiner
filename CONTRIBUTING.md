# Contributing — GitHub Flow

## Branching rules

| Branch | Purpose | Branches from | Merges into |
|--------|---------|---------------|-------------|
| `main` | Always deployable. Protected. | — | — |
| `feature/<name>` | New features | `main` | `main` via PR |
| `fix/<name>` | Non-urgent bug fixes | `main` | `main` via PR |
| `hotfix/<name>` | Urgent production fixes | `main` | `main` via PR |

## Workflow

```
1. Branch off main
   git checkout main && git pull origin main
   git checkout -b feature/your-feature-name

2. Work and commit often
   git add <files>
   git commit -m "feat: describe what you did"

3. Push and open a PR
   git push -u origin feature/your-feature-name
   # Open PR → main on GitHub

4. CI must pass before merge
5. Squash & merge into main
6. Delete the feature branch after merge
```

## Commit message convention

```
feat:     new feature
fix:      bug fix
refactor: code change with no behavior change
hotfix:   urgent production fix
docs:     documentation only
chore:    tooling / config
```

## Branch protection (configure on GitHub)

- Require PR before merging into `main`
- Require CI checks to pass
- No direct pushes to `main`
