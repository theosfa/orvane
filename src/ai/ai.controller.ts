// ai/ai.controller.ts
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AiService } from './ai.service';
import { GenerateRecipeDto } from './dto/generate-recipe.dto';
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
}
