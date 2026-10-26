# AI Academic Digital Twin — D3–D11 implementation notes

## Included in this update

- Added an optional OpenAI recommendation adapter at `src/lib/agents/llm-learning-plan.ts`.
- Kept the selected provider/model configurable (`OPENAI_MODEL=gpt-4o-mini`) and disabled the feature by default (`LLM_ENABLED=false`). No API key is bundled.
- Sends only concept aliases, bounded mastery scores, impact labels, downstream counts, and compact agent findings. Student IDs, student names, course names, and database concept IDs are not sent to OpenAI.
- Validates the model's structured output against the server-side concept-alias map and `STUDY | REVIEW | PRACTICE | TUTORING` action allowlist. Invalid entries are discarded. The LLM cannot change trained predictions, risk calculations, flags, severity, or escalation.
- Provider errors, timeout, HTTP 429, refusal, or malformed output fall back to the existing rule-based recommendations.
- Wrapped successful orchestrator persistence (alerts, recommendations, optional intervention, risk assessment, digital twin update, and final idempotency marker) in a Prisma interactive transaction. Agent execution remains outside the transaction and per-agent failure isolation is preserved.
- Added Zod body validation to the run/orchestrator endpoints and student alert, recommendation, and study-plan write routes. Central middleware CSRF enforcement is unchanged.
- Added a faculty “Mark complete” action using the existing intervention API and existing `completedAt` field; no status enum or column was added.
- The weekly review now requests fresh alert, recommendation, study-plan, and agent-log data after a run and calls `router.refresh()` in addition to refreshing twin/risk data.
- Added focused LLM adapter tests in `tests/llm-learning-plan.test.ts` and adapted the orchestrator test stub for Prisma transactions.

## Hard constraints preserved

- `prisma/schema.prisma` was not changed; no migration, push, reset, or seed was run.
- Existing `.pkl` model artifacts were not retrained or replaced.
- Hourly idempotency remains unchanged; no new unique index was introduced.
- The existing three-agent architecture and per-agent error isolation remain in place.
- `.env` and `.git` are not included in this distribution. Copy your private local `.env` separately; never put API keys or database credentials in a ZIP or commit.

## Important compatibility warning

The requested model is configured as `gpt-4o-mini`; the model lifecycle documentation reviewed during planning marked it deprecated, so this is an explicit compatibility risk. Check current OpenAI model documentation and target-account availability before enabling the feature. This update deliberately does **not** silently substitute another model. Keep `LLM_ENABLED=false` until access and structured-output compatibility are confirmed. If the chosen model is unavailable, the app continues using its rule-based fallback.

## Not verified in this environment

- Full `npm test`, Prisma validation, Next.js build, live OpenAI call, and live Neon integration were not completed here. Dependencies are not installed in this working copy; a global TypeScript check consequently reported missing dependency/type declarations and is not a valid pass/fail build result.
- The pre-existing evaluation-report/model-artifact metrics discrepancy is intentionally not rewritten without a reproducible evaluation. Do not claim the older, stronger metrics until verified against the actual saved artifacts.
- Python 3.14 still does not satisfy the pinned pandas dependency described in the supplied audit. Use a supported Python 3.12 virtual environment for the ML service; do not alter pins or retrain models unless the pinned install genuinely fails there.

## Windows CMD verification checklist

From the repository root:

```bat
npx prisma validate
npm test
npx tsc --noEmit
npm run build
```

For the ML service, use Python 3.12 and a dedicated virtual environment:

```bat
cd /d "C:\Users\GuruPavan\OneDrive\Pictures\last draft\aidigitaltwin-v7-to-v8-update\ml"
py -3.12 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe -m pytest
```

Before database checks, manually wake Neon in Neon Console → SQL Editor with `SELECT 1;`. Do not run migrations, database push/reset, or seed commands for this update.
