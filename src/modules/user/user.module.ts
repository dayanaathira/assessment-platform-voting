import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { UserRole } from './entities/user-role.entity';

@Module({
  imports: [MikroOrmModule.forFeature([User, Role, UserRole])],
  providers: [UserService],
  controllers: [UserController],
})
export class UserModule {}
