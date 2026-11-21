import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CreateExampleDto } from './dto/create-example.dto';

export interface ExampleItem {
  id: string;
  name: string;
  createdAt: string;
}

/**
 * A deliberately persistence-free worked example. Add an entity and a
 * reviewed migration when the service has a real domain schema to own.
 */
@Injectable()
export class ExampleService {
  private readonly items: ExampleItem[] = [];

  findAll(): ExampleItem[] {
    return [...this.items];
  }

  create(input: CreateExampleDto): ExampleItem {
    const item: ExampleItem = {
      id: randomUUID(),
      name: input.name,
      createdAt: new Date().toISOString(),
    };

    this.items.push(item);
    return item;
  }
}
