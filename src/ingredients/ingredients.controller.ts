// ingredients/ingredients.controller.ts
import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { IngredientsService } from './ingredients.service';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Lang } from '../common/lang.decorator';
import type { Language } from '../common/languages';

// весь модуль продуктов доступен только авторизованным пользователям
@Controller('ingredients')
@UseGuards(JwtAuthGuard)
export class IngredientsController {
  constructor(private ingredientsService: IngredientsService) {}

  // GET /ingredients?lang=de
  @Get()
  findAll(@Lang() lang: Language) {
    return this.ingredientsService.findAll(lang);
  }

  // GET /ingredients/search?q=po&lang=ru — объявлен до :id, иначе 'search' попадёт в :id
  @Get('search')
  search(@Query('q') q = '', @Lang() lang: Language) {
    return this.ingredientsService.search(q, lang);
  }

  // GET /ingredients/1?lang=de
  @Get(':id')
  findOne(@Param('id') id: string, @Lang() lang: Language) {
    return this.ingredientsService.findOne(+id, lang);
  }

  // POST /ingredients — юзер добавляет свой продукт (slug/переводы выводятся из name)
  @Post()
  create(@Body() dto: CreateIngredientDto, @Lang() lang: Language) {
    return this.ingredientsService.createFromName(dto, lang);
  }
}
