import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRecipeVisibility1790000000002 implements MigrationInterface {
    name = 'AddRecipeVisibility1790000000002'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // существующие рецепты остаются публичными и без автора
        await queryRunner.query(`ALTER TABLE "recipes" ADD "authorId" integer`);
        await queryRunner.query(`ALTER TABLE "recipes" ADD "isPublic" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "recipes" ADD CONSTRAINT "FK_recipes_authorId" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "recipes" DROP CONSTRAINT "FK_recipes_authorId"`);
        await queryRunner.query(`ALTER TABLE "recipes" DROP COLUMN "isPublic"`);
        await queryRunner.query(`ALTER TABLE "recipes" DROP COLUMN "authorId"`);
    }
}
