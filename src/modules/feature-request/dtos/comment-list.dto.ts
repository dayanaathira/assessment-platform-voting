import { Expose, Type } from 'class-transformer';
import { CommentDto } from './comment.dto';

export class CommentListDto {
  @Expose()
  @Type(() => CommentDto)
  items!: CommentDto[];

  @Expose()
  total!: number;

  @Expose()
  limit!: number;

  @Expose()
  offset!: number;
}
