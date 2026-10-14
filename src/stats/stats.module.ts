// stats/stats.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Recipe } from '../recipes/recipe.entity';
import { RecipeLike } from '../recipes/recipe-like.entity';
import { MenuEntry } from '../menu/menu-entry.entity';
import { Task } from '../tasks/task.entity';
import { StatsService } from './stats.service';
import { StatsController } from './stats.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Recipe, RecipeLike, MenuEntry, Task])],
  providers: [StatsService],
  controllers: [StatsController],
})
export class StatsModule {}
