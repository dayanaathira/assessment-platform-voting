import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsByteLength,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { trimString } from '../../../common/utils/query.util';
import { ROLE, type RoleName } from '../user.const';

export class AddUserDto {
  @ApiProperty({ maxLength: 255 })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiProperty({ minLength: 3, maxLength: 50, example: 'aisyah.rahman' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @Length(3, 50)
  @Matches(/^[a-z0-9._-]+$/, {
    message: 'username may only contain a-z, 0-9, ".", "_" and "-"',
  })
  username!: string;

  // bcrypt ignores anything past 72 bytes, so longer input is rejected.
  @ApiProperty({ minLength: 8, description: '8 to 72 bytes.' })
  @IsString()
  @IsByteLength(8, 72)
  password!: string;

  @ApiPropertyOptional({ enum: Object.values(ROLE), default: ROLE.USER })
  @IsIn(Object.values(ROLE))
  @IsOptional()
  role: RoleName = ROLE.USER;
}
