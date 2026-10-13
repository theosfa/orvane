import { MigrationInterface, QueryRunner } from "typeorm";

export class InitRecipes1788961859291 implements MigrationInterface {
    name = 'InitRecipes1788961859291'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "recipe_ingredients" ("id" SERIAL NOT NULL, "amount" numeric(8,2) NOT NULL, "recipeId" integer, "ingredientId" integer, CONSTRAINT "PK_8f15a314e55970414fc92ffb532" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "recipe_steps" ("id" SERIAL NOT NULL, "stepNum" integer NOT NULL, "stepText" text NOT NULL, "recipeId" integer, CONSTRAINT "PK_6fa74d528684e8dc16bfe8582f2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "recipes" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, CONSTRAINT "PK_8f09680a51bf3669c1598a21682" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "FK_2d7f407ae694e91bb3da1798c61" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "FK_05a2b62604dfd9840f4cda76a93" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "recipe_steps" ADD CONSTRAINT "FK_23dbbd153fb156e488959fc2bf8" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "recipe_steps" DROP CONSTRAINT "FK_23dbbd153fb156e488959fc2bf8"`);
        await queryRunner.query(`ALTER TABLE "recipe_ingredients" DROP CONSTRAINT "FK_05a2b62604dfd9840f4cda76a93"`);
        await queryRunner.query(`ALTER TABLE "recipe_ingredients" DROP CONSTRAINT "FK_2d7f407ae694e91bb3da1798c61"`);
        await queryRunner.query(`DROP TABLE "recipes"`);
        await queryRunner.query(`DROP TABLE "recipe_steps"`);
        await queryRunner.query(`DROP TABLE "recipe_ingredients"`);
    }

}
