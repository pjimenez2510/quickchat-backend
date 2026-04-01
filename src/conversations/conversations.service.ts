import { Injectable, NotFoundException } from '@nestjs/common';
import { ConversationsRepository } from './conversations.repository.js';
import { BlockedUsersRepository } from '../blocked-users/blocked-users.repository.js';

export interface ConversationResponse {
  id: string;
  otherUser: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    isOnline: boolean;
    lastSeenAt: Date | null;
  };
  lastMessage: {
    id: string;
    content: string | null;
    type: string;
    senderId: string;
    createdAt: Date;
  } | null;
  updatedAt: Date;
}

@Injectable()
export class ConversationsService {
  constructor(
    private readonly conversationsRepository: ConversationsRepository,
    private readonly blockedUsersRepository: BlockedUsersRepository,
  ) {}

  async getConversations(userId: string) {
    const conversations = await this.conversationsRepository.findAllByUser(userId);

    return {
      message: 'Conversations retrieved successfully',
      data: conversations.map((c) => this.mapConversation(c, userId)),
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

    return {
      message: 'Conversation retrieved successfully',
      data: this.mapConversation(full, userId),
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

    return {
      message: 'Conversation retrieved successfully',
      data: this.mapConversation(conversation, userId),
    };
  }

  private mapConversation(
    conversation: {
      id: string;
      participant1_id: string;
      participant1: { id: string; username: string; display_name: string; avatar_url: string | null; is_online: boolean; last_seen_at: Date | null };
      participant2: { id: string; username: string; display_name: string; avatar_url: string | null; is_online: boolean; last_seen_at: Date | null };
      last_message?: { id: string; content: string | null; type: string; sender_id: string; created_at: Date } | null;
      updated_at: Date;
    },
    currentUserId: string,
  ): ConversationResponse {
    const otherParticipant = conversation.participant1_id === currentUserId
      ? conversation.participant2
      : conversation.participant1;

    return {
      id: conversation.id,
      otherUser: {
        id: otherParticipant.id,
        username: otherParticipant.username,
        displayName: otherParticipant.display_name,
        avatarUrl: otherParticipant.avatar_url,
        isOnline: otherParticipant.is_online,
        lastSeenAt: otherParticipant.last_seen_at,
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
      updatedAt: conversation.updated_at,
    };
  }
}
