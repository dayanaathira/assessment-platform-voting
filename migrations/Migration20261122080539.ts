import { Migration } from '@mikro-orm/migrations';

export class Migration20261122080539 extends Migration {

  override name = 'Migration20261122080539';

  override up(): void | Promise<void> {
    this.addSql(`create table "feature_dev"."refresh_token" ("id" uuid not null, "user_id" uuid not null, "expires_at" timestamptz not null, "revoked_at" timestamptz null, "created_at" timestamptz not null default now(), primary key ("id"));`);
    this.addSql(`create index "refresh_token_user_id_index" on "feature_dev"."refresh_token" ("user_id");`);

    this.addSql(`alter table "feature_dev"."refresh_token" add constraint "refresh_token_user_id_foreign" foreign key ("user_id") references "feature_dev"."user" ("id") on delete cascade;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "feature_dev"."refresh_token" cascade;`);
  }

}
