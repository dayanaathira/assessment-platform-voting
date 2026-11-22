import { Migration } from '@mikro-orm/migrations';

export class Migration20261121142355 extends Migration {

  override name = 'Migration20261121142355';

  override up(): void | Promise<void> {
    this.addSql(`alter table "feature_dev"."feature_request" add "delete_flag" boolean not null default false;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "feature_dev"."feature_request" drop column "delete_flag";`);
  }

}
