// people/people.controller.ts — /people/:username: профиль автора, подписка
import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Lang } from '../common/lang.decorator';
import type { Language } from '../common/languages';
import { PeopleService } from './people.service';

@Controller('people')
@UseGuards(JwtAuthGuard)
export class PeopleController {
  constructor(private people: PeopleService) {}

  @Get(':username')
  profile(
    @Param('username') username: string,
    @Req() req: any,
    @Lang() lang: Language,
  ) {
    return this.people.profile(username, req.user.userId, lang);
  }

  @Get(':username/followers')
  followers(@Param('username') username: string, @Req() req: any) {
    return this.people.list(username, 'followers', req.user.userId);
  }

  @Get(':username/following')
  following(@Param('username') username: string, @Req() req: any) {
    return this.people.list(username, 'following', req.user.userId);
  }

  @Post(':username/follow')
  follow(@Param('username') username: string, @Req() req: any) {
    return this.people.follow(username, req.user.userId);
  }

  @Delete(':username/follow')
  unfollow(@Param('username') username: string, @Req() req: any) {
    return this.people.unfollow(username, req.user.userId);
  }
}
