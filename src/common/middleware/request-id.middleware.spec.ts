import type { NextFunction, Request, Response } from 'express';
import {
  REQUEST_ID_HEADER,
  REQUEST_ID_MAX_LENGTH,
} from '../const/request-id.const';
import { getRequestId } from '../utils/request-context.util';
import { requestIdMiddleware } from './request-id.middleware';

describe('requestIdMiddleware', () => {
  const responseFor = () => ({ setHeader: jest.fn() }) as unknown as Response;

  it('preserves a safe inbound request ID and exposes it in the response', () => {
    const response = responseFor();
    const next = jest.fn(() => {
      expect(getRequestId()).toBe('client-request-123');
    });

    requestIdMiddleware(
      {
        headers: { [REQUEST_ID_HEADER]: 'client-request-123' },
      } as unknown as Request,
      response,
      next as NextFunction,
    );

    expect(response.setHeader).toHaveBeenCalledWith(
      REQUEST_ID_HEADER,
      'client-request-123',
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('generates a bounded ID when the inbound value is unsafe', () => {
    const response = responseFor();
    const next = jest.fn(() => {
      expect(getRequestId()).toHaveLength(36);
    });

    requestIdMiddleware(
      {
        headers: {
          [REQUEST_ID_HEADER]: `bad\r\nvalue${'x'.repeat(REQUEST_ID_MAX_LENGTH)}`,
        },
      } as unknown as Request,
      response,
      next as NextFunction,
    );

    expect(response.setHeader).toHaveBeenCalledWith(
      REQUEST_ID_HEADER,
      expect.any(String),
    );
    expect(next).toHaveBeenCalledTimes(1);
  });
});
