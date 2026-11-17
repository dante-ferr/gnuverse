import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "articles_hashtags" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "tag" varchar
  );
  
  CREATE TABLE "_articles_v_version_hashtags" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" serial PRIMARY KEY NOT NULL,
    "tag" varchar,
    "_uuid" varchar
  );
  
  ALTER TABLE "articles" ADD COLUMN "published_at" timestamp(3) with time zone;
  ALTER TABLE "_articles_v" ADD COLUMN "version_published_at" timestamp(3) with time zone;
  ALTER TABLE "articles_hashtags" ADD CONSTRAINT "articles_hashtags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_version_hashtags" ADD CONSTRAINT "_articles_v_version_hashtags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_articles_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "articles_hashtags_order_idx" ON "articles_hashtags" USING btree ("_order");
  CREATE INDEX "articles_hashtags_parent_id_idx" ON "articles_hashtags" USING btree ("_parent_id");
  CREATE INDEX "_articles_v_version_hashtags_order_idx" ON "_articles_v_version_hashtags" USING btree ("_order");
  CREATE INDEX "_articles_v_version_hashtags_parent_id_idx" ON "_articles_v_version_hashtags" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles_hashtags" DROP CONSTRAINT "articles_hashtags_parent_id_fk";
  
  ALTER TABLE "_articles_v_version_hashtags" DROP CONSTRAINT "_articles_v_version_hashtags_parent_id_fk";
  
  DROP INDEX "articles_hashtags_order_idx";
  DROP INDEX "articles_hashtags_parent_id_idx";
  DROP INDEX "_articles_v_version_hashtags_order_idx";
  DROP INDEX "_articles_v_version_hashtags_parent_id_idx";
  DROP TABLE "articles_hashtags" CASCADE;
  DROP TABLE "_articles_v_version_hashtags" CASCADE;
  ALTER TABLE "articles" DROP COLUMN "published_at";
  ALTER TABLE "_articles_v" DROP COLUMN "version_published_at";`)
}
