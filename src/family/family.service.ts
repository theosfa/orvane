// family/family.service.ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  Family,
  FamilyInvite,
  FamilyMember,
  FamilyRole,
  MAX_FAMILY_MEMBERS,
} from './family.entity';
import { Scope, ScopeName } from './scope';
import { Wallet } from '../finance/wallet.entity';
import { FinanceCategory } from '../finance/finance-category.entity';
import { FINANCE_DEFAULTS, defaultCategories } from '../finance/finance-defaults';
import type { Language } from '../common/languages';

const FAMILY_WALLET: Record<Language, string> = {
  en: 'Family budget',
  ru: 'Семейный бюджет',
  uk: 'Сімейний бюджет',
  pl: 'Budżet rodzinny',
  fr: 'Budget familial',
};

@Injectable()
export class FamilyService {
  constructor(
    private dataSource: DataSource,
    @InjectRepository(Family) private familyRepo: Repository<Family>,
    @InjectRepository(FamilyMember) private memberRepo: Repository<FamilyMember>,
    @InjectRepository(FamilyInvite) private inviteRepo: Repository<FamilyInvite>,
  ) {}

  membership(userId: number) {
    return this.memberRepo.findOne({ where: { userId } });
  }

  // область данных для запроса: личная — всегда можно; семейная — только участнику,
  // а менять её (access = 'edit') — только админу
  async scope(userId: number, name: ScopeName, access: 'view' | 'edit'): Promise<Scope> {
    if (name === 'personal') return { userId, familyId: null };
    const member = await this.membership(userId);
    if (!member) throw new ForbiddenException('You are not in a family');
    if (access === 'edit' && member.role !== 'admin') {
      throw new ForbiddenException('Only family admins can change shared data');
    }
    return { userId, familyId: member.familyId };
  }

  // может ли юзер менять данные этой области (для переводов между кошельками)
  async canEdit(userId: number, familyId: number | null) {
    if (familyId === null) return true;
    const member = await this.membership(userId);
    return member?.familyId === familyId && member.role === 'admin';
  }

  // профиль: моя семья (участники, отправленные приглашения) и приглашения мне
  async overview(userId: number, email: string) {
    const invitations = await this.inviteRepo.find({
      where: { email: email.toLowerCase() },
      relations: { family: true, invitedBy: true },
      order: { id: 'ASC' },
    });
    const member = await this.membership(userId);
    const incoming = invitations.map((i) => ({
      id: i.id,
      familyName: i.family.name,
      invitedBy: i.invitedBy.email,
    }));
    if (!member) return { family: null, invitations: incoming };

    const family = await this.familyRepo.findOneByOrFail({ id: member.familyId });
    const members = await this.memberRepo.find({
      where: { familyId: family.id },
      relations: { user: true },
      order: { joinedAt: 'ASC', id: 'ASC' },
    });
    const invites = await this.inviteRepo.find({
      where: { familyId: family.id },
      order: { id: 'ASC' },
    });
    return {
      family: {
        id: family.id,
        name: family.name,
        myRole: member.role,
        maxMembers: MAX_FAMILY_MEMBERS,
        members: members.map((m) => ({
          userId: m.userId,
          email: m.user.email,
          role: m.role,
          isMe: m.userId === userId,
        })),
        invites: invites.map((i) => ({ id: i.id, email: i.email })),
      },
      invitations: incoming,
    };
  }

  // создатель — админ; у семьи сразу свой кошелёк и стандартные категории
  async create(userId: number, email: string, name: string, lang: Language) {
    if (await this.membership(userId)) {
      throw new ConflictException('You are already in a family');
    }
    await this.dataSource.transaction(async (m) => {
      const family = await m.save(m.create(Family, { name }));
      await m.save(m.create(FamilyMember, { familyId: family.id, userId, role: 'admin' }));
      await m.save(
        m.create(Wallet, {
          userId,
          familyId: family.id,
          name: FAMILY_WALLET[lang] ?? FINANCE_DEFAULTS[lang].wallet,
          initialBalance: '0',
        }),
      );
      await m.save(
        defaultCategories(lang).map((c) =>
          m.create(FinanceCategory, { userId, familyId: family.id, ...c }),
        ),
      );
    });
    return this.overview(userId, email);
  }

  private async adminOf(userId: number) {
    const member = await this.membership(userId);
    if (!member) throw new NotFoundException('You are not in a family');
    if (member.role !== 'admin') {
      throw new ForbiddenException('Only family admins can do this');
    }
    return member;
  }

