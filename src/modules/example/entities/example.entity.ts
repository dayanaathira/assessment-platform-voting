import { defineEntity, p } from '@mikro-orm/core';

const ExampleSchema = defineEntity({
  name: 'example',
  properties: {
    id: p.integer().primary().autoincrement(),
    name: p.string().type('text').nullable(),
  },
});

export class Example extends ExampleSchema.class {}
ExampleSchema.setClass(Example);
