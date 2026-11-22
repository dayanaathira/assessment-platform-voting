import {
  ArgumentMetadata,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { ListFeatureRequestQueryDto } from './list-feature-request-query.dto';

// The same pipe settings as main.ts.
const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});
const metadata: ArgumentMetadata = {
  type: 'query',
  metatype: ListFeatureRequestQueryDto,
};

describe('ListFeatureRequestQueryDto', () => {
  it('applies defaults to an empty query', async () => {
    await expect(pipe.transform({}, metadata)).resolves.toMatchObject({
      limit: 20,
      offset: 0,
      sort: 'votes',
    });
  });

  it('trims the search, converts numbers and DD-MM-YYYY dates', async () => {
    await expect(
      pipe.transform(
        {
          q: '  dark mode  ',
          status: '2',
          fromDate: '01-11-2026',
          toDate: '30-11-2026',
          sort: 'new',
          limit: '10',
          offset: '20',
        },
        metadata,
      ),
    ).resolves.toMatchObject({
      q: 'dark mode',
      status: 2,
      fromDate: '2026-11-01',
      toDate: '2026-11-30',
      sort: 'new',
      limit: 10,
      offset: 20,
    });
  });

  it.each([
    ['an ISO date instead of DD-MM-YYYY', { fromDate: '2026-11-01' }],
    ['an impossible date', { toDate: '31-02-2026' }],
    ['an unknown status', { status: '9' }],
    ['a zero limit', { limit: '0' }],
    ['a limit over 100', { limit: '101' }],
    ['a negative offset', { offset: '-1' }],
    ['an unknown sort', { sort: 'oldest' }],
    ['an unknown field', { owner: 'me' }],
  ])('rejects %s', async (_label, query) => {
    await expect(pipe.transform(query, metadata)).rejects.toThrow(
      BadRequestException,
    );
  });
});
