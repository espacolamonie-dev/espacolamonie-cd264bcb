/**
 * Parse a "YYYY-MM-DD" date string as local time (not UTC).
 * new Date("2026-04-25") is parsed as UTC midnight, which becomes
 * 24/04 at 21:00 in America/Sao_Paulo. This helper avoids that.
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Format a "YYYY-MM-DD" string to "dd/MM/yyyy" in local time.
 */
export function formatDateBR(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}
