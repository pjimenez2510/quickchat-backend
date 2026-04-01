import { Module } from '@nestjs/common';
import { ContactsController } from './contacts.controller.js';
import { ContactsService } from './contacts.service.js';
import { ContactsRepository } from './contacts.repository.js';
import { BlockedUsersModule } from '../blocked-users/blocked-users.module.js';

@Module({
  imports: [BlockedUsersModule],
  controllers: [ContactsController],
  providers: [ContactsService, ContactsRepository],
  exports: [ContactsService, ContactsRepository],
})
export class ContactsModule {}
