import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt } from 'class-validator';
import { STATUS_ID } from '../../../common/const/status.const';

export class UpdateStatusDto {
  @ApiProperty({ enum: Object.values(STATUS_ID) })
  @Type(() => Number)
  @IsInt()
  @IsIn(Object.values(STATUS_ID))
  statusId!: number;
}
