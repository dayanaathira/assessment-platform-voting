import { join } from 'node:path';
import { WinstonModuleOptions } from 'nest-winston';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import {
  DEFAULT_LOG_DIR,
  DEFAULT_LOG_LEVEL,
  LOG_RETENTION,
} from '../const/logger.const';
import { getRequestId } from '../utils/request-context.util';

/**
 * A daily-rotated JSON log file under `logDir`.
 *
 * @param logDir - Root log directory.
 * @param folder - Sub-folder, e.g. `errors`.
 * @param name - File name prefix; the date is appended.
 * @param level - Lowest level written; omit to inherit the logger's.
 * @returns The transport.
 */
function dailyFile(
  logDir: string,
  folder: string,
  name: string,
  level?: string,
): DailyRotateFile {
  return new DailyRotateFile({
    dirname: join(logDir, folder),
    filename: `${name}-%DATE%.log`,
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxFiles: LOG_RETENTION,
    level,
  });
}

/**
 * Structured JSON to stdout and to daily log files, with the request ID added
 * at write time:
 * - `applications/` everything at `level`
 * - `errors/` errors only, the first place to look when something breaks
 * - `exceptions/` uncaught exceptions and unhandled rejections
 *
 * @param serviceName - Written as `service` on every log line.
 * @param level - Lowest level to log; defaults to `LOG_LEVEL` or `http`.
 * @param logDir - Where log files go; defaults to `LOG_DIR` or `logs`.
 * @returns Options for `WinstonModule.forRoot()`.
 */
export function createWinstonOptions(
  serviceName: string,
  level = process.env.LOG_LEVEL || DEFAULT_LOG_LEVEL,
  logDir = process.env.LOG_DIR || DEFAULT_LOG_DIR,
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
    transports: [
      new winston.transports.Console(),
      dailyFile(logDir, 'applications', 'app'),
      dailyFile(logDir, 'errors', 'error', 'error'),
    ],
    exceptionHandlers: [dailyFile(logDir, 'exceptions', 'exceptions')],
    rejectionHandlers: [dailyFile(logDir, 'exceptions', 'rejections')],
  };
}
