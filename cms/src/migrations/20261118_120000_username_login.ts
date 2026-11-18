import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" varchar;
    UPDATE "users"
      SET "username" = lower(trim("nickname"))
      WHERE "username" IS NULL AND "nickname" IS NOT NULL AND trim("nickname") <> '';
    UPDATE "users"
      SET "username" = 'user_' || "id"::text
      WHERE "username" IS NULL OR trim("username") = '';
    ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS "users_username_idx" ON "users" USING btree ("username");
    DROP INDEX IF EXISTS "users_nickname_idx";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "nickname";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "nickname" varchar;
    UPDATE "users" SET "nickname" = "username" WHERE "nickname" IS NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS "users_nickname_idx" ON "users" USING btree ("nickname");
    DROP INDEX IF EXISTS "users_username_idx";
    ALTER TABLE "users" DROP COLUMN IF EXISTS "username";
  `)
}
