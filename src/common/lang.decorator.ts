// common/lang.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { toLanguage } from './languages';

// @Lang() — язык ответа из ?lang=..., фронт добавляет его к каждому запросу
export const Lang = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) =>
    toLanguage(ctx.switchToHttp().getRequest().query?.lang),
);
