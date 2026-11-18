// ai/ai.controller.ts
import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { GenerateRecipeDto } from './dto/generate-recipe.dto';
import { GenerateImageDto } from './dto/generate-image.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

// доступно только авторизованным пользователям — ключ OpenAI не покидает бэкенд
@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private aiService: AiService) {}

  @Post('recipes/generate')
  generateRecipe(@Body() dto: GenerateRecipeDto) {
    return this.aiService.generateRecipe(dto.prompt, dto.lang);
  }

  // фото готового блюда; возвращает { id } загруженного фото — его передают при сохранении рецепта
  @Post('recipes/image')
  generateImage(@Body() dto: GenerateImageDto, @Req() req: any) {
    return this.aiService.generateImage(req.user.userId, dto.name, dto.ingredients ?? []);
  }
}
