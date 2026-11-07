import { timingSafeEqual } from 'node:crypto';
import { InternalServiceTokenHeaderSchema } from './internal-persistence';

const HEADER_NAME = 'x-internal-service-token';

export class InternalServiceAuthError extends Error {
  constructor() {
    super('Internal service authentication failed');
    this.name = 'InternalServiceAuthError';
  }
}

export class InternalServiceConfigError extends Error {
  constructor() {
    super('Internal service authentication is not configured');
    this.name = 'InternalServiceConfigError';
  }
}

function safeEqual(received: string, expected: string): boolean {
  const receivedBytes = Buffer.from(received, 'utf8');
  const expectedBytes = Buffer.from(expected, 'utf8');
  if (receivedBytes.length !== expectedBytes.length) return false;
  return timingSafeEqual(receivedBytes, expectedBytes);
}

export function assertInternalServiceToken(headers: Headers): void {
  const received = headers.get(HEADER_NAME);
  if (received === null) throw new InternalServiceAuthError();

  const expected = process.env.INTERNAL_SERVICE_SECRET;
  if (!expected || expected.length < 32) throw new InternalServiceConfigError();

  const parsedHeader = InternalServiceTokenHeaderSchema.safeParse({ [HEADER_NAME]: received });
  if (!parsedHeader.success) throw new InternalServiceAuthError();

  try {
    if (safeEqual(received, expected)) return;
  } catch {
    throw new InternalServiceAuthError();
  }

  throw new InternalServiceAuthError();
}
