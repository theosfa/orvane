import { MigrationInterface, QueryRunner } from 'typeorm';

// 150 базовых продуктов: КБЖУ на 100 г (сырой вид, по USDA / таблицам калорийности), названия en + ru.
// Остальные языки переведутся при первом запросе (IngredientsService.resolveName).
// slug = английское название в kebab-case — по нему же AI-генерация находит/создаёт продукты без дублей.
// [slug, en, ru, kcal, protein, fat, carbs]
type Row = [string, string, string, number, number, number, number];

export const BASE_INGREDIENTS: Row[] = [
  // овощи
  ['potato', 'Potato', 'Картофель', 77, 2.0, 0.1, 17.5],
  ['sweet-potato', 'Sweet potato', 'Батат', 86, 1.6, 0.1, 20.1],
  ['carrot', 'Carrot', 'Морковь', 41, 0.9, 0.2, 9.6],
  ['onion', 'Onion', 'Лук репчатый', 40, 1.1, 0.1, 9.3],
  ['green-onion', 'Green onion', 'Зелёный лук', 32, 1.8, 0.2, 7.3],
  ['garlic', 'Garlic', 'Чеснок', 149, 6.4, 0.5, 33.1],
  ['tomato', 'Tomato', 'Помидор', 18, 0.9, 0.2, 3.9],
  ['cucumber', 'Cucumber', 'Огурец', 15, 0.7, 0.1, 3.6],
  ['bell-pepper', 'Bell pepper', 'Болгарский перец', 26, 1.0, 0.3, 6.0],
  ['chili-pepper', 'Chili pepper', 'Перец чили', 40, 1.9, 0.4, 8.8],
  ['cabbage', 'Cabbage', 'Капуста белокочанная', 25, 1.3, 0.1, 5.8],
  ['cauliflower', 'Cauliflower', 'Цветная капуста', 25, 1.9, 0.3, 5.0],
  ['broccoli', 'Broccoli', 'Брокколи', 34, 2.8, 0.4, 6.6],
  ['zucchini', 'Zucchini', 'Кабачок', 17, 1.2, 0.3, 3.1],
  ['eggplant', 'Eggplant', 'Баклажан', 25, 1.0, 0.2, 5.9],
  ['pumpkin', 'Pumpkin', 'Тыква', 26, 1.0, 0.1, 6.5],
  ['beet', 'Beet', 'Свёкла', 43, 1.6, 0.2, 9.6],
  ['radish', 'Radish', 'Редис', 16, 0.7, 0.1, 3.4],
  ['celery', 'Celery', 'Сельдерей', 16, 0.7, 0.2, 3.0],
  ['spinach', 'Spinach', 'Шпинат', 23, 2.9, 0.4, 3.6],
  ['lettuce', 'Lettuce', 'Салат листовой', 15, 1.4, 0.2, 2.9],
  ['green-peas', 'Green peas', 'Зелёный горошек', 81, 5.4, 0.4, 14.5],
  ['green-beans', 'Green beans', 'Стручковая фасоль', 31, 1.8, 0.2, 7.0],
  ['sweet-corn', 'Sweet corn', 'Кукуруза сладкая', 86, 3.3, 1.4, 19.0],
  ['mushroom', 'Mushroom', 'Шампиньоны', 22, 3.1, 0.3, 3.3],
  ['avocado', 'Avocado', 'Авокадо', 160, 2.0, 14.7, 8.5],
  ['olive', 'Olive', 'Оливки', 115, 0.8, 10.7, 6.3],
  ['ginger', 'Ginger', 'Имбирь', 80, 1.8, 0.8, 17.8],
  ['pickled-cucumber', 'Pickled cucumber', 'Огурцы маринованные', 11, 0.5, 0.2, 1.9],
  ['sauerkraut', 'Sauerkraut', 'Квашеная капуста', 19, 0.9, 0.1, 4.3],
  ['canned-tomatoes', 'Canned tomatoes', 'Томаты в собственном соку', 21, 1.0, 0.2, 3.9],

  // зелень
  ['dill', 'Dill', 'Укроп', 43, 3.5, 1.1, 7.0],
  ['parsley', 'Parsley', 'Петрушка', 36, 3.0, 0.8, 6.3],
  ['cilantro', 'Cilantro', 'Кинза', 23, 2.1, 0.5, 3.7],
  ['basil', 'Basil', 'Базилик', 23, 3.2, 0.6, 2.7],

  // фрукты, ягоды, сухофрукты
  ['apple', 'Apple', 'Яблоко', 52, 0.3, 0.2, 13.8],
  ['pear', 'Pear', 'Груша', 57, 0.4, 0.1, 15.2],
  ['banana', 'Banana', 'Банан', 89, 1.1, 0.3, 22.8],
  ['orange', 'Orange', 'Апельсин', 47, 0.9, 0.1, 11.8],
  ['lemon', 'Lemon', 'Лимон', 29, 1.1, 0.3, 9.3],
  ['grape', 'Grape', 'Виноград', 69, 0.7, 0.2, 18.1],
  ['strawberry', 'Strawberry', 'Клубника', 32, 0.7, 0.3, 7.7],
  ['raspberry', 'Raspberry', 'Малина', 52, 1.2, 0.7, 11.9],
  ['blueberry', 'Blueberry', 'Черника', 57, 0.7, 0.3, 14.5],
  ['cherry', 'Cherry', 'Вишня', 50, 1.0, 0.3, 12.2],
  ['peach', 'Peach', 'Персик', 39, 0.9, 0.3, 9.5],
  ['apricot', 'Apricot', 'Абрикос', 48, 1.4, 0.4, 11.1],
  ['raisins', 'Raisins', 'Изюм', 299, 3.1, 0.5, 79.2],
  ['dried-apricot', 'Dried apricot', 'Курага', 241, 3.4, 0.5, 62.6],

  // крупы, мука, хлеб, макароны
  ['white-rice', 'White rice', 'Рис белый', 365, 7.1, 0.7, 80.0],
  ['buckwheat', 'Buckwheat', 'Гречка', 343, 13.3, 3.4, 71.5],
  ['rolled-oats', 'Rolled oats', 'Овсяные хлопья', 379, 13.2, 6.5, 67.7],
  ['millet', 'Millet', 'Пшено', 378, 11.0, 4.2, 72.9],
  ['pearl-barley', 'Pearl barley', 'Перловка', 352, 9.9, 1.2, 77.7],
  ['bulgur', 'Bulgur', 'Булгур', 342, 12.3, 1.3, 75.9],
  ['couscous', 'Couscous', 'Кускус', 376, 12.8, 0.6, 77.4],
  ['semolina', 'Semolina', 'Манная крупа', 360, 12.7, 1.1, 72.8],
  ['pasta', 'Pasta', 'Макароны', 371, 13.0, 1.5, 74.7],
  ['spaghetti', 'Spaghetti', 'Спагетти', 371, 13.0, 1.5, 74.7],
  ['wheat-flour', 'Wheat flour', 'Мука пшеничная', 364, 10.3, 1.0, 76.3],
  ['cornstarch', 'Cornstarch', 'Кукурузный крахмал', 381, 0.3, 0.1, 91.3],
  ['white-bread', 'White bread', 'Белый хлеб', 266, 7.6, 3.3, 49.4],
  ['rye-bread', 'Rye bread', 'Ржаной хлеб', 259, 8.5, 3.3, 48.3],
  ['tortilla', 'Tortilla', 'Тортилья', 312, 8.3, 8.1, 51.6],
  ['breadcrumbs', 'Breadcrumbs', 'Панировочные сухари', 395, 13.4, 5.3, 71.9],

  // бобовые, соя
  ['lentil', 'Lentil', 'Чечевица', 352, 24.6, 1.1, 63.4],
  ['chickpea', 'Chickpea', 'Нут', 378, 20.5, 6.0, 63.0],
  ['kidney-bean', 'Kidney bean', 'Фасоль красная', 333, 23.6, 0.8, 60.0],
  ['white-bean', 'White bean', 'Фасоль белая', 333, 23.4, 0.9, 60.3],
  ['tofu', 'Tofu', 'Тофу', 76, 8.1, 4.8, 1.9],

  // мясо, птица, субпродукты
  ['chicken', 'Chicken', 'Курица (тушка)', 215, 18.6, 15.1, 0],
  ['chicken-breast', 'Chicken breast', 'Куриная грудка', 120, 22.5, 2.6, 0],
  ['chicken-thigh', 'Chicken thigh', 'Куриное бедро', 177, 18.6, 11.0, 0],
  ['chicken-liver', 'Chicken liver', 'Куриная печень', 119, 16.9, 4.8, 0.7],
  ['turkey-breast', 'Turkey breast', 'Филе индейки', 114, 23.7, 1.5, 0],
  ['beef', 'Beef', 'Говядина', 187, 19.0, 12.0, 0],
  ['ground-beef', 'Ground beef', 'Говяжий фарш', 254, 17.2, 20.0, 0],
  ['beef-liver', 'Beef liver', 'Говяжья печень', 135, 20.4, 3.6, 3.9],
  ['pork', 'Pork', 'Свинина', 242, 17.0, 19.0, 0],
  ['pork-tenderloin', 'Pork tenderloin', 'Свиная вырезка', 120, 21.0, 3.5, 0],
  ['ground-pork', 'Ground pork', 'Свиной фарш', 263, 16.9, 21.2, 0],
  ['lamb', 'Lamb', 'Баранина', 282, 16.6, 23.4, 0],
  ['bacon', 'Bacon', 'Бекон', 417, 12.6, 39.7, 1.4],
  ['ham', 'Ham', 'Ветчина', 145, 16.5, 6.0, 3.8],
  ['sausage', 'Sausage', 'Сосиски', 290, 10.3, 26.0, 4.2],

  // рыба, морепродукты
  ['salmon', 'Salmon', 'Лосось', 208, 20.4, 13.4, 0],
  ['cod', 'Cod', 'Треска', 82, 17.8, 0.7, 0],
  ['pollock', 'Pollock', 'Минтай', 72, 15.9, 0.9, 0],
  ['tuna', 'Tuna', 'Тунец', 109, 24.4, 0.5, 0],
  ['canned-tuna', 'Canned tuna', 'Тунец консервированный', 116, 25.5, 0.8, 0],
  ['mackerel', 'Mackerel', 'Скумбрия', 205, 18.6, 13.9, 0],
  ['herring', 'Herring', 'Сельдь', 158, 18.0, 9.0, 0],
  ['shrimp', 'Shrimp', 'Креветки', 85, 20.1, 0.5, 0],
  ['squid', 'Squid', 'Кальмар', 92, 15.6, 1.4, 3.1],

  // яйца, молочное
  ['egg', 'Egg', 'Яйцо куриное', 143, 12.6, 9.5, 0.7],
  ['milk', 'Milk', 'Молоко 2,5%', 52, 2.8, 2.5, 4.7],
  ['kefir', 'Kefir', 'Кефир 2,5%', 53, 2.9, 2.5, 4.0],
  ['plain-yogurt', 'Plain yogurt', 'Йогурт натуральный', 61, 3.5, 3.3, 4.7],
  ['greek-yogurt', 'Greek yogurt', 'Греческий йогурт', 73, 10.0, 1.9, 3.9],
  ['sour-cream', 'Sour cream', 'Сметана 20%', 198, 2.4, 19.4, 4.6],
  ['heavy-cream', 'Heavy cream', 'Сливки 33%', 340, 2.8, 36.1, 2.7],
  ['butter', 'Butter', 'Сливочное масло', 717, 0.9, 81.1, 0.1],
  ['cottage-cheese', 'Cottage cheese', 'Творог 5%', 121, 17.2, 5.0, 1.8],
  ['cheese', 'Cheese', 'Сыр твёрдый', 364, 24.0, 29.5, 0.5],
  ['parmesan', 'Parmesan', 'Пармезан', 392, 35.8, 25.8, 3.2],
  ['mozzarella', 'Mozzarella', 'Моцарелла', 300, 22.2, 22.4, 2.2],
  ['feta-cheese', 'Feta cheese', 'Фета', 264, 14.2, 21.3, 4.1],
  ['cream-cheese', 'Cream cheese', 'Сливочный сыр', 342, 5.9, 34.2, 4.1],
  ['condensed-milk', 'Condensed milk', 'Сгущённое молоко', 321, 7.9, 8.7, 54.4],

  // масла и жиры
  ['sunflower-oil', 'Sunflower oil', 'Подсолнечное масло', 884, 0, 100, 0],
  ['olive-oil', 'Olive oil', 'Оливковое масло', 884, 0, 100, 0],
  ['vegetable-oil', 'Vegetable oil', 'Растительное масло', 884, 0, 100, 0],
  ['mayonnaise', 'Mayonnaise', 'Майонез', 680, 1.0, 74.9, 0.6],

  // орехи и семена
  ['walnut', 'Walnut', 'Грецкий орех', 654, 15.2, 65.2, 13.7],
  ['almond', 'Almond', 'Миндаль', 579, 21.2, 49.9, 21.6],
  ['hazelnut', 'Hazelnut', 'Фундук', 628, 15.0, 60.8, 16.7],
  ['peanut', 'Peanut', 'Арахис', 567, 25.8, 49.2, 16.1],
  ['cashew', 'Cashew', 'Кешью', 553, 18.2, 43.9, 30.2],
  ['sunflower-seeds', 'Sunflower seeds', 'Семечки подсолнечника', 584, 20.8, 51.5, 20.0],
  ['sesame-seeds', 'Sesame seeds', 'Кунжут', 573, 17.7, 49.7, 23.4],
  ['peanut-butter', 'Peanut butter', 'Арахисовая паста', 588, 25.1, 50.4, 20.0],

  // специи, соусы, бакалея
  ['salt', 'Salt', 'Соль', 0, 0, 0, 0],
  ['black-pepper', 'Black pepper', 'Чёрный перец молотый', 251, 10.4, 3.3, 64.0],
  ['paprika', 'Paprika', 'Паприка', 282, 14.1, 12.9, 54.0],
  ['cinnamon', 'Cinnamon', 'Корица', 247, 4.0, 1.2, 80.6],
  ['cumin', 'Cumin', 'Зира', 375, 17.8, 22.3, 44.2],
  ['turmeric', 'Turmeric', 'Куркума', 312, 9.7, 3.3, 67.1],
  ['curry-powder', 'Curry powder', 'Карри', 325, 14.3, 14.0, 55.8],
  ['oregano', 'Oregano', 'Орегано', 265, 9.0, 4.3, 68.9],
  ['bay-leaf', 'Bay leaf', 'Лавровый лист', 313, 7.6, 8.4, 75.0],
  ['sugar', 'Sugar', 'Сахар', 387, 0, 0, 100],
  ['brown-sugar', 'Brown sugar', 'Коричневый сахар', 380, 0.1, 0, 98.1],
  ['honey', 'Honey', 'Мёд', 304, 0.3, 0, 82.4],
  ['jam', 'Jam', 'Варенье', 278, 0.4, 0.1, 68.9],
  ['soy-sauce', 'Soy sauce', 'Соевый соус', 53, 8.1, 0.6, 4.9],
  ['ketchup', 'Ketchup', 'Кетчуп', 101, 1.0, 0.1, 27.4],
  ['mustard', 'Mustard', 'Горчица', 60, 3.7, 3.3, 5.8],
  ['tomato-paste', 'Tomato paste', 'Томатная паста', 82, 4.3, 0.5, 18.9],
  ['vinegar', 'Vinegar', 'Уксус столовый', 18, 0, 0, 0],
  ['balsamic-vinegar', 'Balsamic vinegar', 'Бальзамический уксус', 88, 0.5, 0, 17.0],
  ['lemon-juice', 'Lemon juice', 'Лимонный сок', 22, 0.4, 0.2, 6.9],
  ['coconut-milk', 'Coconut milk', 'Кокосовое молоко', 230, 2.3, 23.8, 5.5],
  ['chicken-broth', 'Chicken broth', 'Куриный бульон', 15, 1.6, 0.5, 1.0],
  ['dry-yeast', 'Dry yeast', 'Сухие дрожжи', 325, 40.4, 7.6, 41.2],
  ['baking-powder', 'Baking powder', 'Разрыхлитель', 53, 0, 0, 27.7],
  ['baking-soda', 'Baking soda', 'Сода пищевая', 0, 0, 0, 0],
  ['gelatin', 'Gelatin', 'Желатин', 335, 85.6, 0.1, 0],
  ['cocoa-powder', 'Cocoa powder', 'Какао-порошок', 228, 19.6, 13.7, 57.9],
  ['dark-chocolate', 'Dark chocolate', 'Тёмный шоколад', 546, 4.9, 31.3, 61.2],
  ['water', 'Water', 'Вода', 0, 0, 0, 0],
];

