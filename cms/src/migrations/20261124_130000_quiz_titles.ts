import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "quizzes" ADD COLUMN "title_key" varchar;
CREATE UNIQUE INDEX "quizzes_title_key_idx" ON "quizzes" USING btree ("title_key");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP INDEX "quizzes_title_key_idx";
ALTER TABLE "quizzes" DROP COLUMN "title_key";`)
}
