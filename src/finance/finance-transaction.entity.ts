// finance/finance-transaction.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../users/users.entity';
import { Family } from '../family/family.entity';
import { Wallet } from './wallet.entity';
import { FinanceCategory } from './finance-category.entity';
import type { TransactionType } from './finance-types';

// доход или расход; amount всегда положительный, знак задаёт type
@Entity('finance_transactions')
export class FinanceTransaction {
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

  @ManyToOne(() => Wallet, { onDelete: 'CASCADE' })
  wallet: Wallet;

  @Column()
  walletId: number;

  // категорию удалили — операция остаётся «без категории»
  @ManyToOne(() => FinanceCategory, { onDelete: 'SET NULL', nullable: true })
  category: FinanceCategory | null;

  @Column({ type: 'int', nullable: true })
  categoryId: number | null;

  @Column({ type: 'varchar', length: 10 })
  type: TransactionType;

  @Column('decimal', { precision: 12, scale: 2 })
  amount: string;

  @Column({ length: 200, default: '' })
  note: string;

  // перевод между кошельками: две записи (расход + доход) с одним transferId; в итогах не считается
  @Column({ type: 'uuid', nullable: true })
  transferId: string | null;

  // день операции, 'YYYY-MM-DD'
  @Column({ type: 'date' })
  date: string;

  @CreateDateColumn()
  createdAt: Date;
}
