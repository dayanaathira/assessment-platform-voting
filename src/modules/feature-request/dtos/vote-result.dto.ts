import { Expose } from 'class-transformer';

export class VoteResultDto {
  @Expose()
  voteCount!: number;

  @Expose()
  hasVoted!: boolean;
}
