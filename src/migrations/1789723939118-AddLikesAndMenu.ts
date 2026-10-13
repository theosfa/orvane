import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLikesAndMenu1789723939118 implements MigrationInterface {
    name = 'AddLikesAndMenu1789723939118'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "recipe_likes" ("id" SERIAL NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" integer NOT NULL, "recipeId" integer NOT NULL, CONSTRAINT "UQ_446c1331371e2dc6762fa7b9bb6" UNIQUE ("userId", "recipeId"), CONSTRAINT "PK_8568e2f677e57805acc75f0f564" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "menu_entries" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "dayOfWeek" smallint NOT NULL, "mealType" character varying(20) NOT NULL DEFAULT 'dinner', "recipeId" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_b49fb72ca3afbbaa8ce17d90b9e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "recipe_likes" ADD CONSTRAINT "FK_798aabac5723398ed96a2604fb5" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "recipe_likes" ADD CONSTRAINT "FK_762414c1f60e0a870a342509862" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "menu_entries" ADD CONSTRAINT "FK_4acfa6d93c942e3c633a3db0d15" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "menu_entries" ADD CONSTRAINT "FK_c56dac11d05965e2380d4f9f01a" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "menu_entries" DROP CONSTRAINT "FK_c56dac11d05965e2380d4f9f01a"`);
        await queryRunner.query(`ALTER TABLE "menu_entries" DROP CONSTRAINT "FK_4acfa6d93c942e3c633a3db0d15"`);
        await queryRunner.query(`ALTER TABLE "recipe_likes" DROP CONSTRAINT "FK_762414c1f60e0a870a342509862"`);
        await queryRunner.query(`ALTER TABLE "recipe_likes" DROP CONSTRAINT "FK_798aabac5723398ed96a2604fb5"`);
        await queryRunner.query(`DROP TABLE "menu_entries"`);
        await queryRunner.query(`DROP TABLE "recipe_likes"`);
    }

}
