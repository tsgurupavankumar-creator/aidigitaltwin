/**
 * "Due on 2026-08-08" means the END of that day in the institution's time zone, not in UTC
 * (23:59 UTC is 05:29 the next morning in India). Offset from APP_TIMEZONE_OFFSET, default +05:30 (IST).
 */
export function timezoneOffset(): string {
  const v = (process.env.APP_TIMEZONE_OFFSET ?? '+05:30').trim();
  return /^[+-]\d{2}:\d{2}$/.test(v) ? v : '+05:30';
}

export function endOfDay(day: string): Date {
  return new Date(`${day}T23:59:59.999${timezoneOffset()}`);
}

/** The local calendar day (YYYY-MM-DD) of a stored deadline, for editing forms. */
export function localDay(date: Date): string {
  const [, sign, hh, mm] = timezoneOffset().match(/^([+-])(\d{2}):(\d{2})$/)!;
  const ms = (sign === '-' ? -1 : 1) * (Number(hh) * 60 + Number(mm)) * 60_000;
  return new Date(date.getTime() + ms).toISOString().slice(0, 10);
}

/** A form's local date-time ("2026-11-01T09:00") in the institution's time zone; null when empty. */
export function localDateTime(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(`${value.length === 16 ? `${value}:00` : value}${timezoneOffset()}`);
  if (Number.isNaN(d.getTime())) throw new Error('Invalid date and time');
  return d;
}

/** Inverse of localDateTime, for editing forms. */
export function toLocalInput(date: Date | null): string {
  if (!date) return '';
  const [, sign, hh, mm] = timezoneOffset().match(/^([+-])(\d{2}):(\d{2})$/)!;
  const ms = (sign === '-' ? -1 : 1) * (Number(hh) * 60 + Number(mm)) * 60_000;
  return new Date(date.getTime() + ms).toISOString().slice(0, 16);
}
