import { ExampleController } from './example.controller';
import { ExampleService } from './example.service';

describe('ExampleController', () => {
  it('delegates listing and creation to the service', () => {
    const service = {
      findAll: jest.fn().mockReturnValue([]),
      create: jest.fn().mockReturnValue({ id: '1', name: 'example' }),
    } as unknown as ExampleService;
    const controller = new ExampleController(service);

    expect(controller.findAll()).toEqual([]);
    expect(controller.create({ name: 'example' })).toEqual({
      id: '1',
      name: 'example',
    });
    expect(service.findAll).toHaveBeenCalledTimes(1);
    expect(service.create).toHaveBeenCalledWith({ name: 'example' });
  });
});
