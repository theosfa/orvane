// users/public-user.ts — как юзер выглядит для других: ник и, если он разрешил, имя
import { User } from './users.entity';

export type PublicUser = { username: string; name: string | null };

export function publicUser(
  u: Pick<User, 'username' | 'firstName' | 'lastName' | 'showFullName'>,
): PublicUser {
  const full = `${u.firstName} ${u.lastName}`.trim();
  return { username: u.username, name: u.showFullName && full ? full : null };
}
