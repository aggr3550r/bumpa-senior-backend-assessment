export function quoteTablePath(tablePath: string): string {
  return tablePath
    .split('.')
    .map((part) => `"${part.replace(/"/g, '""')}"`)
    .join('.');
}
