import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsDateString, Matches } from 'class-validator';
import { API_DATE_MESSAGE, DATE_ONLY_PATTERN } from '../const/date.const';
import { fromApiDate } from '../utils/date.util';

/**
 * Accepts a `DD-MM-YYYY` date and converts it to `YYYY-MM-DD`. Anything else,
 * including impossible dates, fails validation.
 *
 * @returns The combined decorator.
 */
export function IsApiDate() {
  const message = `$property ${API_DATE_MESSAGE}`;

  return applyDecorators(
    Transform(({ value }) =>
      typeof value === 'string' ? (fromApiDate(value) ?? '') : value,
    ),
    IsDateString({ strict: true }, { message }),
    Matches(DATE_ONLY_PATTERN, { message }),
  );
}
