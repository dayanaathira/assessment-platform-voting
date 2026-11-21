import type { Response } from 'express';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let healthService: {
    isShuttingDown: jest.Mock;
    isDatabaseReachable: jest.Mock;
  };
  let controller: HealthController;
  let response: Response;
  let status: jest.Mock;

  beforeEach(() => {
    healthService = {
      isShuttingDown: jest.fn().mockReturnValue(false),
      isDatabaseReachable: jest.fn().mockResolvedValue(true),
    };
    status = jest.fn();
    response = { status } as unknown as Response;
    controller = new HealthController(
      healthService as unknown as HealthService,
    );
  });

  describe('liveness', () => {
    it('answers ok', () => {
      expect(controller.liveness()).toEqual({ status: 'ok' });
    });

    // A brief database blip must not get healthy pods restarted.
    it('never consults the database', () => {
      controller.liveness();

      expect(healthService.isDatabaseReachable).not.toHaveBeenCalled();
    });
  });

  describe('readiness', () => {
    it('is 200 when the database is reachable', async () => {
      const body = await controller.readiness(response);

      expect(status).toHaveBeenCalledWith(200);
      expect(body).toEqual({ status: 'ready', database: 'up' });
    });

    it('is 503 when the database is unreachable', async () => {
      healthService.isDatabaseReachable.mockResolvedValue(false);

      const body = await controller.readiness(response);

      expect(status).toHaveBeenCalledWith(503);
      expect(body).toEqual({ status: 'not_ready', database: 'down' });
    });

    // On SIGTERM the load balancer must stop sending new requests while
    // in-flight ones finish, without waiting for a database round trip.
    it('is 503 as soon as shutdown begins, without checking the database', async () => {
      healthService.isShuttingDown.mockReturnValue(true);

      const body = await controller.readiness(response);

      expect(status).toHaveBeenCalledWith(503);
      expect(body.status).toBe('shutting_down');
      expect(healthService.isDatabaseReachable).not.toHaveBeenCalled();
    });
  });
});

describe('HealthService', () => {
  const serviceWith = (execute: jest.Mock) =>
    new HealthService({
      em: { getConnection: () => ({ execute }) },
    } as never);

  it('reports the database as reachable when the probe query succeeds', async () => {
    const service = serviceWith(jest.fn().mockResolvedValue([{ '?column?': 1 }]));

    await expect(service.isDatabaseReachable()).resolves.toBe(true);
  });

  it('reports the database as unreachable instead of throwing', async () => {
    const service = serviceWith(
      jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    );

    await expect(service.isDatabaseReachable()).resolves.toBe(false);
  });

  it('flips to shutting down before the application closes', () => {
    const service = serviceWith(jest.fn());

    expect(service.isShuttingDown()).toBe(false);
    service.beforeApplicationShutdown();
    expect(service.isShuttingDown()).toBe(true);
  });
});
