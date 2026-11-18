// photos/photos.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecipePhoto } from './recipe-photo.entity';
import { PhotosService } from './photos.service';
import { PhotosController } from './photos.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RecipePhoto])],
  providers: [PhotosService],
  controllers: [PhotosController],
  exports: [PhotosService],
})
export class PhotosModule {}
