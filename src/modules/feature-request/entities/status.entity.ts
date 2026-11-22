import { defineEntity, p } from '@mikro-orm/core';

const StatusSchema = defineEntity({
  name: 'Status',
  tableName: 'status',
  properties: {
    id: p.integer().primary().autoincrement(),
    name: p.string().length(100),
  },
});

export class Status extends StatusSchema.class {}
StatusSchema.setClass(Status);
