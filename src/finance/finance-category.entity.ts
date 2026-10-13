// finance/finance-category.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../users/users.entity';
import type { TransactionType } from './finance-types';

// категория расходов (кафе, кофе…) или доходов (зарплата…); у каждого юзера свои —
// стандартные создаются при первом заходе, их можно переименовать и удалить
@Entity('finance_categories')
export class FinanceCategory {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column()
  userId: number;

  @Column({ length: 60 })
  name: string;

  @Column({ type: 'varchar', length: 10 })
  type: TransactionType;

  // ключ стандартной категории ('groceries', 'salary'…); у своих категорий — null
  @Column({ type: 'varchar', length: 30, nullable: true })
  key: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
