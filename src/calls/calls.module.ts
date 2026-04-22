import { Module } from '@nestjs/common';
import { CallsController } from './calls.controller.js';
import { CallsService } from './calls.service.js';
import { CallsRepository } from './calls.repository.js';
import { ConversationsModule } from '../conversations/conversations.module.js';
import { BlockedUsersModule } from '../blocked-users/blocked-users.module.js';

@Module({
  imports: [ConversationsModule, BlockedUsersModule],
  controllers: [CallsController],
  providers: [CallsService, CallsRepository],
  exports: [CallsService, CallsRepository],
})
export class CallsModule {}
