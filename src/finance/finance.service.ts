// finance/finance.service.ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { randomUUID } from 'crypto';
import { User } from '../users/users.entity';
import type { Language } from '../common/languages';
import { Wallet } from './wallet.entity';
import { FinanceCategory } from './finance-category.entity';
import { FinanceTransaction } from './finance-transaction.entity';
import { Task } from '../tasks/task.entity';
import { FINANCE_DEFAULTS, defaultCategories } from './finance-defaults';
import type { TransactionType } from './finance-types';
import { CreateWalletDto, UpdateWalletDto } from './dto/wallet.dto';
import { CreateCategoryDto, RenameCategoryDto } from './dto/category.dto';
import {
  CreateTransactionDto,
  CreateTransferDto,
  TransactionFiltersDto,
  UpdateTransactionDto,
} from './dto/transaction.dto';
import { Scope, ownedBy, ownerFields, whereOwnedBy } from '../family/scope';
import { FamilyService } from '../family/family.service';
import { FamilyMember } from '../family/family.entity';

// numeric из Postgres приходит строкой
const money = (v: string | number | null | undefined) =>
  +Number(v ?? 0).toFixed(2);

// Все методы работают в области scope: личные финансы юзера или бюджет его семьи.
// Права (смотреть / менять семейное) проверяет контроллер через FamilyService.scope().
@Injectable()
export class FinanceService {
  constructor(
    private dataSource: DataSource,
    private family: FamilyService,
    @InjectRepository(Wallet) private walletRepo: Repository<Wallet>,
    @InjectRepository(FinanceCategory)
    private categoryRepo: Repository<FinanceCategory>,
    @InjectRepository(FinanceTransaction)
    private txRepo: Repository<FinanceTransaction>,
  ) {}

  // при первом заходе в личные финансы — стандартные категории и кошелёк на языке интерфейса.
  // Флаг ставится атомарно, поэтому параллельные запросы не создадут дубликатов,
  // а удалённые юзером стандартные категории не появятся снова.
  // Семейные создаются вместе с семьёй (FamilyService.create).
  async ensureSeeded(scope: Scope, lang: Language) {
    if (scope.familyId) return;
    const userId = scope.userId;
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

  private async balances(scope: Scope): Promise<Map<number, number>> {
    const qb = this.walletRepo
      .createQueryBuilder('w')
      .leftJoin(FinanceTransaction, 't', 't.walletId = w.id')
      .select('w.id', 'id')
      .addSelect(
        `w."initialBalance" + COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END), 0)`,
        'balance',
      );
    const rows: { id: number; balance: string }[] = await whereOwnedBy(qb, 'w', scope)
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
      family: w.familyId !== null,
    };
  }

  async listWallets(scope: Scope, lang: Language) {
    await this.ensureSeeded(scope, lang);
    const wallets = await this.walletRepo.find({
      where: ownedBy(scope),
      order: { id: 'ASC' },
    });
    const balances = await this.balances(scope);
    return wallets.map((w) => this.toWallet(w, balances.get(w.id) ?? 0));
  }

  private async findWallet(scope: Scope, id: number) {
    const wallet = await this.walletRepo.findOne({
      where: { id, ...ownedBy(scope) },
    });
    if (!wallet) throw new NotFoundException('Wallet not found');
    return wallet;
  }

  private async walletWithBalance(scope: Scope, wallet: Wallet) {
    const balances = await this.balances(scope);
    return this.toWallet(wallet, balances.get(wallet.id) ?? 0);
  }

  async createWallet(scope: Scope, dto: CreateWalletDto, lang: Language) {
    await this.ensureSeeded(scope, lang);
    const wallet = await this.walletRepo.save(
      this.walletRepo.create({
        ...ownerFields(scope),
        name: dto.name,
        initialBalance: String(dto.initialBalance ?? 0),
      }),
    );
    return this.walletWithBalance(scope, wallet);
  }

  async updateWallet(scope: Scope, id: number, dto: UpdateWalletDto) {
    const wallet = await this.findWallet(scope, id);
    if (dto.name !== undefined) wallet.name = dto.name;
    if (dto.initialBalance !== undefined)
      wallet.initialBalance = String(dto.initialBalance);
    await this.walletRepo.save(wallet);
    return this.walletWithBalance(scope, wallet);
  }

