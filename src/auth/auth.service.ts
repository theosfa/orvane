import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { UsersService } from '../users/users.service';
import { User } from '../users/users.entity';
import { RefreshToken } from './refresh-token.entity';

// короткий токен (JWT) — 15 минут, в заголовке Authorization;
// длинный (refresh) — 30 дней, случайная строка в httpOnly-куке, меняется при каждом использовании
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// параллельные refresh из двух вкладок одним токеном — не кража
const REUSE_GRACE_MS = 10 * 1000;

export type IssuedTokens = { accessToken: string; refreshToken: string };

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    @InjectRepository(RefreshToken)
    private refreshRepo: Repository<RefreshToken>,
  ) {}

  private signAccessToken(userId: number, email: string) {
    return this.jwtService.sign({ sub: userId, email });
  }

  private hash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async issueTokens(user: User): Promise<IssuedTokens> {
    const refreshToken = randomBytes(48).toString('base64url');
    await this.refreshRepo.save(
      this.refreshRepo.create({
        userId: user.id,
        tokenHash: this.hash(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
        revokedAt: null,
      }),
    );
    // заодно чистим протухшие токены этого юзера
    await this.refreshRepo.delete({
      userId: user.id,
      expiresAt: LessThan(new Date()),
    });

    return {
      accessToken: this.signAccessToken(user.id, user.email),
      refreshToken,
    };
  }

  async signup(email: string, password: string, language?: string) {
    const existing = await this.usersService.findByEmail(email);
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.usersService.create(email, passwordHash, language);

    return this.issueTokens(user);
  }

  async signin(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.issueTokens(user);
  }

  // обмен длинного токена на новую пару (ротация)
  async refresh(rawToken: string | undefined): Promise<IssuedTokens> {
    if (!rawToken) throw new UnauthorizedException('No refresh token');

    const stored = await this.refreshRepo.findOne({
      where: { tokenHash: this.hash(rawToken) },
    });
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    if (stored.revokedAt) {
      if (Date.now() - stored.revokedAt.getTime() > REUSE_GRACE_MS) {
        // старый токен предъявили повторно — вероятно украден: разлогиниваем все сессии юзера
        await this.refreshRepo.delete({ userId: stored.userId });
        throw new UnauthorizedException('Refresh token reused');
      }
    } else {
      stored.revokedAt = new Date();
      await this.refreshRepo.save(stored);
    }

    const user = await this.usersService.findById(stored.userId);
    if (!user) throw new UnauthorizedException();
    return this.issueTokens(user);
  }

  async logout(rawToken: string | undefined) {
    if (rawToken) {
      await this.refreshRepo.delete({ tokenHash: this.hash(rawToken) });
    }
  }

  async getProfile(userId: number) {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException();

    return {
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
        language: user.language,
      },
    };
  }

  async updateProfile(userId: number, data: { language: string }) {
    await this.usersService.updateLanguage(userId, data.language);
    return this.getProfile(userId);
  }
}
