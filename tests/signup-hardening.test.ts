import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
process.env.JWT_SECRET = 'test-secret-for-signup-hardening-0123456789';

type Any = any; // eslint-disable-line @typescript-eslint/no-explicit-any
function stub(path: string, exports: object) {
  const id = require.resolve(path);
  require.cache[id] = { id, filename: id, loaded: true, exports, children: [], paths: [], path: '' } as unknown as NodeJS.Module;
}
stub('next/headers', { cookies: () => ({ get: () => undefined, set: () => undefined }) });
stub('../src/lib/prisma', { prisma: {} });
const { studentSignupSchema, facultySignupSchema } = require('../src/lib/validation/schemas') as Any;
const studentRoute = require('../src/app/api/auth/signup/student/route') as Any;
const facultyRoute = require('../src/app/api/auth/signup/faculty/route') as Any;

const STRONG = 'Str0ng!Passw0rd';
const student = (password: string) => ({ fullName: 'A', rollNumber: 'R1', email: 'a@x.co', dob: '2005-01-01', password, confirmPassword: password });
const faculty = (password: string) => ({ fullName: 'F', facultyId: 'F1', department: 'CSE', email: 'f@x.co', password, confirmPassword: password });

test('weak passwords are rejected by BOTH signup schemas, and the message says what is missing', () => {
  for (const weak of ['123456', 'password', 'Password1', 'Pass1!', 'password1!', 'PASSWORD1!']) {
    for (const [schema, make] of [[studentSignupSchema, student], [facultySignupSchema, faculty]] as const) {
      const r = schema.safeParse(make(weak));
      assert.equal(r.success, false, `"${weak}" must be rejected`);
      assert.match(r.error.issues[0].message, /^Password must include: /);
    }
  }
});

test('a strong password is accepted by both schemas', () => {
  assert.equal(studentSignupSchema.safeParse(student(STRONG)).success, true);
  assert.equal(facultySignupSchema.safeParse(faculty(STRONG)).success, true);
});

test('mismatched confirmation is still rejected', () => {
  assert.equal(studentSignupSchema.safeParse({ ...student(STRONG), confirmPassword: 'different' }).success, false);
});

const post = (route: Any, ip: string, body: object = {}) =>
  route.POST(new NextRequest('http://localhost:3000/api/auth/signup', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: JSON.stringify(body) }));

test('student signup: the route rejects a weak password with a 400 that names the missing rules', async () => {
  const res = await post(studentRoute, '10.9.0.1', student('123456'));
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /Password must include/);
});

test('student signup rejects roster mismatches and missing roster configuration before database access', async () => {
  const originalRoster = process.env.STUDENT_ROSTER_JSON;
  const validSignup = student(STRONG);
  try {
    process.env.STUDENT_ROSTER_JSON = '[{"rollNumber":"R1","dob":"2005-01-01"}]';
    const mismatch = await post(studentRoute, '10.9.0.5', { ...validSignup, rollNumber: 'R2' });
    assert.equal(mismatch.status, 403);
    assert.equal((await mismatch.json()).code, 'ROSTER_MISMATCH');

    delete process.env.STUDENT_ROSTER_JSON;
    const unavailable = await post(studentRoute, '10.9.0.6', validSignup);
    assert.equal(unavailable.status, 503);
    assert.equal((await unavailable.json()).code, 'ROSTER_UNAVAILABLE');
  } finally {
    if (originalRoster === undefined) delete process.env.STUDENT_ROSTER_JSON;
    else process.env.STUDENT_ROSTER_JSON = originalRoster;
  }
});

test('signup is rate limited per IP: 20 allowed, then 429, and other IPs are unaffected', async () => {
  const codes: number[] = [];
  for (let i = 0; i < 22; i++) codes.push((await post(studentRoute, '10.9.0.2')).status);
  assert.deepEqual(codes.slice(0, 20).every((c) => c === 400), true);
  assert.deepEqual(codes.slice(20), [429, 429]);
  assert.notEqual((await post(studentRoute, '10.9.0.3')).status, 429);
  const f: number[] = [];
  for (let i = 0; i < 21; i++) f.push((await post(facultyRoute, '10.9.0.4')).status);
  assert.equal(f[20], 429);
});
