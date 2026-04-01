import { Module } from '@nestjs/common';
import { MessagesController } from './messages.controller.js';
import { MessagesService } from './messages.service.js';
import { MessagesRepository } from './messages.repository.js';
import { ConversationsModule } from '../conversations/conversations.module.js';
import { BlockedUsersModule } from '../blocked-users/blocked-users.module.js';

@Module({
  imports: [ConversationsModule, BlockedUsersModule],
  controllers: [MessagesController],
  providers: [MessagesService, MessagesRepository],
  exports: [MessagesService, MessagesRepository],
})
export class MessagesModule {}
