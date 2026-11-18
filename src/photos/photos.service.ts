// photos/photos.service.ts
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, LessThan, MoreThan, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { mkdir, readdir, unlink, writeFile } from 'fs/promises';
import { join, resolve } from 'path';
import sharp from 'sharp';
import { RecipePhoto } from './recipe-photo.entity';

export const MAX_PHOTOS_PER_RECIPE = 10;
const MAX_SIDE = 1600; // px — хватает и для карточки во весь экран телефона
const UNATTACHED_TTL_MS = 24 * 60 * 60 * 1000;
const CLEANUP_EVERY_MS = 6 * 60 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const isPhotoId = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

@Injectable()
export class PhotosService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PhotosService.name);
  private readonly dir = resolve(process.env.PHOTOS_DIR || './data/photos');
  private timer?: NodeJS.Timeout;

  constructor(@InjectRepository(RecipePhoto) private repo: Repository<RecipePhoto>) {}

  async onModuleInit() {
    await mkdir(this.dir, { recursive: true });
    this.timer = setInterval(() => void this.cleanup(), CLEANUP_EVERY_MS);
    this.timer.unref();
    void this.cleanup();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  // путь к файлу; null — id не похож на наш (защита от ../ и прочего)
  filePath(id: string): string | null {
    return isPhotoId(id) ? join(this.dir, `${id}.webp`) : null;
  }

  // любое изображение -> WebP не больше MAX_SIDE по большей стороне, с учётом EXIF-поворота
  async store(input: Buffer, uploaderId: number, source: 'upload' | 'ai') {
    let webp: Buffer;
    try {
      webp = await sharp(input, { failOn: 'error' })
        .rotate()
        .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
    } catch {
      throw new BadRequestException('Unsupported or broken image');
    }
    const id = randomUUID();
    await writeFile(this.filePath(id)!, webp);
    await this.repo.insert({ id, uploaderId, source, recipeId: null, position: 0 });
    return { id };
  }

  async listFor(recipeId: number) {
    const rows = await this.repo.find({ where: { recipeId }, order: { position: 'ASC', createdAt: 'ASC' } });
    return rows.map((p) => ({ id: p.id }));
  }

  // привязать свежие (ещё ничьи) фото юзера к рецепту, в заданном порядке, после уже имеющихся
  async attach(recipeId: number, photoIds: string[], userId: number) {
    const ids = [...new Set(photoIds)];
    if (!ids.length) return;
    if (!ids.every(isPhotoId)) throw new BadRequestException('Invalid photo id');

    const existing = await this.repo.count({ where: { recipeId } });
    if (existing + ids.length > MAX_PHOTOS_PER_RECIPE) {
      throw new BadRequestException(`A recipe can have at most ${MAX_PHOTOS_PER_RECIPE} photos`);
    }
    const free = await this.repo.find({ where: { id: In(ids), uploaderId: userId, recipeId: IsNull() } });
    if (free.length !== ids.length) throw new BadRequestException('Unknown photo');

    for (const [i, id] of ids.entries()) {
      await this.repo.update({ id }, { recipeId, position: existing + i });
    }
  }

  async remove(recipeId: number, photoId: string) {
    const photo = await this.repo.findOne({ where: { id: photoId, recipeId } });
    if (!photo) throw new NotFoundException('Photo not found');
    await this.repo.delete({ id: photoId });
    await this.deleteFile(photoId);
    await this.renumber(recipeId);
  }

  // сделать фото главным: оно встаёт первым, остальные сдвигаются
  async makeMain(recipeId: number, photoId: string) {
    const photos = await this.repo.find({ where: { recipeId }, order: { position: 'ASC', createdAt: 'ASC' } });
    const target = photos.find((p) => p.id === photoId);
    if (!target) throw new NotFoundException('Photo not found');
    const ordered = [target, ...photos.filter((p) => p.id !== photoId)];
    for (const [i, p] of ordered.entries()) {
      if (p.position !== i) await this.repo.update({ id: p.id }, { position: i });
    }
  }

  // сколько фото юзер сгенерировал за последние сутки — для дневного лимита
  countAiSince(userId: number, since: Date) {
    return this.repo.count({ where: { uploaderId: userId, source: 'ai', createdAt: MoreThan(since) } });
  }

  private async renumber(recipeId: number) {
    const photos = await this.repo.find({ where: { recipeId }, order: { position: 'ASC', createdAt: 'ASC' } });
    for (const [i, p] of photos.entries()) {
      if (p.position !== i) await this.repo.update({ id: p.id }, { position: i });
    }
  }

  private async deleteFile(id: string) {
    await unlink(this.filePath(id)!).catch(() => undefined);
  }

  // фото, так и не попавшие в рецепт за сутки, и файлы без записи в базе (рецепт удалили каскадом)
  async cleanup() {
    try {
      const stale = await this.repo.find({
        where: { recipeId: IsNull(), createdAt: LessThan(new Date(Date.now() - UNATTACHED_TTL_MS)) },
      });
      for (const p of stale) {
        await this.repo.delete({ id: p.id });
        await this.deleteFile(p.id);
      }

      const files = (await readdir(this.dir)).filter((f) => f.endsWith('.webp'));
      const ids = files.map((f) => f.slice(0, -5)).filter(isPhotoId);
      const known = new Set<string>();
      for (let i = 0; i < ids.length; i += 500) {
        const rows = await this.repo.find({ select: { id: true }, where: { id: In(ids.slice(i, i + 500)) } });
        rows.forEach((r) => known.add(r.id));
      }
      const orphans = ids.filter((id) => !known.has(id));
      for (const id of orphans) await this.deleteFile(id);

      if (stale.length || orphans.length) {
        this.logger.log(`Photo cleanup: ${stale.length} unattached, ${orphans.length} orphan files removed`);
      }
    } catch (e) {
      this.logger.warn(`Photo cleanup failed: ${(e as Error).message}`);
    }
  }
}
