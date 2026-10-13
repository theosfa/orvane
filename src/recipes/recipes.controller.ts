// recipes/recipes.controller.ts
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RecipesService } from './recipes.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Lang } from '../common/lang.decorator';
import type { Language } from '../common/languages';

// весь модуль рецептов доступен только авторизованным пользователям
@Controller('recipes')
@UseGuards(JwtAuthGuard)
export class RecipesController {
  constructor(private recipesService: RecipesService) {}

  // должен идти раньше ':id', иначе роутинг примет "liked" за id
  @Get('liked')
  getLiked(@Req() req: any, @Lang() lang: Language) {
    return this.recipesService.getLikedRecipes(req.user.userId, lang);
  }

  // GET /recipes/ingredients?lang=ru — продукты для фильтра; раньше ':id'
  @Get('ingredients')
  usedIngredients(@Req() req: any, @Lang() lang: Language) {
    return this.recipesService.usedIngredients(req.user.userId, lang);
  }

  // GET /recipes?q=potato&minCalories=200&maxCalories=500&ingredientIds=3,17
  @Get()
  findAll(
    @Req() req: any,
    @Lang() lang: Language,
    @Query('q') q?: string,
    @Query('minCalories') minCalories?: string,
    @Query('maxCalories') maxCalories?: string,
    @Query('ingredientIds') ingredientIds?: string,
  ) {
    const toNumber = (v?: string) =>
      v && Number.isFinite(Number(v)) ? Number(v) : undefined;
    return this.recipesService.findAll(req.user.userId, lang, {
      q,
      minCalories: toNumber(minCalories),
      maxCalories: toNumber(maxCalories),
      ingredientIds: (ingredientIds ?? '')
        .split(',')
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0),
    });
  }

  @Get(':id')
  // GET /recipes/5?lang=pl — название и шаги на нужном языке (при необходимости переводятся)
  findOne(@Param('id') id: string, @Lang() lang: Language, @Req() req: any) {
    return this.recipesService.findOne(+id, lang, req.user.userId);
  }

  @Post()
  create(@Body() dto: CreateRecipeDto, @Req() req: any, @Lang() lang: Language) {
    return this.recipesService.create(req.user.userId, dto, lang);
  }

  @Post(':id/like')
  like(@Param('id') id: string, @Req() req: any) {
    return this.recipesService.likeRecipe(req.user.userId, +id);
  }

  @Delete(':id/like')
  unlike(@Param('id') id: string, @Req() req: any) {
    return this.recipesService.unlikeRecipe(req.user.userId, +id);
  }
}
