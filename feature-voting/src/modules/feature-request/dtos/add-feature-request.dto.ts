import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { CharactersLimitConstants } from '../../../common/const/character-limit.const';
import { trimString } from '../../../common/utils/query.util';

export class AddFeatureRequestDto {
  @ApiProperty({ maxLength: 255 })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiProperty({ maxLength: CharactersLimitConstants.MAX_DESCRIPTION_LENGTH })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(CharactersLimitConstants.MAX_DESCRIPTION_LENGTH)
  description!: string;
}
