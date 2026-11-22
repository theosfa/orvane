// ai/ai.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AiService } from './ai.service';
import { GenerateRecipeDto } from './dto/generate-recipe.dto';
import { GenerateImageDto } from './dto/generate-image.dto';
import { FromPhotoDto } from './dto/from-photo.dto';
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

  // рецепт по фото: написанный рецепт переписывается, по фото блюда рецепт придумывается
  @Post('recipes/from-photo')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 15 * 1024 * 1024, files: 1 } }))
  fromPhoto(
    @UploadedFile() file: { buffer: Buffer; mimetype: string } | undefined,
    @Body() dto: FromPhotoDto,
    @Req() req: any,
  ) {
    if (!file?.buffer?.length) throw new BadRequestException('No file');
    if (!file.mimetype.startsWith('image/')) throw new BadRequestException('Only images are allowed');
    return this.aiService.generateFromPhoto(req.user.userId, file.buffer, dto.lang, dto.note);
  }

  // фото готового блюда; возвращает { id } загруженного фото — его передают при сохранении рецепта
  @Post('recipes/image')
  generateImage(@Body() dto: GenerateImageDto, @Req() req: any) {
    return this.aiService.generateImage(req.user.userId, dto.name, dto.ingredients ?? []);
  }
}
