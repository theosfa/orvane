// auth/refresh-token.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { User } from '../users/users.entity';

// длинный токен: в БД лежит только sha256-хеш, сам токен живёт в httpOnly-куке
@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column()
  userId: number;

  @Index({ unique: true })
  @Column({ length: 64 })
  tokenHash: string;

  @Column({ type: 'timestamp' })
  expiresAt: Date;

  // выставляется при ротации; повторное предъявление отозванного токена = кража
  @Column({ type: 'timestamp', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
