import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import {
  REQUEST_ID_HEADER,
  REQUEST_ID_MAX_LENGTH,
  SAFE_REQUEST_ID,
} from '../const/request-id.const';
import { requestContext } from '../utils/request-context.util';

/**
 * Checks that an inbound request ID is safe to echo back and log.
 *
 * @param value - The raw `x-request-id` header value.
 * @returns True when the value is a short string of safe characters.
 */
function isUsableRequestId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= REQUEST_ID_MAX_LENGTH &&
    SAFE_REQUEST_ID.test(value)
  );
}

/**
 * Keeps a safe inbound `x-request-id` or generates one, returns it in the
 * response and makes it available to the logger for the rest of the request.
 *
 * @param request - The incoming request.
 * @param response - The outgoing response.
 * @param next - Continues the middleware chain.
 * @returns Nothing.
 */
export function requestIdMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const inboundRequestId = request.headers[REQUEST_ID_HEADER];
  const requestId = isUsableRequestId(inboundRequestId)
    ? inboundRequestId
    : randomUUID();

  response.setHeader(REQUEST_ID_HEADER, requestId);
  requestContext.run({ requestId }, next);
}
