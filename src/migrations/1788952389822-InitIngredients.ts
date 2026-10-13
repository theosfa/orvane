import { MigrationInterface, QueryRunner } from "typeorm";

export class InitIngredients1788952389822 implements MigrationInterface {
    name = 'InitIngredients1788952389822'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "ingredient_translations" ("id" SERIAL NOT NULL, "language" character varying(5) NOT NULL, "name" character varying NOT NULL, "ingredientId" integer, CONSTRAINT "PK_0b8e3e0321f43e6f75f5e6ed3d2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ab672f42a44a195c0dce0fb08d" ON "ingredient_translations"  ("ingredientId", "language") `);
        await queryRunner.query(`CREATE TABLE "ingredients" ("id" SERIAL NOT NULL, "slug" character varying NOT NULL, "caloriesPer100g" numeric(6,2) NOT NULL, "proteinPer100g" numeric(6,2) NOT NULL, "fatPer100g" numeric(6,2) NOT NULL, "carbsPer100g" numeric(6,2) NOT NULL, CONSTRAINT "UQ_85c50d1d5f69b9e727a8657003f" UNIQUE ("slug"), CONSTRAINT "PK_9240185c8a5507251c9f15e0649" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "ingredient_translations" ADD CONSTRAINT "FK_43193d670934aa25a4d87a036f3" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ingredient_translations" DROP CONSTRAINT "FK_43193d670934aa25a4d87a036f3"`);
        await queryRunner.query(`DROP TABLE "ingredients"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ab672f42a44a195c0dce0fb08d"`);
        await queryRunner.query(`DROP TABLE "ingredient_translations"`);
    }

}
