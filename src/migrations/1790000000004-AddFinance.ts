import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFinance1790000000004 implements MigrationInterface {
    name = 'AddFinance1790000000004'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "financeSeeded" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`CREATE TABLE "wallets" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "name" character varying(60) NOT NULL, "initialBalance" numeric(12,2) NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_wallets" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "wallets" ADD CONSTRAINT "FK_wallets_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`CREATE TABLE "finance_categories" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "name" character varying(60) NOT NULL, "type" character varying(10) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_finance_categories" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "finance_categories" ADD CONSTRAINT "FK_finance_categories_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`CREATE TABLE "finance_transactions" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "walletId" integer NOT NULL, "categoryId" integer, "type" character varying(10) NOT NULL, "amount" numeric(12,2) NOT NULL, "note" character varying(200) NOT NULL DEFAULT '', "date" date NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_finance_transactions" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_finance_transactions_user_date" ON "finance_transactions" ("userId", "date") `);
        await queryRunner.query(`ALTER TABLE "finance_transactions" ADD CONSTRAINT "FK_finance_transactions_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "finance_transactions" ADD CONSTRAINT "FK_finance_transactions_walletId" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "finance_transactions" ADD CONSTRAINT "FK_finance_transactions_categoryId" FOREIGN KEY ("categoryId") REFERENCES "finance_categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "finance_transactions" DROP CONSTRAINT "FK_finance_transactions_categoryId"`);
        await queryRunner.query(`ALTER TABLE "finance_transactions" DROP CONSTRAINT "FK_finance_transactions_walletId"`);
        await queryRunner.query(`ALTER TABLE "finance_transactions" DROP CONSTRAINT "FK_finance_transactions_userId"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_finance_transactions_user_date"`);
        await queryRunner.query(`DROP TABLE "finance_transactions"`);
        await queryRunner.query(`ALTER TABLE "finance_categories" DROP CONSTRAINT "FK_finance_categories_userId"`);
        await queryRunner.query(`DROP TABLE "finance_categories"`);
        await queryRunner.query(`ALTER TABLE "wallets" DROP CONSTRAINT "FK_wallets_userId"`);
        await queryRunner.query(`DROP TABLE "wallets"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "financeSeeded"`);
    }
}
