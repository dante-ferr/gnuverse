import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`CREATE TYPE "public"."enum_quizzes_status" AS ENUM('draft', 'in_review', 'changes_requested', 'published');
CREATE TABLE "quizzes_questions_choices" (
	"_order" integer NOT NULL,
	"_parent_id" varchar NOT NULL,
	"id" varchar PRIMARY KEY NOT NULL,
	"text" varchar NOT NULL
);

CREATE TABLE "quizzes_questions" (
	"_order" integer NOT NULL,
	"_parent_id" integer NOT NULL,
	"id" varchar PRIMARY KEY NOT NULL,
	"prompt" varchar NOT NULL,
	"correct_answer" numeric NOT NULL,
	"explanation" varchar NOT NULL
);

CREATE TABLE "quizzes" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar NOT NULL,
	"slug" varchar NOT NULL,
	"summary" varchar NOT NULL,
	"article_id" integer,
	"owner_id" integer,
	"status" "enum_quizzes_status" DEFAULT 'draft' NOT NULL,
	"review_notes" varchar,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "quizzes_id" integer;
ALTER TABLE "quizzes_questions_choices" ADD CONSTRAINT "quizzes_questions_choices_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quizzes_questions"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "quizzes_questions" ADD CONSTRAINT "quizzes_questions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
CREATE INDEX "quizzes_questions_choices_order_idx" ON "quizzes_questions_choices" USING btree ("_order");
CREATE INDEX "quizzes_questions_choices_parent_id_idx" ON "quizzes_questions_choices" USING btree ("_parent_id");
CREATE INDEX "quizzes_questions_order_idx" ON "quizzes_questions" USING btree ("_order");
CREATE INDEX "quizzes_questions_parent_id_idx" ON "quizzes_questions" USING btree ("_parent_id");
CREATE UNIQUE INDEX "quizzes_slug_idx" ON "quizzes" USING btree ("slug");
CREATE INDEX "quizzes_article_idx" ON "quizzes" USING btree ("article_id");
CREATE INDEX "quizzes_owner_idx" ON "quizzes" USING btree ("owner_id");
CREATE INDEX "quizzes_status_idx" ON "quizzes" USING btree ("status");
CREATE INDEX "quizzes_updated_at_idx" ON "quizzes" USING btree ("updated_at");
CREATE INDEX "quizzes_created_at_idx" ON "quizzes" USING btree ("created_at");
ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_quizzes_fk" FOREIGN KEY ("quizzes_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "payload_locked_documents_rels_quizzes_id_idx" ON "payload_locked_documents_rels" USING btree ("quizzes_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_quizzes_fk";
ALTER TABLE "quizzes_questions_choices" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "quizzes_questions" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "quizzes" DISABLE ROW LEVEL SECURITY;
DROP TABLE "quizzes_questions_choices" CASCADE;
DROP TABLE "quizzes_questions" CASCADE;
DROP TABLE "quizzes" CASCADE;

DROP INDEX "payload_locked_documents_rels_quizzes_id_idx";
ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "quizzes_id";
DROP TYPE "public"."enum_quizzes_status";`)
}
