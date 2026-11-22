import { Migration } from '@mikro-orm/migrations';

export class Migration20261121133645 extends Migration {

  override name = 'Migration20261121133645';

  override up(): void | Promise<void> {
    this.addSql(`alter table "feature_dev"."feature_request" add "updated_by" uuid null;`);
    this.addSql(`alter table "feature_dev"."feature_request" add constraint "feature_request_updated_by_foreign" foreign key ("updated_by") references "feature_dev"."user" ("id") on delete set null;`);

    this.addSql(`alter table "feature_dev"."comment" add "created_by" uuid null, add "updated_by" uuid null;`);
    this.addSql(`alter table "feature_dev"."comment" add constraint "comment_created_by_foreign" foreign key ("created_by") references "feature_dev"."user" ("id") on delete set null;`);
    this.addSql(`alter table "feature_dev"."comment" add constraint "comment_updated_by_foreign" foreign key ("updated_by") references "feature_dev"."user" ("id") on delete set null;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`alter table "feature_dev"."comment" drop constraint "comment_created_by_foreign";`);
    this.addSql(`alter table "feature_dev"."comment" drop constraint "comment_updated_by_foreign";`);

    this.addSql(`alter table "feature_dev"."feature_request" drop constraint "feature_request_updated_by_foreign";`);

    this.addSql(`alter table "feature_dev"."comment" drop column "created_by", drop column "updated_by";`);

    this.addSql(`alter table "feature_dev"."feature_request" drop column "updated_by";`);
  }

}
