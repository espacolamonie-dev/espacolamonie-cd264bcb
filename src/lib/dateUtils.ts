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

/**
 * Get today's date as "YYYY-MM-DD" in local timezone (America/Sao_Paulo).
 * Avoids the UTC issue where `new Date().toISOString().split("T")[0]`
 * returns yesterday's date after 21:00 BRT.
 */
export function todayLocalStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
