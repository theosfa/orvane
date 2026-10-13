// menu/menu.controller.ts
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { MenuService } from './menu.service';
import { AddMenuEntryDto } from './dto/add-menu-entry.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Lang } from '../common/lang.decorator';
import type { Language } from '../common/languages';

@Controller('menu')
@UseGuards(JwtAuthGuard)
export class MenuController {
  constructor(private menuService: MenuService) {}

  // должен идти раньше ':id'-подобных роутов на будущее
  @Get('shopping-list')
  getShoppingList(@Lang() lang: Language, @Req() req: any) {
    return this.menuService.getShoppingList(req.user.userId, lang);
  }

  @Get()
  getWeek(@Req() req: any, @Lang() lang: Language) {
    return this.menuService.getWeek(req.user.userId, lang);
  }

  @Post()
  addEntry(@Body() dto: AddMenuEntryDto, @Req() req: any) {
    return this.menuService.addEntry(req.user.userId, dto);
  }

  @Delete(':id')
  removeEntry(@Param('id') id: string, @Req() req: any) {
    return this.menuService.removeEntry(req.user.userId, +id);
  }
}
