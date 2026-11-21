import type { TransformFnParams } from 'class-transformer';

/**
 * @param value - Raw search text.
 * @returns An ILIKE pattern matching the text anywhere, with `\`, `%` and `_`
 * escaped so they match literally.
 */
export function containsPattern(value: string): string {
  return `%${value.replace(/[\\%_]/g, '\\$&')}%`;
}

/**
 * `@Transform` callback that trims string input.
 *
 * @param params - class-transformer params.
 * @returns The trimmed value, or the value unchanged if it isn't a string.
 */
export function trimString({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}
