import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import sharp from 'sharp';
import { BadRequestException } from '@nestjs/common';
import { PhotosService, isPhotoId } from './photos.service';

// @nestjs/typeorm — ESM-only, jest (CommonJS) его не грузит; декоратор здесь не нужен
jest.mock('@nestjs/typeorm', () => ({ InjectRepository: () => () => undefined }));

describe('PhotosService', () => {
  let dir: string;
  let service: PhotosService;
  const repo = { insert: jest.fn() };

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'photos-'));
    process.env.PHOTOS_DIR = dir;
    repo.insert.mockReset();
    service = new PhotosService(repo as any);
  });

  afterEach(async () => {
    delete process.env.PHOTOS_DIR;
    await rm(dir, { recursive: true, force: true });
  });

  it('accepts only uuid ids for file paths', () => {
    expect(isPhotoId('3f2b8c1e-9a4d-4e2f-8b1a-0c9d8e7f6a5b')).toBe(true);
    expect(service.filePath('../../etc/passwd')).toBeNull();
    expect(service.filePath('3f2b8c1e-9a4d-4e2f-8b1a-0c9d8e7f6a5b')).toBe(
      join(dir, '3f2b8c1e-9a4d-4e2f-8b1a-0c9d8e7f6a5b.webp'),
    );
  });

  it('stores any image as a downscaled webp', async () => {
    const png = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: '#c6f24e' } })
      .png()
      .toBuffer();

    const { id } = await service.store(png, 7, 'upload');

    expect(isPhotoId(id)).toBe(true);
    expect(repo.insert).toHaveBeenCalledWith(expect.objectContaining({ id, uploaderId: 7, source: 'upload', recipeId: null }));
    const meta = await sharp(await readFile(join(dir, `${id}.webp`))).metadata();
    expect(meta.format).toBe('webp');
    expect(Math.max(meta.width!, meta.height!)).toBe(1600);
  });

  it('rejects files that are not images', async () => {
    await expect(service.store(Buffer.from('not an image'), 7, 'upload')).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.insert).not.toHaveBeenCalled();
  });
});
