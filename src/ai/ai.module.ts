// ai/ai.module.ts
import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { PhotosModule } from '../photos/photos.module';

@Module({
  imports: [IngredientsModule, PhotosModule],
  providers: [AiService],
  controllers: [AiController],
})
export class AiModule {}
