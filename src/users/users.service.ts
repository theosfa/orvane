import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { User } from './users.entity';
import { firstFreeUsername, usernameBase } from './username';

export type ProfileFields = Partial<
  Pick<
    User,
    'language' | 'username' | 'firstName' | 'lastName' | 'showFullName'
  >
>;

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  findByEmail(email: string) {
    return this.repo.findOne({ where: { email } });
  }

  findById(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  findByUsername(username: string) {
    return this.repo.findOne({ where: { username: username.toLowerCase() } });
  }

  // свободный ник из email: anna, anna1, anna2…
  private async freeUsername(email: string) {
    const base = usernameBase(email);
    const similar = await this.repo.find({
      select: { username: true },
      where: { username: Like(`${base}%`) },
    });
    return firstFreeUsername(base, new Set(similar.map((u) => u.username)));
  }

  async create(email: string, passwordHash: string, language?: string) {
    // две регистрации с похожими email одновременно могут взять один ник — тогда пробуем снова
    for (let attempt = 0; ; attempt++) {
      const user = this.repo.create({
        email,
        passwordHash,
        language,
        username: await this.freeUsername(email),
      });
      try {
        return await this.repo.save(user);
      } catch (err) {
        if (attempt >= 3 || (await this.findByEmail(email))) throw err;
      }
    }
  }

  async updateProfile(id: number, fields: ProfileFields) {
    const changes = Object.fromEntries(
      Object.entries(fields).filter(([, v]) => v !== undefined),
    ) as ProfileFields;
    if (changes.username) {
      changes.username = changes.username.toLowerCase();
      const owner = await this.findByUsername(changes.username);
      if (owner && owner.id !== id)
        throw new ConflictException('This username is taken');
    }
    if (Object.keys(changes).length) await this.repo.update(id, changes);
  }
}
