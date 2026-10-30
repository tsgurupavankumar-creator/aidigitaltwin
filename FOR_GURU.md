# For Guru Pavan

## NEW (v25, final): after updating, once

1. `npx prisma migrate deploy` then `npx prisma generate` (adds the `twin_snapshots` table and the `final_fixes` columns; additive only).
2. `npm run twin:weekly-review` once, to replace the old seeded risk assessments with real ones (fixes students showing different risk on different pages).
3. `npm run faculty:approve` to see and approve any pending faculty sign-ups.
4. From 1 Nov 2026: `npm install nodemailer@10.1.4 --save-exact`, then `npm test` (see SETUP.md, Dependency notes).

## Earlier (v22): run the database migrations once

```bash
npx prisma migrate deploy     # applies every pending migration (twin_snapshots, final_fixes)
npx prisma generate
```

`20261028120000_final_fixes` only ADDS optional/defaulted columns (password-change flag, quiz limits and dates, submission text/link, recommendation concept/reason, study-task schedule) plus one unique index and two foreign keys. Nothing existing changes. **Required before using v22**: twin history is now written inside the run's transaction, so without the `twin_snapshots` table every twin update fails.

---


## NEW (v21): one database migration for twin history

v21 adds a `twin_snapshots` table (the twin's state over time). Apply it once to the shared database:

```bash
npx prisma migrate deploy      # applies prisma/migrations/20261025120000_twin_snapshots (creates one table + index; changes nothing else)
npx prisma generate
```

- Use `migrate deploy`, **not** `migrate dev` (which can ask to reset the database) and **never** `db:seed`.
- It only **adds** a table; no existing table, column or row is changed.
- Order does not matter for safety: if the app is deployed before the migration, twins still update normally; only history points are skipped (log line `[TWIN_HISTORY] snapshot not saved`) until you run it.

---


**Update 2026-10-17: all seven patches are now applied in this zip** (Veda asked for every fix to be made). Your folders changed, so please review them: `git diff` against the last commit shows every line, and each patch in `guru-patches/` is the exact change to your areas, with its own tests. With all of them applied: `tsc` 0 errors, 97/97 tests, production build passes on Next.js 15.5.27 with no warnings.

## 1. Do first

- **Check `JWT_SECRET` everywhere it is set** (your `.env`, any host). If it is the old example value `generate-a-32-character-minimum-secret-here`, anyone could forge a login. Replace it with `openssl rand -base64 48`; the app now refuses to start with it anyway.
- **Rotate secrets** (Neon password, `JWT_SECRET`, `NEXTAUTH_SECRET`) if the first zip, which contained a live `.env`, went beyond people who already had database access. Changing `JWT_SECRET` logs everyone out once.
- **Replace the default passwords in the shared database** without re-seeding (the seed erases data): `npm run passwords:rotate-defaults` (dry run), then `-- --apply`. Each affected account gets its own random password, written to the git-ignored `rotated-credentials.local.csv`.
- Never zip the whole folder: `zip -r project.zip aidigitaltwin-updated -x "*/node_modules/*" "*/.env" "*/.next/*" "*.DS_Store"`

## 2. The patches (applied)

| # | Patch | Problem it closes |
|---|---|---|
| 01 | `remove-unthrottled-login` | `POST /api/auth/login` had **no rate limit**, skipped the date-of-birth check for students and was CSRF-exempt, so passwords could be guessed at unlimited speed. Nothing renders `LoginForm.tsx` (its only caller), so the route, the form, `authStore.login` and the `useAuth` re-export are deleted. The two role-specific login routes are untouched. |
| 02 | `session-revocation` | `getAuthSession()` checked only the JWT (7-day expiry), so logout and password reset never cut off an already-issued cookie. It now also requires an unexpired `Session` row. All live login/signup routes store `sha256(token)` with a 7-day expiry (apply 01 first: the removed generic login stored 30-minute rows), and `Session.tokenHash` is already `@unique`, so the lookup is indexed and needs no schema change. Faculty signup issues no cookie, so nobody is locked out. |
| 03 | `edge-runtime-warning` | `middleware.ts` imported `session.ts`, dragging Node's `crypto` and Prisma into the Edge bundle. The cookie name moves to an import-free `constants.ts` (still re-exported from `session.ts`). The build no longer prints the warning. |
| 04 | `rate-limiter-options-and-eviction` | The limiter now accepts per-call `{ max, windowMs }` and sweeps expired entries (it never evicted, so distinct keys grew the map without bound). Existing callers behave exactly as before. |
| 05 | `signup-hardening` | The server accepted 6-character passwords while the forms and reset require 8+ with mixed types. Both signup schemas now use the same rules, and signup is limited to 20 per 15 minutes per IP (looser than login: students share campus IPs). Needs patch 04. |
| 06 | `csrf-token-signing` | The server only compared cookie and header, so any matching pair the client made up passed (measured: HTTP 401, meaning it got through). Tokens are now `<random>.<HMAC-SHA256(JWT_SECRET)>` via Web Crypto, so they work in the Edge middleware. Verified against the real middleware. Fails closed if `JWT_SECRET` is missing. |
| 07 | `reject-placeholder-jwt-secret` | **Found in the 17 Oct audit.** `.env.example` shipped `JWT_SECRET="generate-a-32-character-minimum-secret-here"` (43 chars), which passed the 32-character check. The README says `cp .env.example .env`, so anyone who skipped editing it ran with a secret printed in the repo: a token forged with it was accepted as a valid FACULTY session (measured), and after patch 06 CSRF tokens could be forged the same way. `jwt.ts` now refuses published placeholders (`isUsableSecret`), and `.env.example` ships empty secrets with an `openssl rand -base64 48` hint. 5 tests; the build refuses to start with the placeholder. **Check your real `.env` (and any host's env vars): if `JWT_SECRET` is still the placeholder, replace it now** (everyone is logged out once). |

## 3. Please test by hand against the real database (I could not)

- **Revocation (patch 02):** log in, call any API (200), log out, replay the *same* cookie with `curl --cookie` (expect 401). Do the same after a password reset. Everyone currently logged in will be asked to log in once more.
- **Old CSRF cookies (patch 06):** a browser holding an old unsigned token gets one 403, then the client refreshes the token and retries on its own.
- **Page shells:** `middleware.ts` still checks the JWT signature only (no database on the Edge), so a revoked cookie can still load an empty page shell. Every data API refuses it.

## 4. Also changed in or near your areas this round

- **Next.js 15.5.27** (was 14.2.35, 2 critical RCE advisories). `cookies()` and route `params` are now awaited: `src/lib/auth/session.ts`, `api/auth/logout`, `api/faculty/courses/[courseId]`, `api/faculty/student/[id]`, `api/agents/logs/[studentId]`.
- **Password-reset email:** `forgot-password/route.ts` now sends through `src/lib/email/password-reset.ts` (SMTP from `.env`), and builds the link from `APP_URL` instead of the Host header (a forged Host could have put an attacker's link in a victim's email).
- **Seed:** `prisma/seed.ts` refuses to run without `SEED_CONFIRM_WIPE=yes` and two strong passwords that are not the old defaults.
- **`CSRF_ENABLED=false`** is ignored when `NODE_ENV=production` (`csrf.ts`, `middleware.ts`).
- **`.env.example`:** empty secrets, `APP_URL`, `SMTP_*`, seed variables.

## 4b. Round 4 (dynamic twin), nothing in your folders

The data-entry routes, sync engine and pages are under `src/lib/twin/`, `src/app/api/faculty/courses/[courseId]/...`, `src/app/api/student/...` and the faculty/student pages; the schema, auth routes and middleware are untouched. Two things touch your design: question wording is stored in `Question.options` as `{ prompt, choices }` (no text column), and assignments are linked to concepts through instructor-graded `Question` rows (the only link the schema has). If you add `Question.text` or an assignment-concept table later, both are one-line changes in `src/lib/twin/quiz.ts` and the assignments route.

## 5. Still needs you (no code change possible without a decision or the schema)

- **Who may sign up:** no email verification, and anyone can claim an unclaimed roll number. Preload a roster (roll number + date of birth) and allow signup only for those rows, or verify the email.
- **Enrollment policy:** any faculty member can enrol any student and then see their data. Join-by-code or admin approval.
- **Schema:** course `section` and `schedule` columns (the UI shows "—"), and an archive flag so courses holding data can be retired.
- **SMTP account** for reset emails, and `APP_URL` on the server.
