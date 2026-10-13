// menu/menu.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuEntry } from './menu-entry.entity';
import { Recipe } from '../recipes/recipe.entity';
import { MenuService } from './menu.service';
import { MenuController } from './menu.controller';
import { RecipesModule } from '../recipes/recipes.module';

@Module({
  imports: [TypeOrmModule.forFeature([MenuEntry, Recipe]), RecipesModule],
  providers: [MenuService],
  controllers: [MenuController],
})
export class MenuModule {}
