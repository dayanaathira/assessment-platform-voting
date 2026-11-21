import { SetMetadata } from '@nestjs/common';

export const RESPONSE_MESSAGE_KEY = 'responseMessage';
export const RAW_RESPONSE_KEY = 'rawResponse';

/**
 * Sets the `message` of the wrapped success response.
 *
 * @param message - Message to return to the client.
 * @returns The metadata decorator.
 */
export const ResponseMessage = (message: string) =>
  SetMetadata(RESPONSE_MESSAGE_KEY, message);

/**
 * Skips the response wrapper, for routes with a fixed body such as probes.
 *
 * @returns The metadata decorator.
 */
export const RawResponse = () => SetMetadata(RAW_RESPONSE_KEY, true);
