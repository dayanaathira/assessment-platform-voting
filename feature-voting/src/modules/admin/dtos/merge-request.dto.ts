import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class MergeRequestDto {
  @ApiProperty({ description: 'The request to merge into.' })
  @IsUUID()
  targetId!: string;
}
