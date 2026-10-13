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
  CreateTransferDto,
  TransactionFiltersDto,
  UpdateTransactionDto,
} from './dto/transaction.dto';
import { FamilyService } from '../family/family.service';
import { toScopeName } from '../family/scope';

// ?scope=family — семейный бюджет: смотреть может любой участник, менять — только админ
@Controller('finance')
@UseGuards(JwtAuthGuard)
export class FinanceController {
  constructor(
    private finance: FinanceService,
    private family: FamilyService,
  ) {}

  private view(req: any, scope?: string) {
    return this.family.scope(req.user.userId, toScopeName(scope), 'view');
  }

  private edit(req: any, scope?: string) {
    return this.family.scope(req.user.userId, toScopeName(scope), 'edit');
  }

  @Get('wallets')
  async listWallets(@Req() req: any, @Lang() lang: Language, @Query('scope') scope?: string) {
    return this.finance.listWallets(await this.view(req, scope), lang);
  }

  @Post('wallets')
  async createWallet(
    @Req() req: any,
    @Body() dto: CreateWalletDto,
    @Lang() lang: Language,
    @Query('scope') scope?: string,
  ) {
    return this.finance.createWallet(await this.edit(req, scope), dto, lang);
  }

  @Patch('wallets/:id')
  async updateWallet(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWalletDto,
    @Query('scope') scope?: string,
  ) {
    return this.finance.updateWallet(await this.edit(req, scope), id, dto);
  }

  @Delete('wallets/:id')
  async deleteWallet(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Query('scope') scope?: string) {
    return this.finance.deleteWallet(await this.edit(req, scope), id);
  }

  // GET /finance/categories?type=expense
  @Get('categories')
  async listCategories(
    @Req() req: any,
    @Lang() lang: Language,
    @Query('type') type?: string,
    @Query('scope') scope?: string,
  ) {
    const t = TRANSACTION_TYPES.includes(type as TransactionType)
      ? (type as TransactionType)
      : undefined;
    return this.finance.listCategories(await this.view(req, scope), lang, t);
  }

  @Post('categories')
  async createCategory(
    @Req() req: any,
    @Body() dto: CreateCategoryDto,
    @Lang() lang: Language,
    @Query('scope') scope?: string,
  ) {
    return this.finance.createCategory(await this.edit(req, scope), dto, lang);
  }

  @Patch('categories/:id')
  async renameCategory(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RenameCategoryDto,
    @Query('scope') scope?: string,
  ) {
    return this.finance.renameCategory(await this.edit(req, scope), id, dto);
  }

  @Delete('categories/:id')
  async deleteCategory(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Query('scope') scope?: string) {
    return this.finance.deleteCategory(await this.edit(req, scope), id);
  }

  // GET /finance/transactions?type=expense&categoryId=3&walletId=1&from=2026-09-01&to=2026-09-30
  @Get('transactions')
  async listTransactions(
    @Req() req: any,
    @Query() filters: TransactionFiltersDto,
    @Query('scope') scope?: string,
  ) {
    return this.finance.listTransactions(await this.view(req, scope), filters);
  }

  @Post('transactions')
  async createTransaction(
    @Req() req: any,
    @Body() dto: CreateTransactionDto,
    @Query('scope') scope?: string,
  ) {
    return this.finance.createTransaction(await this.edit(req, scope), dto);
  }

  @Patch('transactions/:id')
  async updateTransaction(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTransactionDto,
    @Query('scope') scope?: string,
  ) {
    return this.finance.updateTransaction(await this.edit(req, scope), id, dto);
  }

  @Delete('transactions/:id')
  async deleteTransaction(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Query('scope') scope?: string) {
    return this.finance.deleteTransaction(await this.edit(req, scope), id);
  }

  // перевод между кошельками разных областей (личный ↔ семейный); права — на обе стороны
  @Post('transfers')
  createTransfer(@Req() req: any, @Body() dto: CreateTransferDto) {
    return this.finance.createTransfer(req.user.userId, dto);
  }

  // GET /finance/summary?from=2026-09-01&to=2026-09-30 — те же фильтры, что у списка
  @Get('summary')
  async summary(
    @Req() req: any,
    @Query() filters: TransactionFiltersDto,
    @Query('scope') scope?: string,
  ) {
    return this.finance.summary(await this.view(req, scope), filters);
  }
}
