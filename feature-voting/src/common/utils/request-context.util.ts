import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestContext {
  requestId: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

/**
 * Reads the request ID of the request currently being handled.
 *
 * @returns The request ID, or undefined outside a request.
 */
export function getRequestId(): string | undefined {
  return requestContext.getStore()?.requestId;
}
