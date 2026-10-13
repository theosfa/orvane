import { MigrationInterface, QueryRunner } from "typeorm";

export class DatedMenuAndTasks1790000000006 implements MigrationInterface {
    name = 'DatedMenuAndTasks1790000000006'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // меню: день недели -> конкретная дата; старые записи переезжают на текущую неделю
        await queryRunner.query(`ALTER TABLE "menu_entries" ADD "date" date`);
        await queryRunner.query(`UPDATE "menu_entries" SET "date" = date_trunc('week', now())::date + "dayOfWeek"`);
        await queryRunner.query(`ALTER TABLE "menu_entries" ALTER COLUMN "date" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "menu_entries" DROP COLUMN "dayOfWeek"`);
        await queryRunner.query(`ALTER TABLE "menu_entries" ADD "servings" smallint NOT NULL DEFAULT 1`);
        await queryRunner.query(`CREATE INDEX "IDX_menu_entries_user_date" ON "menu_entries" ("userId", "date") `);

        await queryRunner.query(`CREATE TABLE "tasks" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "title" character varying(200) NOT NULL, "notes" text NOT NULL DEFAULT '', "date" date NOT NULL, "done" boolean NOT NULL DEFAULT false, "source" character varying(20) NOT NULL DEFAULT 'manual', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_tasks" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_tasks_user_date" ON "tasks" ("userId", "date") `);
        await queryRunner.query(`ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_userId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_tasks_user_date"`);
        await queryRunner.query(`DROP TABLE "tasks"`);

        await queryRunner.query(`DROP INDEX "public"."IDX_menu_entries_user_date"`);
        await queryRunner.query(`ALTER TABLE "menu_entries" DROP COLUMN "servings"`);
        await queryRunner.query(`ALTER TABLE "menu_entries" ADD "dayOfWeek" smallint`);
        await queryRunner.query(`UPDATE "menu_entries" SET "dayOfWeek" = (EXTRACT(ISODOW FROM "date") - 1)`);
        await queryRunner.query(`ALTER TABLE "menu_entries" ALTER COLUMN "dayOfWeek" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "menu_entries" DROP COLUMN "date"`);
    }
}
