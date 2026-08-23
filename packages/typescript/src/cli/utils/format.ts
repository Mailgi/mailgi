export function table(
  headers: string[],
  rows: (string | number | null | undefined)[][],
): void {
  const strRows = rows.map((r) => r.map((c) => (c == null ? '' : String(c))));
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...strRows.map((r) => r[i]?.length ?? 0)),
  );
  const sep = '  ';
  const pad = (s: string, w: number) => s.padEnd(w);

  console.log(headers.map((h, i) => pad(h.toUpperCase(), widths[i])).join(sep));
  console.log(widths.map((w) => '-'.repeat(w)).join(sep));
  for (const row of strRows) {
    console.log(row.map((c, i) => pad(c, widths[i])).join(sep));
  }
}

export function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function redactKey(key: string): string {
  if (key.length <= 12) return '****';
  return key.slice(0, 6) + '****…****' + key.slice(-4);
}

export function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
