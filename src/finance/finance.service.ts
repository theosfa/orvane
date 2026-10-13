// finance/finance.service.ts
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { User } from '../users/users.entity';
import type { Language } from '../common/languages';
import { Wallet } from './wallet.entity';
import { FinanceCategory } from './finance-category.entity';
import { FinanceTransaction } from './finance-transaction.entity';
import { FINANCE_DEFAULTS, defaultCategories } from './finance-defaults';
import type { TransactionType } from './finance-types';
import { CreateWalletDto, UpdateWalletDto } from './dto/wallet.dto';
import { CreateCategoryDto, RenameCategoryDto } from './dto/category.dto';
import {
  CreateTransactionDto,
  TransactionFiltersDto,
  UpdateTransactionDto,
} from './dto/transaction.dto';

// numeric из Postgres приходит строкой
const money = (v: string | number | null | undefined) =>
  +Number(v ?? 0).toFixed(2);

@Injectable()
export class FinanceService {
  constructor(
    private dataSource: DataSource,
    @InjectRepository(Wallet) private walletRepo: Repository<Wallet>,
    @InjectRepository(FinanceCategory)
    private categoryRepo: Repository<FinanceCategory>,
    @InjectRepository(FinanceTransaction)
    private txRepo: Repository<FinanceTransaction>,
  ) {}

  // при первом заходе в финансы — стандартные категории и кошелёк на языке интерфейса.
  // Флаг ставится атомарно, поэтому параллельные запросы не создадут дубликатов,
  // а удалённые юзером стандартные категории не появятся снова.
  async ensureSeeded(userId: number, lang: Language) {
    await this.dataSource.transaction(async (manager) => {
      const result = await manager
        .createQueryBuilder()
        .update(User)
        .set({ financeSeeded: true })
        .where('id = :userId AND "financeSeeded" = false', { userId })
        .execute();
      if (!result.affected) return;

      await manager.save(
        manager.create(Wallet, {
          userId,
          name: FINANCE_DEFAULTS[lang].wallet,
          initialBalance: '0',
        }),
      );
      await manager.save(
        defaultCategories(lang).map((c) =>
          manager.create(FinanceCategory, { userId, ...c }),
        ),
      );
    });
  }

  // ---- кошельки ----

  private async balances(userId: number): Promise<Map<number, number>> {
    const rows: { id: number; balance: string }[] = await this.walletRepo
      .createQueryBuilder('w')
      .leftJoin(FinanceTransaction, 't', 't.walletId = w.id')
      .select('w.id', 'id')
      .addSelect(
        `w."initialBalance" + COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0)`,
        'balance',
      )
      .where('w.userId = :userId', { userId })
      .groupBy('w.id')
      .getRawMany();
    return new Map(rows.map((r) => [Number(r.id), money(r.balance)]));
  }

  private toWallet(w: Wallet, balance: number) {
    return {
      id: w.id,
      name: w.name,
      initialBalance: money(w.initialBalance),
      balance,
    };
  }

  async listWallets(userId: number, lang: Language) {
    await this.ensureSeeded(userId, lang);
    const wallets = await this.walletRepo.find({
      where: { userId },
      order: { id: 'ASC' },
    });
    const balances = await this.balances(userId);
    return wallets.map((w) => this.toWallet(w, balances.get(w.id) ?? 0));
  }

