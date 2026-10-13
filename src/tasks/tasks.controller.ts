// tasks/tasks.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/task.dto';
import { addDays, isISODate } from '../common/dates';

// задачи Планов; сюда же присылают задачи другие приложения (например, список покупок из меню)
@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private tasks: TasksService) {}

  // GET /tasks?from=2026-10-12&to=2026-10-18
  @Get()
  list(@Req() req: any, @Query('from') from?: string, @Query('to') to?: string) {
    if (!isISODate(from) || (to !== undefined && !isISODate(to))) {
      throw new BadRequestException('from/to must be YYYY-MM-DD');
    }
    return this.tasks.list(req.user.userId, from, to ?? addDays(from, 6));
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateTaskDto) {
    return this.tasks.create(req.user.userId, dto);
  }
}
