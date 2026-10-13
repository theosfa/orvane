import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRecipeServings1790000000005 implements MigrationInterface {
    name = 'AddRecipeServings1790000000005'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // у существующих рецептов количества считаем на одного человека
        await queryRunner.query(`ALTER TABLE "recipes" ADD "servings" smallint NOT NULL DEFAULT 1`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "recipes" DROP COLUMN "servings"`);
    }
}
