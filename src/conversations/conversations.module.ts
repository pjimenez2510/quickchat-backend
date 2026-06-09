import { Module } from '@nestjs/common';
import { ConversationsController } from './conversations.controller.js';
import { ConversationsService } from './conversations.service.js';
import { ConversationsRepository } from './conversations.repository.js';
import { BlockedUsersModule } from '../blocked-users/blocked-users.module.js';
import { ContactsModule } from '../contacts/contacts.module.js';

@Module({
  imports: [BlockedUsersModule, ContactsModule],
  controllers: [ConversationsController],
  providers: [ConversationsService, ConversationsRepository],
  exports: [ConversationsService, ConversationsRepository],
})
export class ConversationsModule {}
