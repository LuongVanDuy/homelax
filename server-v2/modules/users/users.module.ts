import { Module } from '@nestjs/common';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { UserAccountService } from './user-account.service.js';

@Module({
  controllers: [UsersController],
  providers: [UsersService, UserAccountService],
})
export class UsersModule {}