  // удалить можно только пустой кошелёк — ни плюса, ни минуса; его операции уходят вместе с ним
  async deleteWallet(scope: Scope, id: number) {
    const wallet = await this.findWallet(scope, id);
    const { balance } = await this.walletWithBalance(scope, wallet);
    if (balance !== 0) {
      throw new ConflictException(
        'Only a wallet with a zero balance can be deleted',
      );
    }
    await this.walletRepo.delete({ id });
    return { removed: true };
  }

  // ---- категории ----

  private toCategory(c: FinanceCategory) {
    return { id: c.id, name: c.name, type: c.type, key: c.key };
  }

  async listCategories(scope: Scope, lang: Language, type?: TransactionType) {
    await this.ensureSeeded(scope, lang);
    const categories = await this.categoryRepo.find({
      where: { ...ownedBy(scope), ...(type && { type }) },
      order: { id: 'ASC' },
    });
    return categories.map((c) => this.toCategory(c));
  }

  private async findCategory(scope: Scope, id: number) {
    const category = await this.categoryRepo.findOne({
      where: { id, ...ownedBy(scope) },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  // в пределах одного типа имена не повторяются (без учёта регистра)
  private async assertUniqueName(
    scope: Scope,
    type: TransactionType,
    name: string,
    exceptId?: number,
  ) {
    const qb = whereOwnedBy(this.categoryRepo.createQueryBuilder('c'), 'c', scope)
      .andWhere('c.type = :type', { type })
      .andWhere('LOWER(c.name) = LOWER(:name)', { name });
    if (exceptId) qb.andWhere('c.id != :exceptId', { exceptId });
    if (await qb.getExists()) {
      throw new ConflictException('A category with this name already exists');
    }
  }

  async createCategory(scope: Scope, dto: CreateCategoryDto, lang: Language) {
    await this.ensureSeeded(scope, lang);
    await this.assertUniqueName(scope, dto.type, dto.name);
    const category = await this.categoryRepo.save(
      this.categoryRepo.create({ ...ownerFields(scope), name: dto.name, type: dto.type }),
    );
    return this.toCategory(category);
  }

  async renameCategory(scope: Scope, id: number, dto: RenameCategoryDto) {
    const category = await this.findCategory(scope, id);
    await this.assertUniqueName(scope, category.type, dto.name, id);
    category.name = dto.name;
    await this.categoryRepo.save(category);
    return this.toCategory(category);
  }

  // операции этой категории остаются, но уже без категории
  async deleteCategory(scope: Scope, id: number) {
    await this.findCategory(scope, id);
    await this.categoryRepo.delete({ id });
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
      // перевод между кошельками (в итогах не считается)
      transfer: t.transferId !== null,
      // кто записал — важно в семейном бюджете
      author: t.user?.email ?? null,
    };
  }

  private applyFilters(
    qb: SelectQueryBuilder<FinanceTransaction>,
    scope: Scope,
    f: TransactionFiltersDto,
  ) {
    whereOwnedBy(qb, 't', scope);
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

  async listTransactions(scope: Scope, filters: TransactionFiltersDto) {
    const qb = this.txRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.wallet', 'wallet')
      .leftJoinAndSelect('t.category', 'category')
      .leftJoinAndSelect('t.user', 'user');
    const rows = await this.applyFilters(qb, scope, filters)
      .orderBy('t.date', 'DESC')
      .addOrderBy('t.id', 'DESC')
      .getMany();
    return rows.map((t) => this.toTransaction(t));
  }

  // кошелёк и категория должны быть из этой же области, а тип категории — совпадать с типом операции
  private async checkRefs(
    scope: Scope,
    type: TransactionType,
    walletId: number,
    categoryId: number | null,
  ) {
    await this.findWallet(scope, walletId);
    if (categoryId != null) {
      const category = await this.findCategory(scope, categoryId);
      if (category.type !== type) {
        throw new BadRequestException(
          `Category "${category.name}" is for ${category.type}, not ${type}`,
        );
      }
    }
  }

  private async findTransaction(scope: Scope, id: number) {
    const tx = await this.txRepo.findOne({
      where: { id, ...ownedBy(scope) },
      relations: { wallet: true, category: true, user: true },
    });
    if (!tx) throw new NotFoundException('Transaction not found');
    return tx;
  }

  // с taskId запись и отметка «выполнено» у задачи (из той же области) сохраняются вместе
  async createTransaction(scope: Scope, dto: CreateTransactionDto) {
    const categoryId = dto.categoryId ?? null;
    await this.checkRefs(scope, dto.type, dto.walletId, categoryId);
    const id = await this.dataSource.transaction(async (manager) => {
      if (dto.taskId !== undefined) {
        const result = await manager.update(
          Task,
          { id: dto.taskId, ...ownedBy(scope) },
          { done: true },
        );
        if (!result.affected) throw new NotFoundException('Task not found');
      }
      const tx = await manager.save(
        manager.create(FinanceTransaction, {
          ...ownerFields(scope),
          type: dto.type,
          walletId: dto.walletId,
          categoryId,
          amount: String(dto.amount),
          note: dto.note ?? '',
          date: dto.date,
        }),
      );
      return tx.id;
    });
    return this.toTransaction(await this.findTransaction(scope, id));
  }

  async updateTransaction(scope: Scope, id: number, dto: UpdateTransactionDto) {
    const tx = await this.findTransaction(scope, id);
    if (tx.transferId) {
      throw new BadRequestException('A transfer can only be deleted, not edited');
    }
    const type = dto.type ?? tx.type;
    const walletId = dto.walletId ?? tx.walletId;
    const categoryId =
      dto.categoryId !== undefined ? dto.categoryId : tx.categoryId;
    await this.checkRefs(scope, type, walletId, categoryId);

    await this.txRepo.update(
      { id },
      {
        type,
        walletId,
        categoryId,
        ...(dto.amount !== undefined && { amount: String(dto.amount) }),
        ...(dto.note !== undefined && { note: dto.note }),
        ...(dto.date !== undefined && { date: dto.date }),
      },
    );
    return this.toTransaction(await this.findTransaction(scope, id));
  }

  // перевод удаляется целиком (обе записи), если можно менять обе стороны
  async deleteTransaction(scope: Scope, id: number) {
    const tx = await this.findTransaction(scope, id);
    if (tx.transferId) {
      const pair = await this.txRepo.find({ where: { transferId: tx.transferId } });
      for (const side of pair) {
        if (!(await this.family.canEdit(scope.userId, side.familyId))) {
          throw new ForbiddenException('Only a family admin can undo this transfer');
        }
      }
      await this.txRepo.delete({ transferId: tx.transferId });
    } else {
      await this.txRepo.delete({ id });
    }
    return { removed: true };
  }

  // кошелёк из личных юзера или из бюджета его семьи
  private async walletAnyScope(userId: number, id: number) {
    const wallet = await this.walletRepo.findOne({ where: { id } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    if (wallet.familyId === null) {
      if (wallet.userId !== userId) throw new NotFoundException('Wallet not found');
      return wallet;
    }
    const member = await this.dataSource
      .getRepository(FamilyMember)
      .findOneBy({ userId, familyId: wallet.familyId });
    if (!member) throw new NotFoundException('Wallet not found');
    return wallet;
  }

  // перевод между кошельками, например из личного в семейный бюджет: расход в одном
  // и доход в другом с общим transferId. Обе стороны должны быть доступны юзеру для изменения
  async createTransfer(userId: number, dto: CreateTransferDto) {
    if (dto.fromWalletId === dto.toWalletId) {
      throw new BadRequestException('Choose two different wallets');
    }
    const from = await this.walletAnyScope(userId, dto.fromWalletId);
    const to = await this.walletAnyScope(userId, dto.toWalletId);
    for (const w of [from, to]) {
      if (!(await this.family.canEdit(userId, w.familyId))) {
        throw new ForbiddenException('Only family admins can move money in or out of the family budget');
      }
    }
    const transferId = randomUUID();
    const base = { userId, amount: String(dto.amount), note: dto.note ?? '', date: dto.date, categoryId: null, transferId };
    await this.dataSource.transaction(async (m) => {
      await m.save(m.create(FinanceTransaction, { ...base, familyId: from.familyId, walletId: from.id, type: 'expense' }));
      await m.save(m.create(FinanceTransaction, { ...base, familyId: to.familyId, walletId: to.id, type: 'income' }));
    });
    return { transferId };
  }

  // итоги за период: сколько пришло, сколько ушло и разбивка по категориям; переводы не считаются
  async summary(scope: Scope, filters: TransactionFiltersDto) {
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
    }[] = await this.applyFilters(qb, scope, filters)
      .andWhere('t.transferId IS NULL')
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
