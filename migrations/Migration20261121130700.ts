import { Migration } from '@mikro-orm/migrations';

export class Migration20261121130700 extends Migration {

  override name = 'Migration20261121130700';

  override up(): void | Promise<void> {
    this.addSql(`create schema if not exists "feature_dev";`);
    this.addSql(`create table "feature_dev"."roles" ("id" uuid not null, "name" varchar(50) not null, primary key ("id"));`);
    this.addSql(`alter table "feature_dev"."roles" add constraint "roles_name_unique" unique ("name");`);

    this.addSql(`create table "feature_dev"."status" ("id" serial primary key, "name" varchar(100) not null);`);

    this.addSql(`create table "feature_dev"."user" ("id" uuid not null, "name" varchar(255) not null, "username" varchar(100) not null, "password_hash" varchar(255) not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), primary key ("id"));`);
    this.addSql(`alter table "feature_dev"."user" add constraint "user_username_unique" unique ("username");`);

    this.addSql(`create table "feature_dev"."feature_request" ("id" uuid not null, "title" varchar(255) not null, "description" text not null, "status_id" int not null, "created_by" uuid not null, "official_response" text null, "official_response_at" timestamptz null, "official_response_by" uuid null, "vote_count" int not null default 0, "comment_count" int not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), primary key ("id"));`);
    this.addSql(`create index "feature_request_status_id_index" on "feature_dev"."feature_request" ("status_id");`);
    this.addSql(`create index "feature_request_vote_count_index" on "feature_dev"."feature_request" ("vote_count" DESC);`);
    this.addSql(`create index "feature_request_created_at_index" on "feature_dev"."feature_request" ("created_at" DESC);`);

    this.addSql(`create table "feature_dev"."request_merge" ("id" uuid not null, "source_request_id" uuid not null, "target_request_id" uuid not null, "created_by" uuid not null, "votes_moved" int not null, "comments_moved" int not null, "created_at" timestamptz not null default now(), primary key ("id"));`);
    this.addSql(`alter table "feature_dev"."request_merge" add constraint "request_merge_source_request_id_unique" unique ("source_request_id");`);
    this.addSql(`create index "request_merge_target_request_id_index" on "feature_dev"."request_merge" ("target_request_id");`);

    this.addSql(`create table "feature_dev"."comment" ("id" uuid not null, "user_id" uuid not null, "feature_request_id" uuid not null, "body" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), primary key ("id"));`);
    this.addSql(`create index "comment_feature_request_id_created_at_index" on "feature_dev"."comment" ("feature_request_id", "created_at");`);

    this.addSql(`create table "feature_dev"."user_roles" ("id" uuid not null, "user_id" uuid not null, "roles_id" uuid not null, primary key ("id"));`);
    this.addSql(`alter table "feature_dev"."user_roles" add constraint "user_roles_user_id_roles_id_unique" unique ("user_id", "roles_id");`);

    this.addSql(`create table "feature_dev"."votes" ("user_id" uuid not null, "feature_request_id" uuid not null, "created_at" timestamptz not null default now(), primary key ("user_id", "feature_request_id"));`);
    this.addSql(`create index "votes_feature_request_id_index" on "feature_dev"."votes" ("feature_request_id");`);

    this.addSql(`alter table "feature_dev"."feature_request" add constraint "feature_request_status_id_foreign" foreign key ("status_id") references "feature_dev"."status" ("id");`);
    this.addSql(`alter table "feature_dev"."feature_request" add constraint "feature_request_created_by_foreign" foreign key ("created_by") references "feature_dev"."user" ("id");`);
    this.addSql(`alter table "feature_dev"."feature_request" add constraint "feature_request_official_response_by_foreign" foreign key ("official_response_by") references "feature_dev"."user" ("id") on delete set null;`);
    this.addSql(`alter table "feature_dev"."feature_request" add constraint "feature_request_vote_count_check" check (vote_count >= 0);`);
    this.addSql(`alter table "feature_dev"."feature_request" add constraint "feature_request_comment_count_check" check (comment_count >= 0);`);

    this.addSql(`alter table "feature_dev"."request_merge" add constraint "request_merge_source_request_id_foreign" foreign key ("source_request_id") references "feature_dev"."feature_request" ("id");`);
    this.addSql(`alter table "feature_dev"."request_merge" add constraint "request_merge_target_request_id_foreign" foreign key ("target_request_id") references "feature_dev"."feature_request" ("id");`);
    this.addSql(`alter table "feature_dev"."request_merge" add constraint "request_merge_created_by_foreign" foreign key ("created_by") references "feature_dev"."user" ("id");`);
    this.addSql(`alter table "feature_dev"."request_merge" add constraint "request_merge_source_not_target" check (source_request_id <> target_request_id);`);

    this.addSql(`alter table "feature_dev"."comment" add constraint "comment_user_id_foreign" foreign key ("user_id") references "feature_dev"."user" ("id");`);
    this.addSql(`alter table "feature_dev"."comment" add constraint "comment_feature_request_id_foreign" foreign key ("feature_request_id") references "feature_dev"."feature_request" ("id");`);

    this.addSql(`alter table "feature_dev"."user_roles" add constraint "user_roles_user_id_foreign" foreign key ("user_id") references "feature_dev"."user" ("id");`);
    this.addSql(`alter table "feature_dev"."user_roles" add constraint "user_roles_roles_id_foreign" foreign key ("roles_id") references "feature_dev"."roles" ("id");`);

    this.addSql(`alter table "feature_dev"."votes" add constraint "votes_user_id_foreign" foreign key ("user_id") references "feature_dev"."user" ("id") on update cascade on delete cascade;`);
    this.addSql(`alter table "feature_dev"."votes" add constraint "votes_feature_request_id_foreign" foreign key ("feature_request_id") references "feature_dev"."feature_request" ("id") on update cascade on delete cascade;`);
  }

  override down(): void | Promise<void> {
    this.addSql(`drop table if exists "feature_dev"."roles" cascade;`);
    this.addSql(`drop table if exists "feature_dev"."status" cascade;`);
    this.addSql(`drop table if exists "feature_dev"."user" cascade;`);
    this.addSql(`drop table if exists "feature_dev"."feature_request" cascade;`);
    this.addSql(`drop table if exists "feature_dev"."request_merge" cascade;`);
    this.addSql(`drop table if exists "feature_dev"."comment" cascade;`);
    this.addSql(`drop table if exists "feature_dev"."user_roles" cascade;`);
    this.addSql(`drop table if exists "feature_dev"."votes" cascade;`);
  }

}
