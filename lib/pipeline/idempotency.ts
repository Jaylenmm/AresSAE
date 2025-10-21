export function stableKey(parts: (string | number | boolean | null | undefined)[]): string {
  return parts.map(v => String(v ?? '')).join('|')
}
