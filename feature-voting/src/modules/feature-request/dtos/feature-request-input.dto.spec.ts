import {
  ArgumentMetadata,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { AddFeatureRequestDto } from './add-feature-request.dto';
import { EditFeatureRequestDto } from './edit-feature-request.dto';

// The same pipe settings as main.ts.
const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});
const addMetadata: ArgumentMetadata = {
  type: 'body',
  metatype: AddFeatureRequestDto,
};
const editMetadata: ArgumentMetadata = {
  type: 'body',
  metatype: EditFeatureRequestDto,
};

describe('AddFeatureRequestDto', () => {
  it('trims the title and description', async () => {
    await expect(
      pipe.transform(
        { title: '  Dark mode  ', description: '\n Easier on the eyes. \n' },
        addMetadata,
      ),
    ).resolves.toMatchObject({
      title: 'Dark mode',
      description: 'Easier on the eyes.',
    });
  });

  it.each([
    ['a whitespace-only title', { title: '   ', description: 'Valid' }],
    ['a whitespace-only description', { title: 'Valid', description: ' \n ' }],
    ['a missing title', { description: 'Valid' }],
    [
      'a title over 255 characters',
      { title: 'a'.repeat(256), description: 'Valid' },
    ],
  ])('rejects %s', async (_label, body) => {
    await expect(pipe.transform(body, addMetadata)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('EditFeatureRequestDto', () => {
  it('allows a partial update', async () => {
    await expect(
      pipe.transform({ title: ' Dark mode ' }, editMetadata),
    ).resolves.toEqual({ title: 'Dark mode' });
  });

  it('rejects a whitespace-only title', async () => {
    await expect(
      pipe.transform({ title: '   ' }, editMetadata),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
