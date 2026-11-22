import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { CharactersLimitConstants } from '../../../common/const/character-limit.const';
import { trimString } from '../../../common/utils/query.util';

export class AddCommentDto {
  @ApiProperty({ maxLength: CharactersLimitConstants.MAX_DESCRIPTION_LENGTH })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(CharactersLimitConstants.MAX_DESCRIPTION_LENGTH)
  body!: string;
}
