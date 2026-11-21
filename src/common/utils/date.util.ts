import { API_DATE_PATTERN, BUSINESS_UTC_OFFSET } from '../const/date.const';

/**
 * @param date - A `YYYY-MM-DD` date.
 * @returns The following day, as `YYYY-MM-DD`.
 */
export function nextDay(date: string): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

/**
 * @param date - A `YYYY-MM-DD` date.
 * @returns Midnight of that day in the business time zone, as ISO 8601.
 */
export function startOfBusinessDay(date: string): string {
  return `${date}T00:00:00${BUSINESS_UTC_OFFSET}`;
}

/**
 * @param date - A `DD-MM-YYYY` API date.
 * @returns The date as `YYYY-MM-DD`, or null if it isn't in API format.
 */
export function fromApiDate(date: string): string | null {
  const match = API_DATE_PATTERN.exec(date);
  if (!match) {
    return null;
  }

  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}
