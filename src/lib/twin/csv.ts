/**
 * Small, strict CSV reader for the bulk-import screens: a header row, comma
 * separated, double quotes for fields containing commas/quotes/newlines ("" is
 * a literal quote), CRLF or LF line ends. Blank lines are skipped. Headers are
 * matched case-insensitively with spaces and underscores ignored.
 */
export const MAX_CSV_ROWS = 5000;
export const MAX_CSV_BYTES = 1_000_000;

export interface CsvTable { headers: string[]; rows: Array<Record<string, string>>; }

export function normalizeHeader(h: string) {
  return h.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

export function parseCsv(text: string): CsvTable {
  if (text.length > MAX_CSV_BYTES) throw new Error(`The file is larger than ${MAX_CSV_BYTES / 1_000_000} MB.`);
  const records: string[][] = [];
  let field = '', row: string[] = [], quoted = false;
  const src = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((v) => v.trim() !== '')) records.push(row);
      row = [];
    } else field += ch;
  }
  if (quoted) throw new Error('A quoted field is not closed.');
  row.push(field);
  if (row.some((v) => v.trim() !== '')) records.push(row);
  if (!records.length) throw new Error('The file is empty.');
  const headers = records[0].map(normalizeHeader);
  const body = records.slice(1);
  if (body.length > MAX_CSV_ROWS) throw new Error(`At most ${MAX_CSV_ROWS} rows per import.`);
  return {
    headers,
    rows: body.map((cells) => Object.fromEntries(headers.map((h, i) => [h, (cells[i] ?? '').trim()]))),
  };
}

export function requireHeaders(table: CsvTable, needed: string[]) {
  const missing = needed.filter((h) => !table.headers.includes(normalizeHeader(h)));
  if (missing.length) throw new Error(`Missing column(s): ${missing.join(', ')}. Expected: ${needed.join(', ')}.`);
}
