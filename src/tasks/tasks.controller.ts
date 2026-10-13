// tasks/tasks.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TasksService } from './tasks.service';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';
import { addDays, isISODate } from '../common/dates';
import { FamilyService } from '../family/family.service';
import { toScopeName } from '../family/scope';

// задачи Планов; сюда же присылают задачи другие приложения (например, список покупок из меню).
// ?scope=family — общие задачи семьи: смотрят все участники, меняют админы
@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(
    private tasks: TasksService,
    private family: FamilyService,
  ) {}

  // GET /tasks?from=2026-10-12&to=2026-10-18
  @Get()
  async list(
    @Req() req: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('scope') scope?: string,
  ) {
    if (!isISODate(from) || (to !== undefined && !isISODate(to))) {
      throw new BadRequestException('from/to must be YYYY-MM-DD');
    }
    const s = await this.family.scope(req.user.userId, toScopeName(scope), 'view');
    return this.tasks.list(s, from, to ?? addDays(from, 6));
  }

  @Post()
  async create(@Req() req: any, @Body() dto: CreateTaskDto, @Query('scope') scope?: string) {
    const s = await this.family.scope(req.user.userId, toScopeName(scope), 'edit');
    return this.tasks.create(s, dto);
  }

  // отметить сделанной, переименовать, перенести на другой день
  @Patch(':id')
  async update(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaskDto,
    @Query('scope') scope?: string,
  ) {
    const s = await this.family.scope(req.user.userId, toScopeName(scope), 'edit');
    return this.tasks.update(s, id, dto);
  }

  @Delete(':id')
  async remove(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Query('scope') scope?: string) {
    const s = await this.family.scope(req.user.userId, toScopeName(scope), 'edit');
    return this.tasks.remove(s, id);
  }
}
