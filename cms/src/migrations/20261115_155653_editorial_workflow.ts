import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_articles_review_status" AS ENUM('draft', 'in_review', 'changes_requested', 'approved');
  CREATE TYPE "public"."enum__articles_v_version_review_status" AS ENUM('draft', 'in_review', 'changes_requested', 'approved');
  ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text;
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'author'::text;
  DROP TYPE "public"."enum_users_role";
  CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'reviewer', 'editor', 'author');
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'author'::"public"."enum_users_role";
  ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."enum_users_role" USING "role"::"public"."enum_users_role";
  ALTER TABLE "articles" ADD COLUMN "owner_id" integer;
  ALTER TABLE "articles" ADD COLUMN "review_status" "public"."enum_articles_review_status" DEFAULT 'draft';
  ALTER TABLE "articles" ADD COLUMN "review_notes" varchar;
  ALTER TABLE "_articles_v" ADD COLUMN "version_owner_id" integer;
  ALTER TABLE "_articles_v" ADD COLUMN "version_review_status" "public"."enum__articles_v_version_review_status" DEFAULT 'draft';
  ALTER TABLE "_articles_v" ADD COLUMN "version_review_notes" varchar;
  ALTER TABLE "articles" ADD CONSTRAINT "articles_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v" ADD CONSTRAINT "_articles_v_version_owner_id_users_id_fk" FOREIGN KEY ("version_owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "articles_owner_idx" ON "articles" USING btree ("owner_id");
  CREATE INDEX "_articles_v_version_version_owner_idx" ON "_articles_v" USING btree ("version_owner_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "articles" DROP CONSTRAINT "articles_owner_id_users_id_fk";
  
  ALTER TABLE "_articles_v" DROP CONSTRAINT "_articles_v_version_owner_id_users_id_fk";
  
  ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text;
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'editor'::text;
  DROP TYPE "public"."enum_users_role";
  CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'editor');
  ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'editor'::"public"."enum_users_role";
  ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE "public"."enum_users_role" USING (CASE WHEN "role" = 'admin' THEN 'admin'::"public"."enum_users_role" ELSE 'editor'::"public"."enum_users_role" END);
  DROP INDEX "articles_owner_idx";
  DROP INDEX "_articles_v_version_version_owner_idx";
  ALTER TABLE "articles" DROP COLUMN "owner_id";
  ALTER TABLE "articles" DROP COLUMN "review_status";
  ALTER TABLE "articles" DROP COLUMN "review_notes";
  ALTER TABLE "_articles_v" DROP COLUMN "version_owner_id";
  ALTER TABLE "_articles_v" DROP COLUMN "version_review_status";
  ALTER TABLE "_articles_v" DROP COLUMN "version_review_notes";
  DROP TYPE "public"."enum_articles_review_status";
  DROP TYPE "public"."enum__articles_v_version_review_status";`)
}
