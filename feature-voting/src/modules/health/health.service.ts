import { MikroORM } from '@mikro-orm/core';
import { BeforeApplicationShutdown, Injectable } from '@nestjs/common';

@Injectable()
export class HealthService implements BeforeApplicationShutdown {
  private shuttingDown = false;

  constructor(private readonly orm: MikroORM) {}

  /**
   * Fires on SIGTERM, before Nest starts closing anything. Readiness flips
   * first so the load balancer stops sending new requests while in-flight
   * ones finish.
   */
  beforeApplicationShutdown(): void {
    this.shuttingDown = true;
  }

  isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  async isDatabaseReachable(): Promise<boolean> {
    try {
      await this.orm.em.getConnection().execute('select 1');
      return true;
    } catch {
      return false;
    }
  }
}
