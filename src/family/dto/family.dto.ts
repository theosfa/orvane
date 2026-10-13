// family/dto/family.dto.ts
import { IsEmail, IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { FAMILY_ROLES } from '../family.entity';
import type { FamilyRole } from '../family.entity';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class FamilyNameDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name: string;
}

export class InviteDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  email: string;
}

export class SetRoleDto {
  @IsIn(FAMILY_ROLES)
  role: FamilyRole;
}
