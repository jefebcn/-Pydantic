export function isValidASIN(asin: string): boolean {
  return /^[A-Z0-9]{10}$/.test(asin);
}

export function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}
