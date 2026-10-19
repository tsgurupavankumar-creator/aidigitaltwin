# AI Academic Digital Twin setup

Needs Node.js 20 or later, Python 3.11 or later, and PostgreSQL (local or Neon).

1. Create the database (local example: `createdb aisd`).
2. `cp .env.example .env`, then set:
   - `DATABASE_URL`
   - `JWT_SECRET`: generate with `openssl rand -base64 48`. The app refuses to start with an empty, short or example value.
   - `APP_URL`: the public address of the site (used in password-reset emails).
   - Optional: `SMTP_*` to email password-reset links. Without them, development prints the link to the server console.
3. `npm ci` (installs the exact versions in `package-lock.json`).
4. `npx prisma generate`
5. `npx prisma migrate dev --name init`
6. Seed demonstration data (**erases** the application tables first):
   ```bash
   SEED_CONFIRM_WIPE=yes SEED_STUDENT_PASSWORD='<strong password>' SEED_FACULTY_PASSWORD='<strong password>' npx prisma db seed
   ```
   The seed refuses to run without `SEED_CONFIRM_WIPE=yes`, with weak passwords, or with the old published defaults (`Student@123`, `Faculty@123`). Never seed a database that holds real data.
7. `npm run dev`

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
