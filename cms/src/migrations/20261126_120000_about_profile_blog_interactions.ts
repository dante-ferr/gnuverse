import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Adds the schema for: team profile fields on users (feat/about, avatar) and the
// article likes/comments collections (feat/blog). Production runs with push: false,
// so without this the /api/team endpoint fails with HTTP 500 (missing columns).
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "show_on_about" boolean DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "about_order" numeric;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_id" integer;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "about_bio" varchar;
DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_avatar_id_media_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "users_avatar_idx" ON "users" USING btree ("avatar_id");

CREATE TABLE IF NOT EXISTS "article_likes" (
  "id" serial PRIMARY KEY NOT NULL,
  "article_id" integer NOT NULL,
  "user_id" integer NOT NULL,
  "like_key" varchar NOT NULL,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "article_comments" (
  "id" serial PRIMARY KEY NOT NULL,
  "article_id" integer NOT NULL,
  "author_id" integer NOT NULL,
  "content" varchar NOT NULL,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "article_likes_id" integer;
ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "article_comments_id" integer;

DO $$ BEGIN
  ALTER TABLE "article_likes" ADD CONSTRAINT "article_likes_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "article_likes" ADD CONSTRAINT "article_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "article_comments" ADD CONSTRAINT "article_comments_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "article_comments" ADD CONSTRAINT "article_comments_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_article_likes_fk" FOREIGN KEY ("article_likes_id") REFERENCES "public"."article_likes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_article_comments_fk" FOREIGN KEY ("article_comments_id") REFERENCES "public"."article_comments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "article_likes_article_idx" ON "article_likes" USING btree ("article_id");
CREATE INDEX IF NOT EXISTS "article_likes_user_idx" ON "article_likes" USING btree ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "article_likes_like_key_idx" ON "article_likes" USING btree ("like_key");
CREATE INDEX IF NOT EXISTS "article_likes_updated_at_idx" ON "article_likes" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "article_likes_created_at_idx" ON "article_likes" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "article_comments_article_idx" ON "article_comments" USING btree ("article_id");
CREATE INDEX IF NOT EXISTS "article_comments_author_idx" ON "article_comments" USING btree ("author_id");
CREATE INDEX IF NOT EXISTS "article_comments_updated_at_idx" ON "article_comments" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "article_comments_created_at_idx" ON "article_comments" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_article_likes_id_idx" ON "payload_locked_documents_rels" USING btree ("article_likes_id");
CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_article_comments_id_idx" ON "payload_locked_documents_rels" USING btree ("article_comments_id");
`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "article_likes_id";
ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "article_comments_id";
DROP TABLE IF EXISTS "article_likes" CASCADE;
DROP TABLE IF EXISTS "article_comments" CASCADE;
ALTER TABLE "users" DROP COLUMN IF EXISTS "show_on_about";
ALTER TABLE "users" DROP COLUMN IF EXISTS "about_order";
ALTER TABLE "users" DROP COLUMN IF EXISTS "avatar_id";
ALTER TABLE "users" DROP COLUMN IF EXISTS "about_bio";
`)
}
