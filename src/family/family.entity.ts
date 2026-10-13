// family/family.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { User } from '../users/users.entity';

export const MAX_FAMILY_MEMBERS = 5;

// admin — меняет семейный бюджет, планы и меню и управляет участниками; member — только смотрит
export const FAMILY_ROLES = ['admin', 'member'] as const;
export type FamilyRole = (typeof FAMILY_ROLES)[number];

// семья: до MAX_FAMILY_MEMBERS человек с общим бюджетом, планами и меню
@Entity('families')
export class Family {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 60 })
  name: string;

  @CreateDateColumn()
  createdAt: Date;
}

// юзер состоит максимум в одной семье
@Entity('family_members')
@Unique(['userId'])
export class FamilyMember {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Family, { onDelete: 'CASCADE' })
  family: Family;

  @Column()
  familyId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @Column()
  userId: number;

  @Column({ type: 'varchar', length: 10, default: 'member' })
  role: FamilyRole;

  @CreateDateColumn()
  joinedAt: Date;
}

// приглашение по email: в семью попадают только приняв его сами.
// Можно пригласить и того, кто ещё не зарегистрирован — увидит после регистрации
@Entity('family_invites')
@Unique(['familyId', 'email'])
export class FamilyInvite {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Family, { onDelete: 'CASCADE' })
  family: Family;

  @Column()
  familyId: number;

  // в нижнем регистре
  @Column()
  email: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  invitedBy: User;

  @Column()
  invitedById: number;

  @CreateDateColumn()
  createdAt: Date;
}
