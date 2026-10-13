// auth/auth.controller.ts
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  UseGuards,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService, IssuedTokens, REFRESH_TTL_MS } from './auth.service';
import { AuthDto, UpdateProfileDto } from './dto/auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';

const REFRESH_COOKIE = 'lad_refresh';
// кука уходит только на /auth/* — остальным эндпоинтам она не нужна
const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/auth',
};

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // длинный токен — в куку, короткий — в ответ
  private sendTokens(res: Response, tokens: IssuedTokens) {
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      ...cookieOptions,
      maxAge: REFRESH_TTL_MS,
    });
    return { accessToken: tokens.accessToken };
  }

  @Post('register')
  async signup(
    @Body() dto: AuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.signup(
      dto.email,
      dto.password,
      dto.language,
    );
    return this.sendTokens(res, tokens);
  }

  @Post('login')
  @HttpCode(200)
  async signin(
    @Body() dto: AuthDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.signin(dto.email, dto.password);
    return this.sendTokens(res, tokens);
  }

  // POST /auth/refresh — по куке выдаёт новый короткий токен (и новую куку)
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const tokens = await this.authService.refresh(
        req.cookies?.[REFRESH_COOKIE],
      );
      return this.sendTokens(res, tokens);
    } catch (err) {
      res.clearCookie(REFRESH_COOKIE, cookieOptions);
      throw err;
    }
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(req.cookies?.[REFRESH_COOKIE]);
    res.clearCookie(REFRESH_COOKIE, cookieOptions);
  }

  // фронт шлёт Authorization: Bearer <jwt>, получает профиль
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  profile(@Req() req: any) {
    return this.authService.getProfile(req.user.userId);
  }

  // PATCH /auth/profile { language } — настройки из профиля
  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  updateProfile(@Req() req: any, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(req.user.userId, dto);
  }
}
