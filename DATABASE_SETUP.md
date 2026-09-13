# AI Academic Digital Twin database setup

1. Copy `.env.example` to `.env` and set a PostgreSQL `DATABASE_URL` and a strong `JWT_SECRET`.
2. Install dependencies, then run `npx prisma generate`.
3. Create the development migration with `npx prisma migrate dev --name init`.
4. Load demonstration data with `npx ts-node prisma/seed.ts`.
5. Inspect data with `npx prisma studio`.

The seed creates three students (`24BCE0480`, `24BCE2038`, `24BCE2032`) using their seeded DOB values for login, and two faculty accounts (`FAC001`, `FAC002`) using `Faculty@123`. Passwords are stored only as bcrypt hashes.

Recommended VS Code extensions: **Prisma**, **PostgreSQL**, and **SQLTools**.

## API checks

Start the app with `npm run dev`, then exercise the handlers with an HTTP client. Login first to receive the httpOnly `auth_token` cookie:

```bash
curl -i -X POST http://localhost:3000/api/auth/login/student -H "Content-Type: application/json" -d "{\"rollNumber\":\"24BCE0480\",\"dob\":\"2005-02-14\"}"
curl -i http://localhost:3000/api/student/twin
curl -i http://localhost:3000/api/student/knowledge-gaps
curl -i http://localhost:3000/api/student/risk
```

Useful verification commands are `npx prisma validate`, `npx prisma format`, `npx tsc --noEmit`, and `npm run build`.