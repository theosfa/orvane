// photos/photos.controller.ts
import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { access } from 'fs/promises';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PhotosService } from './photos.service';

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

@Controller('photos')
export class PhotosController {
  constructor(private photos: PhotosService) {}

  // POST /photos (multipart, поле file) — загрузить фото; потом его id передаётся при сохранении рецепта
  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  upload(@UploadedFile() file: { buffer: Buffer; mimetype: string } | undefined, @Req() req: any) {
    if (!file?.buffer?.length) throw new BadRequestException('No file');
    if (!file.mimetype.startsWith('image/')) throw new BadRequestException('Only images are allowed');
    return this.photos.store(file.buffer, req.user.userId, 'upload');
  }

  // GET /photos/<id>.webp — без авторизации: <img> не умеет слать токен, а id — неугадываемый uuid.
  // Файл по id никогда не меняется, поэтому кешируется навсегда.
  @Get(':file')
  async serve(@Param('file') file: string, @Res() res: Response) {
    const path = file.endsWith('.webp') ? this.photos.filePath(file.slice(0, -5)) : null;
    if (!path || !(await access(path).then(() => true, () => false))) {
      throw new NotFoundException('Photo not found');
    }
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.type('image/webp').sendFile(path);
  }
}
