import { MigrationInterface, QueryRunner } from "typeorm";
import { firstFreeUsername, usernameBase } from "../users/username";

export class AddUsernamesAndFollows1790000000009 implements MigrationInterface {
    name = 'AddUsernamesAndFollows1790000000009'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "username" character varying(30)`);
        await queryRunner.query(`ALTER TABLE "users" ADD "firstName" character varying(50) NOT NULL DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "users" ADD "lastName" character varying(50) NOT NULL DEFAULT ''`);
        await queryRunner.query(`ALTER TABLE "users" ADD "showFullName" boolean NOT NULL DEFAULT false`);

        // ники для уже зарегистрированных: из email, при совпадении — с номером
        const users: { id: number; email: string }[] = await queryRunner.query(`SELECT "id", "email" FROM "users" ORDER BY "id"`);
        const taken = new Set<string>();
        for (const u of users) {
            const username = firstFreeUsername(usernameBase(u.email), taken);
            taken.add(username);
            await queryRunner.query(`UPDATE "users" SET "username" = $1 WHERE "id" = $2`, [username, u.id]);
        }
        await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_users_username" UNIQUE ("username")`);

        await queryRunner.query(`CREATE TABLE "user_follows" ("id" SERIAL NOT NULL, "followerId" integer NOT NULL, "followeeId" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_user_follows_pair" UNIQUE ("followerId", "followeeId"), CONSTRAINT "PK_user_follows" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_user_follows_followeeId" ON "user_follows" ("followeeId") `);
        await queryRunner.query(`ALTER TABLE "user_follows" ADD CONSTRAINT "FK_user_follows_followerId" FOREIGN KEY ("followerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_follows" ADD CONSTRAINT "FK_user_follows_followeeId" FOREIGN KEY ("followeeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_follows" DROP CONSTRAINT "FK_user_follows_followeeId"`);
        await queryRunner.query(`ALTER TABLE "user_follows" DROP CONSTRAINT "FK_user_follows_followerId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_user_follows_followeeId"`);
        await queryRunner.query(`DROP TABLE "user_follows"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_users_username"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "showFullName"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "lastName"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "firstName"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "username"`);
    }
}
