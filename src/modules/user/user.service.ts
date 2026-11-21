import {
  EntityManager,
  UniqueConstraintViolationException,
} from '@mikro-orm/postgresql';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { hashPassword } from '../../common/utils/password.util';
import { AddUserDto } from './dtos/add-user.dto';
import { UserDetailDto } from './dtos/user-detail.dto';
import { Role } from './entities/role.entity';
import { UserRole } from './entities/user-role.entity';
import { User } from './entities/user.entity';

@Injectable()
export class UserService {
  constructor(private readonly em: EntityManager) {}

  /**
   * Creates a user with one role.
   *
   * @param dto - Name, username, password and role.
   * @returns The created user, without the password hash.
   */
  async create(dto: AddUserDto): Promise<UserDetailDto> {
    const [role, passwordHash] = await Promise.all([
      this.em.findOneOrFail(Role, { name: dto.role }),
      hashPassword(dto.password),
    ]);

    const user = this.em.create(User, {
      name: dto.name,
      username: dto.username,
      passwordHash,
    });
    this.em.create(UserRole, { user, role });

    // The unique index decides, so two signups racing for one name can't both win.
    try {
      await this.em.flush();
    } catch (error) {
      if (error instanceof UniqueConstraintViolationException) {
        throw new ConflictException('Username already taken');
      }
      throw error;
    }

    return this.toDetail(user, [role.name]);
  }

  /**
   * @param id - The user id.
   * @returns The user with their role names.
   */
  async view(id: string): Promise<UserDetailDto> {
    const user = await this.em.findOne(User, id, {
      populate: ['userRoles.role'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toDetail(
      user,
      user.userRoles.getItems().map((ur) => ur.role.name),
    );
  }

  /**
   * @param user - The user entity.
   * @param roles - The user's role names.
   * @returns The response shape, with no password hash.
   */
  private toDetail(user: User, roles: string[]): UserDetailDto {
    return plainToInstance(
      UserDetailDto,
      {
        id: user.id,
        name: user.name,
        username: user.username,
        roles,
        createdAt: user.createdAt,
      },
      { excludeExtraneousValues: true },
    );
  }
}