  private async findWallet(userId: number, id: number) {
    const wallet = await this.walletRepo.findOne({ where: { id, userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    return wallet;
  }

  private async walletWithBalance(userId: number, wallet: Wallet) {
    const balances = await this.balances(userId);
    return this.toWallet(wallet, balances.get(wallet.id) ?? 0);
  }

  async createWallet(userId: number, dto: CreateWalletDto, lang: Language) {
    await this.ensureSeeded(userId, lang);
    const wallet = await this.walletRepo.save(
      this.walletRepo.create({
        userId,
        name: dto.name,
        initialBalance: String(dto.initialBalance ?? 0),
      }),
    );
    return this.walletWithBalance(userId, wallet);
  }

  async updateWallet(userId: number, id: number, dto: UpdateWalletDto) {
    const wallet = await this.findWallet(userId, id);
    if (dto.name !== undefined) wallet.name = dto.name;
    if (dto.initialBalance !== undefined)
      wallet.initialBalance = String(dto.initialBalance);
    await this.walletRepo.save(wallet);
    return this.walletWithBalance(userId, wallet);
  }

  // удалить можно только пустой кошелёк — ни плюса, ни минуса; его операции уходят вместе с ним
  async deleteWallet(userId: number, id: number) {
    const wallet = await this.findWallet(userId, id);
    const { balance } = await this.walletWithBalance(userId, wallet);
    if (balance !== 0) {
      throw new ConflictException(
        'Only a wallet with a zero balance can be deleted',
      );
    }
    await this.walletRepo.delete({ id, userId });
    return { removed: true };
  }

  // ---- категории ----

  private toCategory(c: FinanceCategory) {
    return { id: c.id, name: c.name, type: c.type };
  }

  async listCategories(
    userId: number,
    lang: Language,
    type?: TransactionType,
  ) {
    await this.ensureSeeded(userId, lang);
    const categories = await this.categoryRepo.find({
      where: type ? { userId, type } : { userId },
      order: { id: 'ASC' },
    });
    return categories.map((c) => this.toCategory(c));
  }

  private async findCategory(userId: number, id: number) {
    const category = await this.categoryRepo.findOne({
      where: { id, userId },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  // в пределах одного типа имена не повторяются (без учёта регистра)
  private async assertUniqueName(
    userId: number,
    type: TransactionType,
    name: string,
    exceptId?: number,
  ) {
    const qb = this.categoryRepo
      .createQueryBuilder('c')
      .where('c.userId = :userId AND c.type = :type', { userId, type })
      .andWhere('LOWER(c.name) = LOWER(:name)', { name });
    if (exceptId) qb.andWhere('c.id != :exceptId', { exceptId });
    if (await qb.getExists()) {
      throw new ConflictException('A category with this name already exists');
    }
  }

  async createCategory(
    userId: number,
    dto: CreateCategoryDto,
    lang: Language,
  ) {
    await this.ensureSeeded(userId, lang);
    await this.assertUniqueName(userId, dto.type, dto.name);
    const category = await this.categoryRepo.save(
      this.categoryRepo.create({ userId, name: dto.name, type: dto.type }),
    );
    return this.toCategory(category);
  }

  async renameCategory(userId: number, id: number, dto: RenameCategoryDto) {
    const category = await this.findCategory(userId, id);
    await this.assertUniqueName(userId, category.type, dto.name, id);
    category.name = dto.name;
    await this.categoryRepo.save(category);
    return this.toCategory(category);
  }

  // операции этой категории остаются, но уже без категории
  async deleteCategory(userId: number, id: number) {
    await this.findCategory(userId, id);
    await this.categoryRepo.delete({ id, userId });
    return { removed: true };
  }

  // ---- операции ----

  private toTransaction(t: FinanceTransaction) {
    return {
      id: t.id,
      type: t.type,
      amount: money(t.amount),
      note: t.note,
      date: t.date,
      walletId: t.walletId,
      walletName: t.wallet?.name ?? null,
      categoryId: t.categoryId,
      categoryName: t.category?.name ?? null,
    };
  }

  private applyFilters(
    qb: SelectQueryBuilder<FinanceTransaction>,
    userId: number,
    f: TransactionFiltersDto,
  ) {
    qb.where('t.userId = :userId', { userId });
    if (f.type) qb.andWhere('t.type = :type', { type: f.type });
    if (f.walletId)
      qb.andWhere('t.walletId = :walletId', { walletId: f.walletId });
    if (f.categoryId === 'none') qb.andWhere('t.categoryId IS NULL');
    else if (f.categoryId)
      qb.andWhere('t.categoryId = :categoryId', { categoryId: f.categoryId });
    if (f.from) qb.andWhere('t.date >= :from', { from: f.from });
    if (f.to) qb.andWhere('t.date <= :to', { to: f.to });
    return qb;
  }

  async listTransactions(userId: number, filters: TransactionFiltersDto) {
    const qb = this.txRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.wallet', 'wallet')
      .leftJoinAndSelect('t.category', 'category');
    const rows = await this.applyFilters(qb, userId, filters)
      .orderBy('t.date', 'DESC')
      .addOrderBy('t.id', 'DESC')
      .getMany();
    return rows.map((t) => this.toTransaction(t));
  }

  // кошелёк и категория должны быть свои, а тип категории — совпадать с типом операции
  private async checkRefs(
    userId: number,
    type: TransactionType,
    walletId: number,
    categoryId: number | null,
  ) {
    await this.findWallet(userId, walletId);
    if (categoryId != null) {
      const category = await this.findCategory(userId, categoryId);
      if (category.type !== type) {
        throw new BadRequestException(
          `Category "${category.name}" is for ${category.type}, not ${type}`,
        );
      }
    }
  }

  private async findTransaction(userId: number, id: number) {
    const tx = await this.txRepo.findOne({
      where: { id, userId },
      relations: { wallet: true, category: true },
    });
    if (!tx) throw new NotFoundException('Transaction not found');
    return tx;
  }

  async createTransaction(userId: number, dto: CreateTransactionDto) {
    const categoryId = dto.categoryId ?? null;
    await this.checkRefs(userId, dto.type, dto.walletId, categoryId);
    const tx = await this.txRepo.save(
      this.txRepo.create({
        userId,
        type: dto.type,
        walletId: dto.walletId,
        categoryId,
        amount: String(dto.amount),
        note: dto.note ?? '',
        date: dto.date,
      }),
    );
    return this.toTransaction(await this.findTransaction(userId, tx.id));
  }

  async updateTransaction(
    userId: number,
    id: number,
    dto: UpdateTransactionDto,
  ) {
    const tx = await this.findTransaction(userId, id);
    const type = dto.type ?? tx.type;
    const walletId = dto.walletId ?? tx.walletId;
    const categoryId =
      dto.categoryId !== undefined ? dto.categoryId : tx.categoryId;
    await this.checkRefs(userId, type, walletId, categoryId);

    await this.txRepo.update(
      { id, userId },
      {
        type,
        walletId,
        categoryId,
        ...(dto.amount !== undefined && { amount: String(dto.amount) }),
        ...(dto.note !== undefined && { note: dto.note }),
        ...(dto.date !== undefined && { date: dto.date }),
      },
    );
    return this.toTransaction(await this.findTransaction(userId, id));
  }

  async deleteTransaction(userId: number, id: number) {
    const result = await this.txRepo.delete({ id, userId });
    if (!result.affected) throw new NotFoundException('Transaction not found');
    return { removed: true };
  }

  // итоги за период: сколько пришло, сколько ушло и разбивка по категориям
  async summary(userId: number, filters: TransactionFiltersDto) {
    const qb = this.txRepo
      .createQueryBuilder('t')
      .leftJoin('t.category', 'category')
      .select('t.type', 'type')
      .addSelect('t.categoryId', 'categoryId')
      .addSelect('category.name', 'name')
      .addSelect('SUM(t.amount)', 'total')
      .addSelect('COUNT(*)', 'count');
    const rows: {
      type: TransactionType;
      categoryId: number | null;
      name: string | null;
      total: string;
      count: string;
    }[] = await this.applyFilters(qb, userId, filters)
      .groupBy('t.type')
      .addGroupBy('t.categoryId')
      .addGroupBy('category.name')
      .getRawMany();

    const byCategory = rows
      .map((r) => ({
        type: r.type,
        categoryId: r.categoryId == null ? null : Number(r.categoryId),
        name: r.name,
        total: money(r.total),
        count: Number(r.count),
      }))
      .sort((a, b) => b.total - a.total);

    const sum = (type: TransactionType) =>
      money(
        byCategory
          .filter((c) => c.type === type)
          .reduce((acc, c) => acc + c.total, 0),
      );
    const income = sum('income');
    const expense = sum('expense');

    return { income, expense, net: money(income - expense), byCategory };
  }
}
