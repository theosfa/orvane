import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFamilies1790000000008 implements MigrationInterface {
    name = 'AddFamilies1790000000008'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "families" ("id" SERIAL NOT NULL, "name" character varying(60) NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_families" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "family_members" ("id" SERIAL NOT NULL, "familyId" integer NOT NULL, "userId" integer NOT NULL, "role" character varying(10) NOT NULL DEFAULT 'member', "joinedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_family_members_userId" UNIQUE ("userId"), CONSTRAINT "PK_family_members" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "family_members" ADD CONSTRAINT "FK_family_members_familyId" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "family_members" ADD CONSTRAINT "FK_family_members_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`CREATE TABLE "family_invites" ("id" SERIAL NOT NULL, "familyId" integer NOT NULL, "email" character varying NOT NULL, "invitedById" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_family_invites_family_email" UNIQUE ("familyId", "email"), CONSTRAINT "PK_family_invites" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "family_invites" ADD CONSTRAINT "FK_family_invites_familyId" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "family_invites" ADD CONSTRAINT "FK_family_invites_invitedById" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        // общие данные семьи: familyId задан — запись семейная, null — личная (userId = владелец)
        for (const table of ["wallets", "finance_categories", "finance_transactions", "tasks", "menu_entries"]) {
            await queryRunner.query(`ALTER TABLE "${table}" ADD "familyId" integer`);
            await queryRunner.query(`ALTER TABLE "${table}" ADD CONSTRAINT "FK_${table}_familyId" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
            await queryRunner.query(`CREATE INDEX "IDX_${table}_familyId" ON "${table}" ("familyId") `);
        }
        // перевод между кошельками — пара записей (расход + доход) с общим transferId; в итогах не считается
        await queryRunner.query(`ALTER TABLE "finance_transactions" ADD "transferId" uuid`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "finance_transactions" DROP COLUMN "transferId"`);
        for (const table of ["menu_entries", "tasks", "finance_transactions", "finance_categories", "wallets"]) {
            await queryRunner.query(`DROP INDEX "public"."IDX_${table}_familyId"`);
            await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "FK_${table}_familyId"`);
            await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN "familyId"`);
        }
        await queryRunner.query(`ALTER TABLE "family_invites" DROP CONSTRAINT "FK_family_invites_invitedById"`);
        await queryRunner.query(`ALTER TABLE "family_invites" DROP CONSTRAINT "FK_family_invites_familyId"`);
        await queryRunner.query(`DROP TABLE "family_invites"`);
        await queryRunner.query(`ALTER TABLE "family_members" DROP CONSTRAINT "FK_family_members_userId"`);
        await queryRunner.query(`ALTER TABLE "family_members" DROP CONSTRAINT "FK_family_members_familyId"`);
        await queryRunner.query(`DROP TABLE "family_members"`);
        await queryRunner.query(`DROP TABLE "families"`);
    }
}
