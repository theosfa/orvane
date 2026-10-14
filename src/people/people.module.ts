// people/people.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserFollow } from '../users/user-follow.entity';
import { UsersModule } from '../users/users.module';
import { RecipesModule } from '../recipes/recipes.module';
import { PeopleService } from './people.service';
import { PeopleController } from './people.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserFollow]), UsersModule, RecipesModule],
  providers: [PeopleService],
  controllers: [PeopleController],
})
export class PeopleModule {}
