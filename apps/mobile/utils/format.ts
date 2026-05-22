export function formatDistanceKm(value: number | null): string {
  if (value === null) return '—';
  return `~${Math.round(value)} km`;
}
