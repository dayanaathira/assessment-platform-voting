import { Test, TestingModule } from '@nestjs/testing';
import { FeatureRequestController } from './feature-request.controller';

describe('FeatureRequestController', () => {
  let controller: FeatureRequestController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FeatureRequestController],
    }).compile();

    controller = module.get<FeatureRequestController>(FeatureRequestController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
