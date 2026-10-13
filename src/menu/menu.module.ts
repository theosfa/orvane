// menu/menu.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MenuEntry } from './menu-entry.entity';
import { Recipe } from '../recipes/recipe.entity';
import { RecipeLike } from '../recipes/recipe-like.entity';
import { MenuService } from './menu.service';
import { MenuController } from './menu.controller';
import { RecipesModule } from '../recipes/recipes.module';
import { FamilyModule } from '../family/family.module';

@Module({
  imports: [TypeOrmModule.forFeature([MenuEntry, Recipe, RecipeLike]), RecipesModule, FamilyModule],
  providers: [MenuService],
  controllers: [MenuController],
})
export class MenuModule {}
