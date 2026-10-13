import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  // язык интерфейса, выбирается в профиле: один из SUPPORTED_LANGUAGES (common/languages.ts)
  @Column({ length: 5, default: 'ru' })
  language: string;

  @CreateDateColumn()
  createdAt: Date;
}
