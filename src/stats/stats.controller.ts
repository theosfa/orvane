// stats/stats.controller.ts
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StatsService } from './stats.service';

@Controller('stats')
@UseGuards(JwtAuthGuard)
export class StatsController {
  constructor(private stats: StatsService) {}

  // GET /stats — для карточек в профиле
  @Get()
  mine(@Req() req: any) {
    return this.stats.forUser(req.user.userId);
  }
}
