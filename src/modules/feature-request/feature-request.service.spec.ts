import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager } from '@mikro-orm/postgresql';
import { FeatureRequestService } from './feature-request.service';

describe('FeatureRequestService', () => {
  let service: FeatureRequestService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureRequestService,
        { provide: EntityManager, useValue: {} },
      ],
    }).compile();

    service = module.get<FeatureRequestService>(FeatureRequestService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
