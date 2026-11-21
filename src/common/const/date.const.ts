export const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const API_DATE_PATTERN = /^(\d{2})-(\d{2})-(\d{4})$/;
export const API_DATE_MESSAGE = 'must be a date in DD-MM-YYYY format';
export const API_DATE_EXAMPLE = '25-09-2026';
// Matches the `timezone` in mikro-orm.config.ts.
export const BUSINESS_UTC_OFFSET = '+08:00';
