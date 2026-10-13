// tasks/tasks.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Task } from './task.entity';
import { CreateTaskDto } from './dto/task.dto';
import { isISODate } from '../common/dates';

@Injectable()
export class TasksService {
  constructor(@InjectRepository(Task) private taskRepo: Repository<Task>) {}

  private toTask(t: Task) {
    return {
      id: t.id,
      title: t.title,
      notes: t.notes,
      date: t.date,
      done: t.done,
      source: t.source,
    };
  }

  // задачи за период включительно, по дням, внутри дня — в порядке создания
  async list(userId: number, from: string, to: string) {
    const tasks = await this.taskRepo.find({
      where: { userId, date: Between(from, to) },
      order: { date: 'ASC', id: 'ASC' },
    });
    return tasks.map((t) => this.toTask(t));
  }

  async create(userId: number, dto: CreateTaskDto) {
    if (!isISODate(dto.date)) throw new BadRequestException('Invalid date');
    const task = await this.taskRepo.save(
      this.taskRepo.create({
        userId,
        title: dto.title,
        notes: dto.notes ?? '',
        date: dto.date,
        source: dto.source ?? 'manual',
      }),
    );
    return this.toTask(task);
  }
}
