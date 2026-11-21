import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { FeatureRequestService } from './feature-request.service';
import { FeatureRequestController } from './feature-request.controller';
import { FeatureRequest } from './entities/feature-request.entity';
import { Comment } from './entities/comment.entity';
import { Vote } from './entities/votes.entity';
import { RequestMerge } from './entities/request-merge.entity';
import { Status } from './entities/status.entity';

@Module({
  imports: [
    MikroOrmModule.forFeature([
      FeatureRequest,
      Comment,
      Vote,
      RequestMerge,
      Status,
    ]),
  ],
  providers: [FeatureRequestService],
  exports: [FeatureRequestService],
  controllers: [FeatureRequestController],
})
export class FeatureRequestModule {}
