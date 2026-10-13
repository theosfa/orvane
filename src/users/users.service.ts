import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './users.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  findByEmail(email: string) {
    return this.repo.findOne({ where: { email } });
  }

  findById(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  async create(email: string, passwordHash: string, language?: string) {
    const user = this.repo.create({ email, passwordHash, language });
    return this.repo.save(user);
  }

  async updateLanguage(id: number, language: string) {
    await this.repo.update(id, { language });
  }
}
