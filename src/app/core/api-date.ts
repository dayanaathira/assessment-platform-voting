const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Checks a yyyy-mm-dd value from the URL or a date input.
 * @param value - Raw value.
 * @returns The value if it looks like an ISO date, otherwise undefined.
 */
export function isoDateOrUndefined(value: string | null): string | undefined {
  return value && ISO_DATE.test(value) ? value : undefined;
}

/**
 * Converts yyyy-mm-dd (what date inputs give) to the API's DD-MM-YYYY.
 * @param date - ISO date, or undefined.
 * @returns The API date, or undefined.
 */
export function toApiDate(date?: string): string | undefined {
  if (!date) {
    return undefined;
  }
  const [year, month, day] = date.split('-');
  return `${day}-${month}-${year}`;
}
