import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFinanceCategoryKey1790000000007 implements MigrationInterface {
    name = 'AddFinanceCategoryKey1790000000007'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "finance_categories" ADD "key" character varying(30)`);
        // уже созданные стандартные категории узнаём по названию на любом из языков
        const defaults: [string, string, string[]][] = [
            ['expense', 'cafe', ["Bistrot", "Cafe", "Kawiarnia", "Кафе"]],
            ['expense', 'coffee', ["Café", "Coffee", "Kawa", "Кава", "Кофе"]],
            ['expense', 'groceries', ["Courses", "Groceries", "Spożywcze", "Продукти", "Продукты"]],
            ['expense', 'supplies', ["Artykuły", "Fournitures", "Supplies", "Господарські товари", "Хозтовары"]],
            ['expense', 'transport', ["Transport", "Транспорт"]],
            ['expense', 'home', ["Dom", "Home", "Maison", "Дом", "Дім"]],
            ['expense', 'health', ["Health", "Santé", "Zdrowie", "Здоров'я", "Здоровье"]],
            ['expense', 'entertainment', ["Entertainment", "Loisirs", "Rozrywka", "Развлечения", "Розваги"]],
            ['income', 'salary', ["Salaire", "Salary", "Wynagrodzenie", "Зарплата"]],
            ['income', 'side_jobs', ["Petits boulots", "Side jobs", "Zlecenia", "Подработка", "Підробіток"]],
            ['income', 'gifts', ["Cadeaux", "Gifts", "Prezenty", "Подарки", "Подарунки"]],
        ];
        for (const [type, key, names] of defaults) {
            await queryRunner.query(
                `UPDATE "finance_categories" SET "key" = $1 WHERE "type" = $2 AND "name" = ANY($3) AND "key" IS NULL`,
                [key, type, names],
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "finance_categories" DROP COLUMN "key"`);
    }
}
