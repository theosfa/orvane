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

  // публичный ник: виден другим у рецептов и в профиле (/u/<username>); email другим не показываем
  @Column({ length: 30, unique: true })
  username: string;

  @Column({ length: 50, default: '' })
  firstName: string;

  @Column({ length: 50, default: '' })
  lastName: string;

  // показывать ли имя и фамилию другим (иначе — только ник)
  @Column({ default: false })
  showFullName: boolean;

  // язык интерфейса, выбирается в профиле: один из SUPPORTED_LANGUAGES (common/languages.ts)
  @Column({ length: 5, default: 'ru' })
  language: string;

  // стандартные категории и первый кошелёк уже созданы (даже если юзер их потом удалил)
  @Column({ default: false })
  financeSeeded: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
