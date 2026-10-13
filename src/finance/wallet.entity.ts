// finance/wallet.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../users/users.entity';

// кошелёк (карта, наличные, счёт); баланс = initialBalance + доходы − расходы, может уйти в минус
@Entity('wallets')
export class Wallet {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column()
  userId: number;

  @Column({ length: 60 })
  name: string;

  // сколько было на кошельке в момент его создания
  @Column('decimal', { precision: 12, scale: 2, default: 0 })
  initialBalance: string;

  @CreateDateColumn()
  createdAt: Date;
}
