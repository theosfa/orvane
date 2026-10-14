// family/family.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Lang } from '../common/lang.decorator';
import type { Language } from '../common/languages';
import { FamilyService } from './family.service';
import { FamilyNameDto, InviteDto, SetRoleDto } from './dto/family.dto';
import { FamilyEventsService } from './family-events.service';
import { originOf } from './family-events.interceptor';

type Audience = {
  families?: (number | null | undefined)[];
  users?: number[];
  emails?: string[];
};

// каждый ответ — актуальное состояние семьи (как GET /family)
@Controller('family')
@UseGuards(JwtAuthGuard)
export class FamilyController {
  constructor(
    private family: FamilyService,
    private events: FamilyEventsService,
  ) {}

  // GET /family/events — поток событий (SSE): что изменилось у меня в семье;
  // соединение держит клиент и переподключается сам
  @Sse('events')
  live(@Req() req: any) {
    return this.events.stream(req.user.userId);
  }

  // после удачного изменения — всем, кого оно касается (и моим другим вкладкам)
  private async tell<T>(req: any, audience: Audience, run: () => Promise<T>) {
    const result = await run();
    const users = [req.user.userId, ...(audience.users ?? [])];
    await this.events
      .notify('family', originOf(req), { ...audience, users })
      .catch(() => undefined);
    return result;
  }

  private async myFamilyId(req: any) {
    return (await this.family.membership(req.user.userId))?.familyId;
  }

  @Get()
  overview(@Req() req: any) {
    return this.family.overview(req.user.userId, req.user.email);
  }

  @Post()
  create(@Req() req: any, @Body() dto: FamilyNameDto, @Lang() lang: Language) {
    return this.tell(req, {}, () =>
      this.family.create(req.user.userId, req.user.email, dto.name, lang),
    );
  }

  @Patch()
  async rename(@Req() req: any, @Body() dto: FamilyNameDto) {
    const families = [await this.myFamilyId(req)];
    return this.tell(req, { families }, () =>
      this.family.rename(req.user.userId, req.user.email, dto.name),
    );
  }

  @Post('invites')
  async invite(@Req() req: any, @Body() dto: InviteDto) {
    const families = [await this.myFamilyId(req)];
    return this.tell(req, { families, emails: [dto.email] }, () =>
      this.family.invite(req.user.userId, req.user.email, dto.email),
    );
  }

  @Delete('invites/:id')
  async cancelInvite(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const invite = await this.family.findInvite(id);
    return this.tell(
      req,
      { families: [invite?.familyId], emails: invite ? [invite.email] : [] },
      () => this.family.cancelInvite(req.user.userId, req.user.email, id),
    );
  }

  // приглашения мне
  @Post('invitations/:id/accept')
  async accept(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const invite = await this.family.findInvite(id);
    return this.tell(req, { families: [invite?.familyId] }, () =>
      this.family.accept(req.user.userId, req.user.email, id),
    );
  }

  @Delete('invitations/:id')
  async decline(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    const invite = await this.family.findInvite(id);
    return this.tell(req, { families: [invite?.familyId] }, () =>
      this.family.decline(req.user.userId, req.user.email, id),
    );
  }

  @Patch('members/:userId')
  async setRole(
    @Req() req: any,
    @Param('userId', ParseIntPipe) memberUserId: number,
    @Body() dto: SetRoleDto,
  ) {
    const families = [await this.myFamilyId(req)];
    return this.tell(req, { families }, () =>
      this.family.setRole(
        req.user.userId,
        req.user.email,
        memberUserId,
        dto.role,
      ),
    );
  }

  @Delete('members/:userId')
  async removeMember(
    @Req() req: any,
    @Param('userId', ParseIntPipe) memberUserId: number,
  ) {
    const families = [await this.myFamilyId(req)];
    return this.tell(req, { families, users: [memberUserId] }, () =>
      this.family.removeMember(req.user.userId, req.user.email, memberUserId),
    );
  }

  @Post('leave')
  async leave(@Req() req: any) {
    const families = [await this.myFamilyId(req)];
    return this.tell(req, { families }, () =>
      this.family.leave(req.user.userId, req.user.email),
    );
  }
}
