// finance/finance.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Lang } from '../common/lang.decorator';
import type { Language } from '../common/languages';
import { FinanceService } from './finance.service';
import { TRANSACTION_TYPES } from './finance-types';
import type { TransactionType } from './finance-types';
import { CreateWalletDto, UpdateWalletDto } from './dto/wallet.dto';
import { CreateCategoryDto, RenameCategoryDto } from './dto/category.dto';
import {
  CreateTransactionDto,
  TransactionFiltersDto,
  UpdateTransactionDto,
} from './dto/transaction.dto';

@Controller('finance')
@UseGuards(JwtAuthGuard)
export class FinanceController {
  constructor(private finance: FinanceService) {}

  @Get('wallets')
  listWallets(@Req() req: any, @Lang() lang: Language) {
    return this.finance.listWallets(req.user.userId, lang);
  }

  @Post('wallets')
  createWallet(
    @Req() req: any,
    @Body() dto: CreateWalletDto,
    @Lang() lang: Language,
  ) {
    return this.finance.createWallet(req.user.userId, dto, lang);
  }

  @Patch('wallets/:id')
  updateWallet(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWalletDto,
  ) {
    return this.finance.updateWallet(req.user.userId, id, dto);
  }

  @Delete('wallets/:id')
  deleteWallet(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.finance.deleteWallet(req.user.userId, id);
  }

  // GET /finance/categories?type=expense
  @Get('categories')
  listCategories(
    @Req() req: any,
    @Lang() lang: Language,
    @Query('type') type?: string,
  ) {
    const t = TRANSACTION_TYPES.includes(type as TransactionType)
      ? (type as TransactionType)
      : undefined;
    return this.finance.listCategories(req.user.userId, lang, t);
  }

  @Post('categories')
  createCategory(
    @Req() req: any,
    @Body() dto: CreateCategoryDto,
    @Lang() lang: Language,
  ) {
    return this.finance.createCategory(req.user.userId, dto, lang);
  }

  @Patch('categories/:id')
  renameCategory(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RenameCategoryDto,
  ) {
    return this.finance.renameCategory(req.user.userId, id, dto);
  }

  @Delete('categories/:id')
  deleteCategory(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.finance.deleteCategory(req.user.userId, id);
  }

  // GET /finance/transactions?type=expense&categoryId=3&walletId=1&from=2026-09-01&to=2026-09-30
  @Get('transactions')
  listTransactions(@Req() req: any, @Query() filters: TransactionFiltersDto) {
    return this.finance.listTransactions(req.user.userId, filters);
  }

  @Post('transactions')
  createTransaction(@Req() req: any, @Body() dto: CreateTransactionDto) {
    return this.finance.createTransaction(req.user.userId, dto);
  }

  @Patch('transactions/:id')
  updateTransaction(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.finance.updateTransaction(req.user.userId, id, dto);
  }

  @Delete('transactions/:id')
  deleteTransaction(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.finance.deleteTransaction(req.user.userId, id);
  }

  // GET /finance/summary?from=2026-09-01&to=2026-09-30 — те же фильтры, что у списка
  @Get('summary')
  summary(@Req() req: any, @Query() filters: TransactionFiltersDto) {
    return this.finance.summary(req.user.userId, filters);
  }
}
