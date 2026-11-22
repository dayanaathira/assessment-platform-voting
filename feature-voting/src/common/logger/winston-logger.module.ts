import { DynamicModule, Global, Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { createWinstonOptions } from './winston.options';
import { WinstonLoggerService } from './winston-logger.service';

@Global()
@Module({})
export class WinstonLoggerModule {
  /**
   * Registers the logger once, globally. Import it in AppModule only.
   *
   * @param serviceName - Written as `service` on every log line.
   * @param level - Overrides `LOG_LEVEL` when given.
   * @returns The configured module.
   */
  static forRoot(serviceName: string, level?: string): DynamicModule {
    return {
      module: WinstonLoggerModule,
      imports: [
        WinstonModule.forRoot(createWinstonOptions(serviceName, level)),
      ],
      providers: [WinstonLoggerService],
      exports: [WinstonLoggerService],
    };
  }
}
