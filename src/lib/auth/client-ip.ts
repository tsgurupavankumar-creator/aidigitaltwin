/** Best-effort client IP. x-forwarded-for can be spoofed unless a trusted proxy sets it,
 *  so never rely on this alone for security decisions (pair it with another key). */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}
