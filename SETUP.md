# AI Academic Digital Twin setup

1. Install PostgreSQL and create the database: `createdb aisd`.
2. Copy `.env.example` to `.env` and set `DATABASE_URL` plus a strong `JWT_SECRET`.
3. Install dependencies: `npm install`.
4. Generate Prisma Client: `npx prisma generate`.
5. Create the migration: `npx prisma migrate dev --name init`.
6. Seed development data: `npx prisma db seed`.
7. Inspect the database: `npx prisma studio`.
8. Start Next.js: `npm run dev`.

Recommended VS Code extensions: Prisma, PostgreSQL, and SQLTools.

## Test accounts

- Students: `24BCE0480`, `24BCE2038`, `24BCE2032`; DOBs `2005-06-15`, `2005-08-22`, `2005-03-10`.
- Faculty: `FAC001` and `FAC002`; password `Faculty@123`.
- Student login uses the seeded DOB values above; the seed stores each DOB as a bcrypt hash.

## Verification

```bash
npx prisma validate
npx prisma format
npx prisma generate
npx tsc --noEmit
npm run build
```

The seed is development-only and clears existing application data before loading its deterministic dataset. Do not run it against production.

## API examples

```bash
curl -i -c cookies.txt -X POST http://localhost:3000/api/auth/login/student -H "Content-Type: application/json" -d "{\"rollNumber\":\"24BCE0480\",\"dob\":\"2005-06-15\"}"
curl -i -b cookies.txt http://localhost:3000/api/auth/me
curl -i -b cookies.txt http://localhost:3000/api/student/twin
curl -i -b cookies.txt http://localhost:3000/api/student/knowledge-gaps
curl -i -b cookies.txt http://localhost:3000/api/student/risk
curl -i -b cookies.txt http://localhost:3000/api/student/route
curl -i -b cookies.txt -X POST http://localhost:3000/api/auth/logout
```

Faculty signup creates a `PENDING` account and requires an administrator to activate it before faculty login succeeds. Additional route examples:

```bash
curl -i -X POST http://localhost:3000/api/auth/signup/student -H "Content-Type: application/json" -d "{\"fullName\":\"New Student\",\"rollNumber\":\"26BCE0001\",\"dob\":\"2006-01-01\",\"email\":\"new.student@university.edu\",\"password\":\"Student@123\",\"confirmPassword\":\"Student@123\"}"
curl -i -X POST http://localhost:3000/api/auth/signup/faculty -H "Content-Type: application/json" -d "{\"fullName\":\"New Faculty\",\"facultyId\":\"FAC009\",\"department\":\"Computer Science\",\"email\":\"new.faculty@university.edu\",\"password\":\"Faculty@123\",\"confirmPassword\":\"Faculty@123\"}"
curl -i -c faculty-cookies.txt -X POST http://localhost:3000/api/auth/login/faculty -H "Content-Type: application/json" -d "{\"facultyId\":\"FAC001\",\"password\":\"Faculty@123\"}"
curl -i -b faculty-cookies.txt http://localhost:3000/api/faculty/students
curl -i -b faculty-cookies.txt http://localhost:3000/api/faculty/class-insights
curl -i -b faculty-cookies.txt -X POST http://localhost:3000/api/faculty/intervention -H "Content-Type: application/json" -d "{\"studentId\":\"STUDENT_CUID\",\"type\":\"TUTORING\",\"notes\":\"Schedule a SQL review session\"}"
```
