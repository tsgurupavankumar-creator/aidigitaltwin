# AI Academic Digital Twin setup

Needs Node.js 20 or later, Python 3.11 or later, and PostgreSQL (local or Neon).

CRITICAL: If you pull a new version of the project, run `npm run env:restore` to restore your local `.env` file. Never commit `.env` to Git.

1. Create the database (local example: `createdb aisd`).
2. `cp .env.example .env`, then set:
   - `DATABASE_URL`
   - `JWT_SECRET`: generate with `openssl rand -base64 48`. The app refuses to start with an empty, short or example value.
   - `APP_URL`: the public address of the site (used in password-reset emails).
   - Optional: `SMTP_*` to email password-reset links. Without them, development prints the link to the server console.
3. `npm run env:backup` (stores a durable copy under your user profile).
4. `npm ci` (installs the exact versions in `package-lock.json`).
5. `npx prisma generate`
6. **Using the team's existing database: skip to step 8.** You do not migrate or seed it.
7. Only for a **new, empty database of your own** (e.g. local Postgres): `npx prisma migrate dev --name init`, then seed demo data. The seed **erases** all users, students, faculty, attendance, grades and agent data first:
   ```bash
   SEED_CONFIRM_WIPE=yes SEED_STUDENT_PASSWORD='<strong password>' SEED_FACULTY_PASSWORD='<strong password>' npx prisma db seed
   ```
   It refuses to run without `SEED_CONFIRM_WIPE=yes`, with weak passwords, or with the old published defaults, and it refuses any non-local database unless `SEED_TARGET_HOST` equals that host name. **Never seed the team's shared database.**
8. `npm run dev`

Recommended VS Code extensions: Prisma, PostgreSQL, and SQLTools.

## A database that was seeded with the old default passwords

Do not re-seed (it deletes data). Replace the passwords in place instead:

```bash
npm run passwords:rotate-defaults            # dry run: lists accounts still on Student@123 / Faculty@123
npm run passwords:rotate-defaults -- --apply # gives each its own random password and logs them out
```

The new passwords are written to `rotated-credentials.local.csv` (git-ignored). Share them privately, then delete the file.

## Test accounts (after seeding)

- Students: `24BCE0480`, `24BCE2038`, `24BCE2032`, with dates of birth `2005-06-15`, `2005-08-22` and `2005-03-10`. Student login needs roll number, date of birth **and** the password you set in `SEED_STUDENT_PASSWORD`.
- Faculty: `FAC001` and `FAC002`, with the password you set in `SEED_FACULTY_PASSWORD`.

## Verification

```bash
npx prisma validate
npx tsc --noEmit
npm test
npm run build      # needs a real JWT_SECRET in the environment
```

## API examples

The login routes need no CSRF token. Every other state-changing request needs the `x-csrf-token` header, matching the `csrf_token` cookie; the browser app adds it automatically. With curl:

```bash
# CSRF token (also sets the csrf_token cookie)
TOKEN=$(curl -s -c cookies.txt http://localhost:3000/api/auth/csrf | python3 -c "import json,sys;print(json.load(sys.stdin)['csrfToken'])")

curl -i -b cookies.txt -c cookies.txt -X POST http://localhost:3000/api/auth/login/student \
  -H "Content-Type: application/json" \
  -d '{"rollNumber":"24BCE0480","dob":"2005-06-15","password":"<SEED_STUDENT_PASSWORD>"}'
curl -i -b cookies.txt http://localhost:3000/api/auth/me
curl -i -b cookies.txt http://localhost:3000/api/student/twin
curl -i -b cookies.txt http://localhost:3000/api/student/knowledge-gaps
curl -i -b cookies.txt http://localhost:3000/api/student/risk
curl -i -b cookies.txt -X POST http://localhost:3000/api/auth/logout -H "x-csrf-token: $TOKEN"
```

Faculty:

```bash
curl -i -b cookies.txt -c cookies.txt -X POST http://localhost:3000/api/auth/login/faculty \
  -H "Content-Type: application/json" -d '{"facultyId":"FAC001","password":"<SEED_FACULTY_PASSWORD>"}'
curl -i -b cookies.txt http://localhost:3000/api/faculty/students
curl -i -b cookies.txt -X POST http://localhost:3000/api/faculty/intervention \
  -H "Content-Type: application/json" -H "x-csrf-token: $TOKEN" \
  -d '{"studentId":"STUDENT_CUID","type":"TUTORING","notes":"Schedule a SQL review session"}'
```

Signup (`/api/auth/signup/student`, `/api/auth/signup/faculty`) also needs the CSRF header, and passwords must have 8+ characters with upper and lower case, a number and a symbol. Faculty signup creates a `PENDING` account that an administrator must activate.

## Sharing the project safely (zip)

Never share `.env` (database password, JWT secret). `npm run env:backup` keeps its copy **outside** the project, under your user profile. Zip with dot-files included but secrets, data and installs left out:

```bash
zip -r aidigitaltwin.zip aidigitaltwin-master \
  -x "*/.env" "*/.env.backup" "*/.env.local" "*/node_modules/*" "*/.next/*" "*/.venv/*" "*/ml/data/*" "*/ml/app_data/*" "*.local.csv" "*/__pycache__/*"
```

Then check the zip still contains `.env.example`, `.github/`, `ml/models/` and the four pages under `src/app/faculty/courses/[courseId]/` (attendance, grades, quizzes, import); earlier zips lost some of these.
