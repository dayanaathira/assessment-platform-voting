import { Module } from '@nestjs/common';
import { FeatureRequestModule } from '../feature-request/feature-request.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { MergeService } from './merge.service';

@Module({
  imports: [FeatureRequestModule],
  providers: [AdminService, MergeService],
  controllers: [AdminController],
})
export class AdminModule {}
