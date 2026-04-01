import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ContactsRepository } from './contacts.repository.js';
import { BlockedUsersRepository } from '../blocked-users/blocked-users.repository.js';

export interface ContactResponse {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isOnline: boolean;
  lastSeenAt: Date | null;
  customStatus: string | null;
  customStatusEmoji: string | null;
}

@Injectable()
export class ContactsService {
  constructor(
    private readonly contactsRepository: ContactsRepository,
    private readonly blockedUsersRepository: BlockedUsersRepository,
  ) {}

  async getContacts(userId: string) {
    const contacts = await this.contactsRepository.findAllByUser(userId);

    return {
      message: 'Contacts retrieved successfully',
      data: contacts.map((c) => this.mapContact(c.contact)),
    };
  }

  async addContact(userId: string, contactId: string) {
    if (userId === contactId) {
      throw new ConflictException('Cannot add yourself as a contact');
    }

    const existing = await this.contactsRepository.findContact(userId, contactId);
    if (existing) {
      throw new ConflictException('Contact already added');
    }

    const isBlocked = await this.blockedUsersRepository.isBlocked(userId, contactId);
    if (isBlocked) {
      throw new ConflictException('Cannot add a blocked user as a contact');
    }

    await this.contactsRepository.addContact(userId, contactId);

    return {
      message: 'Contact added successfully',
      data: null,
    };
  }

  async removeContact(userId: string, contactId: string) {
    const existing = await this.contactsRepository.findContact(userId, contactId);
    if (!existing) {
      throw new NotFoundException('Contact not found');
    }

    await this.contactsRepository.removeContact(userId, contactId);

    return {
      message: 'Contact removed successfully',
      data: null,
    };
  }

  private mapContact(contact: {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    is_online: boolean;
    last_seen_at: Date | null;
    custom_status: string | null;
    custom_status_emoji: string | null;
  }): ContactResponse {
    return {
      id: contact.id,
      username: contact.username,
      displayName: contact.display_name,
      avatarUrl: contact.avatar_url,
      isOnline: contact.is_online,
      lastSeenAt: contact.last_seen_at,
      customStatus: contact.custom_status,
      customStatusEmoji: contact.custom_status_emoji,
    };
  }
}
