import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRecipePhotos1790000000011 implements MigrationInterface {
  name = 'AddRecipePhotos1790000000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "recipe_photos" ("id" uuid NOT NULL, "recipeId" integer, "uploaderId" integer NOT NULL, "position" smallint NOT NULL DEFAULT 0, "source" character varying(10) NOT NULL DEFAULT 'upload', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_recipe_photos" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_recipe_photos_recipeId" ON "recipe_photos" ("recipeId")`);
    await queryRunner.query(
      `ALTER TABLE "recipe_photos" ADD CONSTRAINT "FK_recipe_photos_recipeId" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "recipe_photos" ADD CONSTRAINT "FK_recipe_photos_uploaderId" FOREIGN KEY ("uploaderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "recipe_photos" DROP CONSTRAINT "FK_recipe_photos_uploaderId"`);
    await queryRunner.query(`ALTER TABLE "recipe_photos" DROP CONSTRAINT "FK_recipe_photos_recipeId"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_recipe_photos_recipeId"`);
    await queryRunner.query(`DROP TABLE "recipe_photos"`);
  }
}
