import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGoogleSignIn1790000000012 implements MigrationInterface {
  name = 'AddGoogleSignIn1790000000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // аккаунт, созданный через Google, живёт без пароля
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "passwordHash" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "users" ADD "googleId" character varying(255)`);
    await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "UQ_users_googleId" UNIQUE ("googleId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "UQ_users_googleId"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "googleId"`);
    // у Google-аккаунтов пароля нет — без него вернуть NOT NULL нельзя
    await queryRunner.query(`DELETE FROM "users" WHERE "passwordHash" IS NULL`);
    await queryRunner.query(`ALTER TABLE "users" ALTER COLUMN "passwordHash" SET NOT NULL`);
  }
}
