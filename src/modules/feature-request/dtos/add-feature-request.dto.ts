import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { CharactersLimitConstants } from '../../../common/const/character-limit.const';

export class AddFeatureRequestDto {
  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiProperty({ maxLength: CharactersLimitConstants.MAX_DESCRIPTION_LENGTH })
  @IsString()
  @IsNotEmpty()
  @MaxLength(CharactersLimitConstants.MAX_DESCRIPTION_LENGTH)
  description!: string;
}
