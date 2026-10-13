import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRefreshTokens1790000000001 implements MigrationInterface {
    name = 'AddRefreshTokens1790000000001'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "refresh_tokens" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "tokenHash" character varying(64) NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "revokedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_refresh_tokens_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_refresh_tokens_tokenHash" ON "refresh_tokens" ("tokenHash") `);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_refresh_tokens_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_refresh_tokens_userId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_refresh_tokens_tokenHash"`);
        await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    }
}
