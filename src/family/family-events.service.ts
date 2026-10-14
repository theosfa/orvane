// family/family-events.service.ts — живые обновления: кому из семьи перечитать какие данные
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Observable, Subject, filter, interval, map, merge } from 'rxjs';
import { FamilyMember } from './family.entity';
import { User } from '../users/users.entity';

// что изменилось: общие данные (menu, tasks, finance) или сама семья (участники, приглашения)
export type FamilyTopic = 'menu' | 'tasks' | 'finance' | 'family';

type FamilyEvent = {
  userIds: Set<number>; // кому отправить
  topic: FamilyTopic;
  origin: string | null; // X-Client-Id вкладки, которая сделала изменение: она его уже знает
};

// событие уходит без самих данных: клиент просто перечитывает нужное через обычный API
export type LiveMessage = { data: { topic: FamilyTopic; origin: string | null } | { topic: 'ping' } };

const PING_MS = 25_000; // держит соединение живым через прокси и туннели

@Injectable()
export class FamilyEventsService {
  private events = new Subject<FamilyEvent>();

  constructor(
    @InjectRepository(FamilyMember) private memberRepo: Repository<FamilyMember>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  stream(userId: number): Observable<LiveMessage> {
    return merge(
      this.events.pipe(
        filter((e) => e.userIds.has(userId)),
        map((e) => ({ data: { topic: e.topic, origin: e.origin } })),
      ),
      interval(PING_MS).pipe(map(() => ({ data: { topic: 'ping' as const } }))),
    );
  }

  // всем участникам семей (и отдельным юзерам: ушедшим, приглашённым)
  async notify(
    topic: FamilyTopic,
    origin: string | null,
    { families = [], users = [], emails = [] }: { families?: (number | null | undefined)[]; users?: number[]; emails?: string[] },
  ) {
    const userIds = new Set(users);
    const familyIds = families.filter((id): id is number => typeof id === 'number');
    if (familyIds.length) {
      const members = await this.memberRepo.find({ where: { familyId: In(familyIds) } });
      members.forEach((m) => userIds.add(m.userId));
    }
    if (emails.length) {
      const found = await this.userRepo
        .createQueryBuilder('u')
        .where('LOWER(u.email) IN (:...emails)', { emails: emails.map((e) => e.toLowerCase()) })
        .getMany();
      found.forEach((u) => userIds.add(u.id));
    }
    if (userIds.size) this.events.next({ userIds, topic, origin });
  }
}