  async rename(userId: number, email: string, name: string) {
    const admin = await this.adminOf(userId);
    await this.familyRepo.update(admin.familyId, { name });
    return this.overview(userId, email);
  }

  // места: участники + ещё не принятые приглашения ≤ MAX_FAMILY_MEMBERS
  async invite(userId: number, email: string, inviteEmail: string) {
    const admin = await this.adminOf(userId);
    const members = await this.memberRepo.find({
      where: { familyId: admin.familyId },
      relations: { user: true },
    });
    if (members.some((m) => m.user.email.toLowerCase() === inviteEmail)) {
      throw new ConflictException('Already in this family');
    }
    if (await this.inviteRepo.existsBy({ familyId: admin.familyId, email: inviteEmail })) {
      throw new ConflictException('Already invited');
    }
    const pending = await this.inviteRepo.countBy({ familyId: admin.familyId });
    if (members.length + pending >= MAX_FAMILY_MEMBERS) {
      throw new ConflictException(`A family can have at most ${MAX_FAMILY_MEMBERS} members`);
    }
    await this.inviteRepo.save(
      this.inviteRepo.create({ familyId: admin.familyId, email: inviteEmail, invitedById: userId }),
    );
    return this.overview(userId, email);
  }

  async cancelInvite(userId: number, email: string, inviteId: number) {
    const admin = await this.adminOf(userId);
    const result = await this.inviteRepo.delete({ id: inviteId, familyId: admin.familyId });
    if (!result.affected) throw new NotFoundException('Invite not found');
    return this.overview(userId, email);
  }

  private async myInvitation(email: string, inviteId: number) {
    const invite = await this.inviteRepo.findOne({
      where: { id: inviteId, email: email.toLowerCase() },
    });
    if (!invite) throw new NotFoundException('Invitation not found');
    return invite;
  }

  async accept(userId: number, email: string, inviteId: number) {
    const invite = await this.myInvitation(email, inviteId);
    if (await this.membership(userId)) {
      throw new ConflictException('Leave your current family first');
    }
    await this.dataSource.transaction(async (m) => {
      const count = await m.countBy(FamilyMember, { familyId: invite.familyId });
      if (count >= MAX_FAMILY_MEMBERS) {
        throw new ConflictException('This family is full');
      }
      await m.save(m.create(FamilyMember, { familyId: invite.familyId, userId, role: 'member' }));
      await m.delete(FamilyInvite, { id: invite.id });
    });
    return this.overview(userId, email);
  }

  async decline(userId: number, email: string, inviteId: number) {
    const invite = await this.myInvitation(email, inviteId);
    await this.inviteRepo.delete({ id: invite.id });
    return this.overview(userId, email);
  }

  private async assertAnotherAdmin(familyId: number, exceptUserId: number) {
    const admins = await this.memberRepo.countBy({ familyId, role: 'admin' });
    const target = await this.memberRepo.findOneBy({ familyId, userId: exceptUserId });
    if (target?.role === 'admin' && admins <= 1) {
      throw new ConflictException('A family needs at least one admin');
    }
  }

  async setRole(userId: number, email: string, memberUserId: number, role: FamilyRole) {
    const admin = await this.adminOf(userId);
    const target = await this.memberRepo.findOneBy({ familyId: admin.familyId, userId: memberUserId });
    if (!target) throw new NotFoundException('Member not found');
    if (role === 'member') await this.assertAnotherAdmin(admin.familyId, memberUserId);
    await this.memberRepo.update(target.id, { role });
    return this.overview(userId, email);
  }

  async removeMember(userId: number, email: string, memberUserId: number) {
    if (memberUserId === userId) throw new BadRequestException('Use leave to leave the family');
    const admin = await this.adminOf(userId);
    const result = await this.memberRepo.delete({ familyId: admin.familyId, userId: memberUserId });
    if (!result.affected) throw new NotFoundException('Member not found');
    return this.overview(userId, email);
  }

  // последний участник уходит — семья и все её общие данные удаляются
  async leave(userId: number, email: string) {
    const member = await this.membership(userId);
    if (!member) throw new NotFoundException('You are not in a family');
    const count = await this.memberRepo.countBy({ familyId: member.familyId });
    if (count === 1) {
      await this.familyRepo.delete(member.familyId);
    } else {
      await this.assertAnotherAdmin(member.familyId, userId);
      await this.memberRepo.delete({ id: member.id });
    }
    return this.overview(userId, email);
  }
}
