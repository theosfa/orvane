import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRecipeTranslations1790000000003 implements MigrationInterface {
    name = 'AddRecipeTranslations1790000000003'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // существующие рецепты написаны на английском
        await queryRunner.query(`ALTER TABLE "recipes" ADD "originalLanguage" character varying(5) NOT NULL DEFAULT 'en'`);
        await queryRunner.query(`CREATE TABLE "recipe_translations" ("id" SERIAL NOT NULL, "recipeId" integer NOT NULL, "language" character varying(5) NOT NULL, "name" character varying NOT NULL, "isMachine" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_recipe_translations" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_recipe_translations_recipe_language" ON "recipe_translations" ("recipeId", "language") `);
        await queryRunner.query(`ALTER TABLE "recipe_translations" ADD CONSTRAINT "FK_recipe_translations_recipeId" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`CREATE TABLE "recipe_step_translations" ("id" SERIAL NOT NULL, "stepId" integer NOT NULL, "language" character varying(5) NOT NULL, "text" text NOT NULL, "isMachine" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_recipe_step_translations" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_recipe_step_translations_step_language" ON "recipe_step_translations" ("stepId", "language") `);
        await queryRunner.query(`ALTER TABLE "recipe_step_translations" ADD CONSTRAINT "FK_recipe_step_translations_stepId" FOREIGN KEY ("stepId") REFERENCES "recipe_steps"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "recipe_step_translations" DROP CONSTRAINT "FK_recipe_step_translations_stepId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_recipe_step_translations_step_language"`);
        await queryRunner.query(`DROP TABLE "recipe_step_translations"`);
        await queryRunner.query(`ALTER TABLE "recipe_translations" DROP CONSTRAINT "FK_recipe_translations_recipeId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_recipe_translations_recipe_language"`);
        await queryRunner.query(`DROP TABLE "recipe_translations"`);
        await queryRunner.query(`ALTER TABLE "recipes" DROP COLUMN "originalLanguage"`);
    }
}
