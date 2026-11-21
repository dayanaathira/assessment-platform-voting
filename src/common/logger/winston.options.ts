import { WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';
import { DEFAULT_LOG_LEVEL } from '../const/logger.const';
import { getRequestId } from '../utils/request-context.util';

/**
 * Structured JSON to stdout, with the request ID added at write time.
 *
 * @param serviceName - Written as `service` on every log line.
 * @param level - Lowest level to log; defaults to `LOG_LEVEL` or `http`.
 * @returns Options for `WinstonModule.forRoot()`.
 */
export function createWinstonOptions(
  serviceName: string,
  level = process.env.LOG_LEVEL || DEFAULT_LOG_LEVEL,
): WinstonModuleOptions {
  const requestIdFormat = winston.format((info) => {
    const requestId = getRequestId();

    if (requestId) {
      info.requestId = requestId;
    }

    return info;
  });

  return {
    level,
    defaultMeta: { service: serviceName },
    format: winston.format.combine(
      // A format string makes winston use local time (TZ) instead of UTC.
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      winston.format.errors({ stack: true }),
      requestIdFormat(),
      winston.format.json(),
    ),
    transports: [new winston.transports.Console()],
  };
}
