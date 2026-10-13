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

@Controller('menu')
@UseGuards(JwtAuthGuard)
export class MenuController {
  constructor(private menuService: MenuService) {}

  // GET /menu/shopping-list?dates=2026-10-12,2026-10-13; должен идти раньше ':id'-подобных роутов
  @Get('shopping-list')
  getShoppingList(
    @Lang() lang: Language,
    @Req() req: any,
    @Query('dates') dates?: string,
  ) {
    const list = (dates ?? '').split(',').filter(Boolean).slice(0, 62);
    return this.menuService.getShoppingList(req.user.userId, list, lang);
  }

  // GET /menu?week=2026-10-14 — неделя (пн–вс), в которую попадает день; без week — текущая
  @Get()
  getWeek(
    @Req() req: any,
    @Lang() lang: Language,
    @Query('week') week?: string,
  ) {
    if (week !== undefined && !isISODate(week)) {
      throw new BadRequestException('week must be YYYY-MM-DD');
    }
    return this.menuService.getWeek(
      req.user.userId,
      startOfWeek(week ?? todayISO()),
      lang,
    );
  }

  @Post()
  addEntry(@Body() dto: AddMenuEntryDto, @Req() req: any) {
    return this.menuService.addEntry(req.user.userId, dto);
  }

  // PUT /menu/days/2026-10-12 { meals: [...] } — сохранить отредактированный день целиком
  @Put('days/:date')
  setDay(
    @Param('date') date: string,
    @Body() dto: SetMenuDayDto,
    @Req() req: any,
  ) {
    return this.menuService.setDay(req.user.userId, date, dto.meals);
  }

  @Delete(':id')
  removeEntry(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    return this.menuService.removeEntry(req.user.userId, id);
  }
}
