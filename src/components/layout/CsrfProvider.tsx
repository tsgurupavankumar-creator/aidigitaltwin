'use client';

import { useEffect } from 'react';
import { installCsrfFetch } from '@/lib/api/csrf-client';

/**
 * Installs the CSRF-aware fetch wrapper once per page load, so every mutating
 * same-origin /api/* request automatically carries the x-csrf-token header the
 * middleware requires. See src/lib/api/csrf-client.ts.
 */
export function CsrfProvider() {
  useEffect(() => {
    installCsrfFetch();
  }, []);

  return null;
}
