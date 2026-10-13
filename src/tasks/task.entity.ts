// tasks/task.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../users/users.entity';
import { Family } from '../family/family.entity';

// откуда пришла задача: создана в Планах вручную или прислана другим приложением
export const TASK_SOURCES = ['manual', 'food', 'finance'] as const;
export type TaskSource = (typeof TASK_SOURCES)[number];

@Entity('tasks')
@Index(['userId', 'date'])
export class Task {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column()
  userId: number;

  // задан — запись семейная (userId = кто создал), null — личная
  @ManyToOne(() => Family, { onDelete: 'CASCADE', nullable: true })
  family: Family | null;

  @Column({ type: 'int', nullable: true })
  familyId: number | null;

  @Column({ length: 200 })
  title: string;

  // подробности, например список покупок построчно
  @Column({ type: 'text', default: '' })
  notes: string;

  // день, на который запланирована задача, 'YYYY-MM-DD'
  @Column({ type: 'date' })
  date: string;

  @Column({ default: false })
  done: boolean;

  @Column({ type: 'varchar', length: 20, default: 'manual' })
  source: TaskSource;

  @CreateDateColumn()
  createdAt: Date;
}
