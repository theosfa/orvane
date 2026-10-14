// family/family.module.ts
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Family, FamilyInvite, FamilyMember } from './family.entity';
import { FamilyService } from './family.service';
import { FamilyController } from './family.controller';
import { FamilyEventsService } from './family-events.service';
import { FamilyEventsInterceptor } from './family-events.interceptor';
import { User } from '../users/users.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Family, FamilyMember, FamilyInvite, User]),
  ],
  providers: [
    FamilyService,
    FamilyEventsService,
    // живые обновления после изменений семейных данных в любом модуле
    { provide: APP_INTERCEPTOR, useClass: FamilyEventsInterceptor },
  ],
  controllers: [FamilyController],
  exports: [FamilyService],
})
export class FamilyModule {}
