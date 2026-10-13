// family/family.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Family, FamilyInvite, FamilyMember } from './family.entity';
import { FamilyService } from './family.service';
import { FamilyController } from './family.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Family, FamilyMember, FamilyInvite])],
  providers: [FamilyService],
  controllers: [FamilyController],
  exports: [FamilyService],
})
export class FamilyModule {}
