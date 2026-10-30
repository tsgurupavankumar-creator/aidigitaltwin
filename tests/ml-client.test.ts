import test from 'node:test';
import assert from 'node:assert/strict';
import { callML } from '../src/lib/ml/client';

test('ML client retries transient HTTP failures up to three times', async () => {
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = (async () => {
    attempts += 1;
    if (attempts < 4) return new Response('temporarily unavailable', { status: 503 });
    return new Response(JSON.stringify({ prediction: 0.8 }), { status: 200 });
  }) as typeof fetch;

  try {
    const result = await callML<{ prediction: number }>('/test', {});
    assert.equal(result.prediction, 0.8);
    assert.equal(attempts, 4);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('ML client throws the last error after the initial call and three retries', async () => {
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = (async () => {
    attempts += 1;
    throw new Error('connection refused');
  }) as typeof fetch;

  try {
    await assert.rejects(callML('/test', {}), /connection refused/);
    assert.equal(attempts, 4);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
