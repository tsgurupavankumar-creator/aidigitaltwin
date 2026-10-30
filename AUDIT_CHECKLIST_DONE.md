# Audit checklist — completed in this package

## 1. JWT test (Windows `npx` ENOENT) — FIXED
- File: `tests/jwt-secret.test.ts`
- On Windows uses `spawnSync('npx.cmd', [...], { shell: true })`
- On Linux/macOS keeps `execFileSync('npx', ...)`
- Run: `npm test` (expect all tests green)

## 2. GitHub Actions (Audit Item 12) — DONE
- File: `.github/workflows/ci.yml`
- Triggers: `push` and `pull_request` → `master`
- Node 22, `npm ci`, `tsc --noEmit`, `npm test`, `npm run build`

## 3. Playwright E2E (Audit Item 13) — DONE
- `@playwright/test` already in `devDependencies`
- `playwright.config.ts` (starts `npm run dev`, baseURL localhost:3000)
- `tests/e2e/app.spec.ts` and `tests/e2e.spec.ts` — student login + "RUN WEEKLY REVIEW" visible
- Script: `"test:e2e": "playwright test"` in `package.json`
- Needs env: `E2E_STUDENT_ROLL`, `E2E_STUDENT_DOB`, `E2E_STUDENT_PASSWORD`
- Once: `npx playwright install`

## 4. Fallbacks / ClassInsight (code verified)
- `src/lib/agents/orchestrator.ts`:
  - Agent/ML failure → `{ degraded: true }` and **nothing persisted**
  - LLM failure → `fallback: 'rule_based'` audit log; rule-based recommendations still used
  - `refreshCourseInsight` once per unique enrolled `courseId` after core commit (`skipCourseInsightRefresh` for batch)

## 5. Environment template
- Complete `.env.example` (empty `JWT_SECRET`, all documented vars)
- Copy: `cp .env.example .env` then fill secrets

## What you still run locally (needs your DB / secrets)
```bash
cp .env.example .env   # set DATABASE_URL, JWT_SECRET, APP_URL, ...
npm ci
npx prisma generate
npm test
npx playwright install
# Manual: npm run dev + uvicorn; stop ML / break OPENAI_API_KEY and confirm no crash
```
