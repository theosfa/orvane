// menu/menu.controller.ts
import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { MenuService } from './menu.service';
import { AddMenuEntryDto, SetMenuDayDto } from './dto/add-menu-entry.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Lang } from '../common/lang.decorator';
import type { Language } from '../common/languages';
import { isISODate, startOfWeek, todayISO } from '../common/dates';
import { FamilyService } from '../family/family.service';
import { toScopeName } from '../family/scope';

// ?scope=family — общее меню семьи: смотрят все участники, меняют админы
// (блюда каждый добавляет из своих лайкнутых рецептов)
@Controller('menu')
@UseGuards(JwtAuthGuard)
export class MenuController {
  constructor(
    private menuService: MenuService,
    private family: FamilyService,
  ) {}

  private scope(req: any, scope: string | undefined, access: 'view' | 'edit') {
    return this.family.scope(req.user.userId, toScopeName(scope), access);
  }

  // GET /menu/shopping-list?dates=2026-10-12,2026-10-13; должен идти раньше ':id'-подобных роутов
  @Get('shopping-list')
  async getShoppingList(
    @Lang() lang: Language,
    @Req() req: any,
    @Query('dates') dates?: string,
    @Query('scope') scope?: string,
  ) {
    const list = (dates ?? '').split(',').filter(Boolean).slice(0, 62);
    return this.menuService.getShoppingList(await this.scope(req, scope, 'view'), list, lang);
  }

  // GET /menu?week=2026-10-14 — неделя (пн–вс), в которую попадает день; без week — текущая
  @Get()
  async getWeek(
    @Req() req: any,
    @Lang() lang: Language,
    @Query('week') week?: string,
    @Query('scope') scope?: string,
  ) {
    if (week !== undefined && !isISODate(week)) {
      throw new BadRequestException('week must be YYYY-MM-DD');
    }
    return this.menuService.getWeek(
      await this.scope(req, scope, 'view'),
      startOfWeek(week ?? todayISO()),
      lang,
    );
  }

  @Post()
  async addEntry(@Body() dto: AddMenuEntryDto, @Req() req: any, @Query('scope') scope?: string) {
    return this.menuService.addEntry(await this.scope(req, scope, 'edit'), dto);
  }

  // PUT /menu/days/2026-10-12 { meals: [...] } — сохранить отредактированный день целиком
  @Put('days/:date')
  async setDay(
    @Param('date') date: string,
    @Body() dto: SetMenuDayDto,
    @Req() req: any,
    @Query('scope') scope?: string,
  ) {
    return this.menuService.setDay(await this.scope(req, scope, 'edit'), date, dto.meals);
  }

  @Delete(':id')
  async removeEntry(@Param('id', ParseIntPipe) id: number, @Req() req: any, @Query('scope') scope?: string) {
    return this.menuService.removeEntry(await this.scope(req, scope, 'edit'), id);
  }
}
