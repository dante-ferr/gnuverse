import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TYPE "public"."enum_users_role" ADD VALUE IF NOT EXISTS 'member';`)
  await db.execute(sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "nickname" varchar;
    CREATE UNIQUE INDEX IF NOT EXISTS "users_nickname_idx" ON "users" USING btree ("nickname");`)
}
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP INDEX IF EXISTS "users_nickname_idx";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "nickname";`)
  // PostgreSQL enum values are additive. Keep 'member' to preserve existing users and their restricted access.
}
