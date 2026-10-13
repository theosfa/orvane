// tasks/tasks.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from './task.entity';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';
import { FamilyModule } from '../family/family.module';

@Module({
  imports: [TypeOrmModule.forFeature([Task]), FamilyModule],
  providers: [TasksService],
  controllers: [TasksController],
})
export class TasksModule {}
