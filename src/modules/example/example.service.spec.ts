import { CreateExampleDto } from './dto/create-example.dto';
import { ExampleService } from './example.service';

describe('ExampleService', () => {
  it('creates and lists example items', () => {
    const service = new ExampleService();

    const item = service.create({ name: 'first example' } as CreateExampleDto);

    expect(item).toMatchObject({ name: 'first example' });
    expect(item.id).toEqual(expect.any(String));
    expect(item.createdAt).toEqual(expect.any(String));
    expect(service.findAll()).toEqual([item]);
  });

  it('returns a copy of the collection', () => {
    const service = new ExampleService();
    service.create({ name: 'first example' } as CreateExampleDto);

    const items = service.findAll();
    items.pop();

    expect(service.findAll()).toHaveLength(1);
  });
});
