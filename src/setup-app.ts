// setup-app.ts — общая настройка приложения: её же используют e2e-тесты
import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

export function configureApp(app: INestApplication) {
  app.use(cookieParser());

  app.enableCors({
    origin: true, // или true для разрешения всех origins (только на dev!)
    credentials: true, // refresh-токен ходит в httpOnly-куке
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
}
