import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserLanguage1790000000000 implements MigrationInterface {
    name = 'AddUserLanguage1790000000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "language" character varying(5) NOT NULL DEFAULT 'ru'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "language"`);
    }
}
