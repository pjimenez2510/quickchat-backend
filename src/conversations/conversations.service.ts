import { Injectable, NotFoundException } from '@nestjs/common';
import { ConversationsRepository } from './conversations.repository.js';
import { BlockedUsersRepository } from '../blocked-users/blocked-users.repository.js';
import { ContactsRepository } from '../contacts/contacts.repository.js';

export interface ConversationResponse {
  id: string;
  otherUser: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    isOnline: boolean;
    lastSeenAt: Date | null;
    customStatus: string | null;
    customStatusEmoji: string | null;
  };
  lastMessage: {
    id: string;
    content: string | null;
    type: string;
    senderId: string;
    createdAt: Date;
  } | null;
  isArchived: boolean;
  isUnread: boolean;
  updatedAt: Date;
}

interface RawConversation {
  id: string;
  participant1_id: string;
  participant2_id: string;
  archived_by: string[];
  marked_unread_by: string[];
  participant1: RawParticipant;
  participant2: RawParticipant;
  last_message?: {
    id: string;
    content: string | null;
    type: string;
    sender_id: string;
    created_at: Date;
  } | null;
  updated_at: Date;
}

interface RawParticipant {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_online: boolean;
  last_seen_at: Date | null;
  custom_status: string | null;
  custom_status_emoji: string | null;
  activity_visibility: string;
}

@Injectable()
export class ConversationsService {
  constructor(
    private readonly conversationsRepository: ConversationsRepository,
    private readonly blockedUsersRepository: BlockedUsersRepository,
    private readonly contactsRepository: ContactsRepository,
  ) {}

  async getConversations(userId: string) {
    const [conversations, contactIds] = await Promise.all([
      this.conversationsRepository.findAllByUser(userId),
      this.contactsRepository.findContactIds(userId),
    ]);
    const contactSet = new Set(contactIds);

    return {
      message: 'Conversations retrieved successfully',
      data: conversations.map((c) =>
        this.mapConversation(c as RawConversation, userId, contactSet),
      ),
    };
  }

  async getOrCreateConversation(userId: string, otherUserId: string) {
    const isBlocked = await this.blockedUsersRepository.isEitherBlocked(userId, otherUserId);
    if (isBlocked) {
      throw new NotFoundException('Cannot start conversation with this user');
    }

    let conversation = await this.conversationsRepository.findByParticipants(userId, otherUserId);

    if (!conversation) {
      conversation = await this.conversationsRepository.create(userId, otherUserId);
    }

    const full = await this.conversationsRepository.findById(conversation.id);
    if (!full) {
      throw new NotFoundException('Conversation not found');
    }

    const contactSet = await this.getContactSet(userId);
    return {
      message: 'Conversation retrieved successfully',
      data: this.mapConversation(full as RawConversation, userId, contactSet),
    };
  }

  async getConversationById(conversationId: string, userId: string) {
    const conversation = await this.conversationsRepository.findById(conversationId);

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.participant1_id !== userId && conversation.participant2_id !== userId) {
      throw new NotFoundException('Conversation not found');
    }

    const contactSet = await this.getContactSet(userId);
    return {
      message: 'Conversation retrieved successfully',
      data: this.mapConversation(conversation as RawConversation, userId, contactSet),
    };
  }

  async getArchivedConversations(userId: string) {
    const [conversations, contactIds] = await Promise.all([
      this.conversationsRepository.findArchivedByUser(userId),
      this.contactsRepository.findContactIds(userId),
    ]);
    const contactSet = new Set(contactIds);
    return {
      message: 'Archived conversations retrieved',
      data: conversations.map((c) =>
        this.mapConversation(c as RawConversation, userId, contactSet),
      ),
    };
  }

  async archive(conversationId: string, userId: string) {
    await this.conversationsRepository.archive(conversationId, userId);
    return { message: 'Conversation archived', data: null };
  }

  async unarchive(conversationId: string, userId: string) {
    await this.conversationsRepository.unarchive(conversationId, userId);
    return { message: 'Conversation unarchived', data: null };
  }

  async markUnread(conversationId: string, userId: string) {
    await this.conversationsRepository.markUnread(conversationId, userId);
    return { message: 'Conversation marked as unread', data: null };
  }

  private async getContactSet(userId: string): Promise<Set<string>> {
    const ids = await this.contactsRepository.findContactIds(userId);
    return new Set(ids);
  }

  private mapConversation(
    conversation: RawConversation,
    currentUserId: string,
    contactSet: Set<string>,
  ): ConversationResponse {
    const otherParticipant = conversation.participant1_id === currentUserId
      ? conversation.participant2
      : conversation.participant1;

    const canSeeActivity = this.canSeeActivity(
      otherParticipant.activity_visibility,
      contactSet.has(otherParticipant.id),
    );

    return {
      id: conversation.id,
      otherUser: {
        id: otherParticipant.id,
        username: otherParticipant.username,
        displayName: otherParticipant.display_name,
        avatarUrl: otherParticipant.avatar_url,
        isOnline: canSeeActivity ? otherParticipant.is_online : false,
        lastSeenAt: canSeeActivity ? otherParticipant.last_seen_at : null,
        customStatus: otherParticipant.custom_status,
        customStatusEmoji: otherParticipant.custom_status_emoji,
      },
      lastMessage: conversation.last_message
        ? {
            id: conversation.last_message.id,
            content: conversation.last_message.content,
            type: conversation.last_message.type,
            senderId: conversation.last_message.sender_id,
            createdAt: conversation.last_message.created_at,
          }
        : null,
      isArchived: conversation.archived_by.includes(currentUserId),
      isUnread: conversation.marked_unread_by.includes(currentUserId),
      updatedAt: conversation.updated_at,
    };
  }

  private canSeeActivity(visibility: string, isContact: boolean): boolean {
    switch (visibility) {
      case 'ALL':
        return true;
      case 'CONTACTS_ONLY':
      case 'SELECTED_CONTACTS':
        return isContact;
      case 'NONE':
        return false;
      default:
        return false;
    }
  }
}