export class SeedBaseIngredients1790000000010 implements MigrationInterface {
  name = 'SeedBaseIngredients1790000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [slug, en, ru, kcal, protein, fat, carbs] of BASE_INGREDIENTS) {
      // продукт с таким slug уже мог появиться (добавил юзер / AI) — не трогаем его
      const inserted: { id: number }[] = await queryRunner.query(
        `INSERT INTO "ingredients" ("slug", "caloriesPer100g", "proteinPer100g", "fatPer100g", "carbsPer100g")
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT ("slug") DO NOTHING
         RETURNING "id"`,
        [slug, kcal, protein, fat, carbs],
      );
      if (!inserted.length) continue;
      await queryRunner.query(
        `INSERT INTO "ingredient_translations" ("ingredientId", "language", "name")
         VALUES ($1, 'en', $2), ($1, 'ru', $3)`,
        [inserted[0].id, en, ru],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // удаляем только те, что не используются в рецептах (переводы уходят каскадом)
    await queryRunner.query(
      `DELETE FROM "ingredients" i
        WHERE i."slug" = ANY($1)
          AND NOT EXISTS (SELECT 1 FROM "recipe_ingredients" ri WHERE ri."ingredientId" = i."id")`,
      [BASE_INGREDIENTS.map((r) => r[0])],
    );
  }
}
