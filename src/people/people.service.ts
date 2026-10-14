// people/people.service.ts — публичные профили и подписки
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/users.entity';
import { UserFollow } from '../users/user-follow.entity';
import { UsersService } from '../users/users.service';
import { publicUser } from '../users/public-user';
import { RecipesService } from '../recipes/recipes.service';

@Injectable()
export class PeopleService {
  constructor(
    private users: UsersService,
    private recipes: RecipesService,
    @InjectRepository(UserFollow) private followRepo: Repository<UserFollow>,
  ) {}

  private async byUsername(username: string) {
    const user = await this.users.findByUsername(username);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async isFollowing(followerId: number, followeeId: number) {
    return this.followRepo.existsBy({ followerId, followeeId });
  }

  // профиль, как его видит viewer: ник/имя, счётчики, его публичные рецепты
  async profile(username: string, viewerId: number, lang: string) {
    const user = await this.byUsername(username);
    const [followers, following, followedByMe, recipes] = await Promise.all([
      this.followRepo.countBy({ followeeId: user.id }),
      this.followRepo.countBy({ followerId: user.id }),
      this.isFollowing(viewerId, user.id),
      this.recipes.publicByAuthor(user.id, viewerId, lang),
    ]);
    return {
      ...publicUser(user),
      joinedAt: user.createdAt,
      isMe: user.id === viewerId,
      followedByMe,
      followers,
      following,
      recipes,
    };
  }

  async follow(username: string, viewerId: number) {
    const user = await this.byUsername(username);
    if (user.id === viewerId)
      throw new BadRequestException('You can’t follow yourself');
    // повторная подписка (две вкладки) — не ошибка
    await this.followRepo
      .createQueryBuilder()
      .insert()
      .values({ followerId: viewerId, followeeId: user.id })
      .orIgnore()
      .execute();
    return this.followState(user.id, viewerId);
  }

  async unfollow(username: string, viewerId: number) {
    const user = await this.byUsername(username);
    await this.followRepo.delete({ followerId: viewerId, followeeId: user.id });
    return this.followState(user.id, viewerId);
  }

  private async followState(userId: number, viewerId: number) {
    const [followers, followedByMe] = await Promise.all([
      this.followRepo.countBy({ followeeId: userId }),
      this.isFollowing(viewerId, userId),
    ]);
    return { followedByMe, followers };
  }

  // кто подписан на юзера / на кого подписан он; новые сверху
  async list(
    username: string,
    which: 'followers' | 'following',
    viewerId: number,
  ) {
    const user = await this.byUsername(username);
    const rows = await this.followRepo.find({
      where:
        which === 'followers'
          ? { followeeId: user.id }
          : { followerId: user.id },
      relations: {
        follower: which === 'followers',
        followee: which === 'following',
      },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
    const people: User[] = rows.map((r) =>
      which === 'followers' ? r.follower : r.followee,
    );
    const mine = new Set(
      (
        await this.followRepo.find({
          select: { followeeId: true },
          where: { followerId: viewerId },
        })
      ).map((f) => f.followeeId),
    );
    return people.map((p) => ({
      ...publicUser(p),
      isMe: p.id === viewerId,
      followedByMe: mine.has(p.id),
    }));
  }
}
