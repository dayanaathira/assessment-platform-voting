import {
  ArgumentMetadata,
  BadRequestException,
  ValidationPipe,
} from '@nestjs/common';
import { AddUserDto } from './add-user.dto';

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});
const metadata: ArgumentMetadata = { type: 'body', metatype: AddUserDto };
const valid = {
  name: 'User 4',
  username: 'user4',
  password: 'correct-horse-9',
};

describe('AddUserDto', () => {
  it('normalises the username and defaults the role to user', async () => {
    await expect(
      pipe.transform(
        { ...valid, name: '  User 4 ', username: '  User4 ' },
        metadata,
      ),
    ).resolves.toMatchObject({
      name: 'User 4',
      username: 'user4',
      role: 'user',
    });
  });

  it.each([
    ['a short username', { username: 'ab' }],
    ['a username with spaces', { username: 'user four' }],
    ['a blank name', { name: '   ' }],
    ['a short password', { password: 'short' }],
    // bcrypt ignores bytes past 72, so longer passwords are refused.
    ['a password over 72 bytes', { password: 'é'.repeat(40) }],
    ['an unknown role', { role: 'root' }],
    ['an extra field', { isAdmin: true }],
  ])('rejects %s', async (_label, change) => {
    await expect(
      pipe.transform({ ...valid, ...change }, metadata),
    ).rejects.toThrow(BadRequestException);
  });
});
