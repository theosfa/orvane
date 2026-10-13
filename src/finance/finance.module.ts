// finance/finance.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Wallet } from './wallet.entity';
import { FinanceCategory } from './finance-category.entity';
import { FinanceTransaction } from './finance-transaction.entity';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';
import { FamilyModule } from '../family/family.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet, FinanceCategory, FinanceTransaction]),
    FamilyModule,
  ],
  providers: [FinanceService],
  controllers: [FinanceController],
})
export class FinanceModule {}
