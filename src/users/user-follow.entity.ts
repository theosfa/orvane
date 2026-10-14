// users/user-follow.entity.ts — подписка: follower следит за рецептами followee
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { User } from './users.entity';

@Entity('user_follows')
@Unique('UQ_user_follows_pair', ['followerId', 'followeeId'])
export class UserFollow {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  follower: User;

  @Column()
  followerId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  followee: User;

  @Index('IDX_user_follows_followeeId')
  @Column()
  followeeId: number;

  @CreateDateColumn()
  createdAt: Date;
}
