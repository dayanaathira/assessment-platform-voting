import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';

/**
 * Applies a standard set of Swagger `@ApiOperation`/`@ApiResponse` decorators
 * to a route handler: the given success response, plus the common 400/401/500
 * error responses every endpoint can produce.
 *
 * @param summary - Short Swagger summary for the operation.
 * @param description - Longer Swagger description for the operation.
 * @param statusCode - The HTTP status code to document for the success case.
 * @returns A combined decorator, via {@link applyDecorators}.
 */
export function CustomApiResponse(
  summary: string,
  description: string,
  statusCode: number,
) {
  return applyDecorators(
    ApiOperation({ summary, description }),
    ApiResponse({ status: statusCode, description: 'Successful.' }),
    ApiResponse({
      status: HttpStatus.BAD_REQUEST,
      description: 'Bad request with error message.',
    }),
    ApiResponse({
      status: HttpStatus.UNAUTHORIZED,
      description: 'Unauthorized request.',
    }),
    ApiResponse({
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      description: 'Internal Server Error.',
    }),
  );
}
