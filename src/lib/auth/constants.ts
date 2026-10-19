/**
 * Cookie names. This module deliberately has NO imports, so src/middleware.ts
 * (which runs on the Edge runtime) can use it without pulling in session.ts and,
 * through it, Node-only code (`crypto`) and Prisma. Importing session.ts from the
 * middleware is what caused the "Node.js module is loaded ('crypto') which is not
 * supported in the Edge Runtime" build warning.
 */
export const SESSION_COOKIE_NAME = 'ai_twin_session';
export const AUTH_COOKIE_NAME = SESSION_COOKIE_NAME;
