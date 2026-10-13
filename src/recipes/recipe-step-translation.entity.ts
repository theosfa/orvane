// recipes/recipe-step-translation.entity.ts
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  Index,
  JoinColumn,
} from 'typeorm';
import { RecipeStep } from './recipe-step.entity';

// текст шага на другом языке; оригинал — recipe_steps.stepText
@Entity('recipe_step_translations')
@Index('IDX_recipe_step_translations_step_language', ['stepId', 'language'], {
  unique: true,
})
export class RecipeStepTranslation {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => RecipeStep, (s) => s.translations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stepId' })
  step: RecipeStep;

  @Column()
  stepId: number;

  @Column({ length: 5 })
  language: string;

  @Column('text')
  text: string;

  // true — перевёл DeepL; false — человек
  @Column({ default: true })
  isMachine: boolean;
}
