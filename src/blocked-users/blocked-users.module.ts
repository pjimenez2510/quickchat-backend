import { Module } from '@nestjs/common';
import { BlockedUsersController } from './blocked-users.controller.js';
import { BlockedUsersService } from './blocked-users.service.js';
import { BlockedUsersRepository } from './blocked-users.repository.js';

@Module({
  controllers: [BlockedUsersController],
  providers: [BlockedUsersService, BlockedUsersRepository],
  exports: [BlockedUsersService, BlockedUsersRepository],
})
export class BlockedUsersModule {}
