import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';

process.env.JWT_SECRET ||= 'test-secret-value-that-is-long-enough-1234567890';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { bodyTooLarge, MAX_API_BODY_BYTES } = require('../src/middleware') as typeof import('../src/middleware');

const req = (method: string, path: string, headers: Record<string, string>) => new NextRequest(`http://localhost${path}`, { method, headers });

test('oversized API bodies are refused before any route reads them', () => {
  assert.equal(bodyTooLarge(req('POST', '/api/student/quizzes/q1/attempts', { 'content-length': String(MAX_API_BODY_BYTES + 1) }))?.status, 413);
  assert.equal(bodyTooLarge(req('POST', '/api/x', { 'transfer-encoding': 'chunked' }))?.status, 411, 'undeclared length refused');
  assert.equal(bodyTooLarge(req('POST', '/api/x', { 'content-length': 'abc' }))?.status, 400);
  assert.equal(bodyTooLarge(req('POST', '/api/x', { 'content-length': '2048' })), null, 'normal requests pass');
  assert.equal(bodyTooLarge(req('DELETE', '/api/x', {})), null, 'no body is fine');
  assert.equal(bodyTooLarge(req('GET', '/api/x', { 'content-length': String(MAX_API_BODY_BYTES * 5) })), null, 'reads are not limited');
  assert.equal(bodyTooLarge(req('POST', '/student/page', { 'content-length': String(MAX_API_BODY_BYTES * 5) })), null, 'pages are not API routes');
});
