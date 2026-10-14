// family/family-events.interceptor.ts — после удачного изменения семейных данных
// (menu, tasks, finance с ?scope=family) сообщает участникам семьи, что их пора перечитать
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { tap } from 'rxjs';
import { FamilyEventsService, FamilyTopic } from './family-events.service';
import { FamilyService } from './family.service';

const SHARED: FamilyTopic[] = ['menu', 'tasks', 'finance'];

export const originOf = (req: any): string | null => {
  const id = req.headers?.['x-client-id'];
  return typeof id === 'string' && id ? id.slice(0, 64) : null;
};

@Injectable()
export class FamilyEventsInterceptor implements NestInterceptor {
  constructor(
    private family: FamilyService,
    private events: FamilyEventsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const req = context.switchToHttp().getRequest();
    const topic = req.path?.split('/')[1] as FamilyTopic;
    const watched =
      req.method !== 'GET' &&
      SHARED.includes(topic) &&
      // перевод может задеть семейный кошелёк и без ?scope=family
      (req.query?.scope === 'family' || req.path === '/finance/transfers');
    if (!watched) return next.handle();

    return next.handle().pipe(
      tap(() => {
        const userId = req.user?.userId;
        if (!userId) return;
        void this.family
          .membership(userId)
          .then((m) => m && this.events.notify(topic, originOf(req), { families: [m.familyId] }))
          .catch(() => undefined); // обновления — не повод ронять уже выполненный запрос
      }),
    );
  }
}
