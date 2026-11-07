import type { Transporter } from 'nodemailer';

/**
 * Password-reset email delivery.
 *
 * Configure SMTP in .env to send real emails (works with any SMTP provider:
 * Gmail/Google Workspace app password, Outlook, SendGrid, Resend, Brevo...):
 *   SMTP_HOST, SMTP_PORT (587 STARTTLS or 465 TLS), SMTP_USER, SMTP_PASS, SMTP_FROM
 * and APP_URL, the public address of the site (e.g. https://twin.example.edu).
 *
 * Without SMTP, development logs the link to the server console (as before)
 * and production logs a warning only, never the link.
 */

export interface ResetEmailResult {
  delivered: boolean;
  reason?: 'smtp-not-configured' | 'send-failed';
}

export interface SmtpConfig {
  host: string;
  port: number;
  user?: string;
  pass?: string;
  from: string;
}

export function smtpConfigFromEnv(env: NodeJS.ProcessEnv = process.env): SmtpConfig | null {
  if (!env.SMTP_HOST || !env.SMTP_FROM) return null;
  return {
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 587),
    user: env.SMTP_USER || undefined,
    pass: env.SMTP_PASS || undefined,
    from: env.SMTP_FROM,
  };
}

/**
 * The origin used in emailed links. It must come from configuration, never
 * from the request's Host header: a forged Host would otherwise put an
 * attacker's domain in the victim's reset email (password-reset poisoning).
 * Development falls back to the request origin so localhost keeps working.
 */
export function resetLinkOrigin(requestOrigin: string, env: NodeJS.ProcessEnv = process.env): string | null {
  const configured = env.APP_URL || env.NEXTAUTH_URL;
  if (configured) return configured.replace(/\/+$/, '');
  return env.NODE_ENV === 'production' ? null : requestOrigin;
}

export function buildResetEmail(link: string) {
  const subject = 'Reset your AI Academic Digital Twin password';
  const text =
    `Someone asked to reset the password for this account.\n\n` +
    `To choose a new password, open this link within 1 hour:\n${link}\n\n` +
    `If you did not ask for this, ignore this email; your password will not change.`;
  const html =
    `<p>Someone asked to reset the password for this account.</p>` +
    `<p><a href="${link}">Choose a new password</a> (the link works for 1 hour).</p>` +
    `<p>If you did not ask for this, ignore this email; your password will not change.</p>`;
  return { subject, text, html };
}

type TransportFactory = (config: SmtpConfig) => Pick<Transporter, 'sendMail'>;

async function defaultTransport(config: SmtpConfig) {
  const nodemailer = await import('nodemailer');
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: config.user ? { user: config.user, pass: config.pass } : undefined,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  link: string,
  options: { env?: NodeJS.ProcessEnv; transport?: TransportFactory } = {}
): Promise<ResetEmailResult> {
  const env = options.env ?? process.env;
  const config = smtpConfigFromEnv(env);
  if (!config) {
    if (env.NODE_ENV !== 'production') {
      console.log('[PASSWORD_RESET] SMTP not configured; reset link (dev only, not emailed):', link);
    } else {
      console.warn('[PASSWORD_RESET] SMTP not configured: a reset was requested but no email was sent.');
    }
    return { delivered: false, reason: 'smtp-not-configured' };
  }
  try {
    const transport = options.transport ? options.transport(config) : await defaultTransport(config);
    await transport.sendMail({ from: config.from, to, ...buildResetEmail(link) });
    return { delivered: true };
  } catch (error) {
    // Logged, never surfaced to the caller: the HTTP response must look the
    // same whether or not an account (or a working mailbox) exists.
    console.error('[PASSWORD_RESET] Sending the reset email failed:', (error as Error).message);
    return { delivered: false, reason: 'send-failed' };
  }
}
