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
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Lang } from '../common/lang.decorator';
import type { Language } from '../common/languages';
import { FamilyService } from './family.service';
import { FamilyNameDto, InviteDto, SetRoleDto } from './dto/family.dto';

// каждый ответ — актуальное состояние семьи (как GET /family)
@Controller('family')
@UseGuards(JwtAuthGuard)
export class FamilyController {
  constructor(private family: FamilyService) {}

  @Get()
  overview(@Req() req: any) {
    return this.family.overview(req.user.userId, req.user.email);
  }

  @Post()
  create(@Req() req: any, @Body() dto: FamilyNameDto, @Lang() lang: Language) {
    return this.family.create(req.user.userId, req.user.email, dto.name, lang);
  }

  @Patch()
  rename(@Req() req: any, @Body() dto: FamilyNameDto) {
    return this.family.rename(req.user.userId, req.user.email, dto.name);
  }

  @Post('invites')
  invite(@Req() req: any, @Body() dto: InviteDto) {
    return this.family.invite(req.user.userId, req.user.email, dto.email);
  }

  @Delete('invites/:id')
  cancelInvite(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.family.cancelInvite(req.user.userId, req.user.email, id);
  }

  // приглашения мне
  @Post('invitations/:id/accept')
  accept(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.family.accept(req.user.userId, req.user.email, id);
  }

  @Delete('invitations/:id')
  decline(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.family.decline(req.user.userId, req.user.email, id);
  }

  @Patch('members/:userId')
  setRole(
    @Req() req: any,
    @Param('userId', ParseIntPipe) memberUserId: number,
    @Body() dto: SetRoleDto,
  ) {
    return this.family.setRole(req.user.userId, req.user.email, memberUserId, dto.role);
  }

  @Delete('members/:userId')
  removeMember(@Req() req: any, @Param('userId', ParseIntPipe) memberUserId: number) {
    return this.family.removeMember(req.user.userId, req.user.email, memberUserId);
  }

  @Post('leave')
  leave(@Req() req: any) {
    return this.family.leave(req.user.userId, req.user.email);
  }
}
