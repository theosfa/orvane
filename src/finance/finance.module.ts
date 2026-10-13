// finance/finance.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Wallet } from './wallet.entity';
import { FinanceCategory } from './finance-category.entity';
import { FinanceTransaction } from './finance-transaction.entity';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet, FinanceCategory, FinanceTransaction]),
  ],
  providers: [FinanceService],
  controllers: [FinanceController],
})
export class FinanceModule {}
