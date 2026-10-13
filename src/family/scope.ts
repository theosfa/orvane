// family/scope.ts — чьи данные читаем и пишем: личные (familyId = null) или семейные
import { IsNull, ObjectLiteral, SelectQueryBuilder } from 'typeorm';

export type Scope = {
  userId: number; // кто действует (автор новых записей)
  familyId: number | null; // null — личные данные
};

// ?scope=family — семейные данные, всё остальное — личные
export type ScopeName = 'personal' | 'family';
export const toScopeName = (v: unknown): ScopeName =>
  v === 'family' ? 'family' : 'personal';

// условие where для find(): чьи записи
export function ownedBy(scope: Scope) {
  return scope.familyId
    ? { familyId: scope.familyId }
    : { userId: scope.userId, familyId: IsNull() };
}

// поля для новой записи
export function ownerFields(scope: Scope) {
  return { userId: scope.userId, familyId: scope.familyId };
}

// то же для query builder
export function whereOwnedBy<T extends ObjectLiteral>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  scope: Scope,
) {
  return scope.familyId
    ? qb.where(`${alias}.familyId = :familyId`, { familyId: scope.familyId })
    : qb.where(`${alias}.userId = :userId AND ${alias}.familyId IS NULL`, {
        userId: scope.userId,
      });
}
