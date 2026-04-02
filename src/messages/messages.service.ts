import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { MessagesRepository } from './messages.repository.js';
import { ConversationsRepository } from '../conversations/conversations.repository.js';
import { BlockedUsersRepository } from '../blocked-users/blocked-users.repository.js';
import { SendMessageDto } from './dto/send-message.dto.js';

export interface MessageResponse {
  id: string;
  conversationId: string;
  content: string | null;
  type: string;
  mediaUrl: string | null;
  isEdited: boolean;
  isPinned: boolean;
  deletedForAll: boolean;
  status: 'sent' | 'delivered' | 'read';
  createdAt: Date;
  sender: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  replyTo: {
    id: string;
    content: string | null;
    senderId: string;
    type: string;
  } | null;
  reactions: {
    emoji: string;
    userId: string;
    username: string;
  }[];
}

@Injectable()
export class MessagesService {
  constructor(
    private readonly messagesRepository: MessagesRepository,
    private readonly conversationsRepository: ConversationsRepository,
    private readonly blockedUsersRepository: BlockedUsersRepository,
  ) {}

  async sendMessage(senderId: string, dto: SendMessageDto) {
    const conversation = await this.conversationsRepository.findById(dto.conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const isParticipant =
      conversation.participant1_id === senderId ||
      conversation.participant2_id === senderId;
    if (!isParticipant) {
      throw new ForbiddenException('You are not a participant of this conversation');
    }

    const otherUserId =
      conversation.participant1_id === senderId
        ? conversation.participant2_id
        : conversation.participant1_id;

    const isBlocked = await this.blockedUsersRepository.isEitherBlocked(senderId, otherUserId);
    if (isBlocked) {
      throw new ForbiddenException('Cannot send message to this user');
    }

    const message = await this.messagesRepository.create({
      conversationId: dto.conversationId,
      senderId,
      content: dto.content,
      type: dto.type,
      mediaUrl: dto.mediaUrl,
      replyToId: dto.replyToId,
    });

    await this.conversationsRepository.updateLastMessage(dto.conversationId, message.id);

    return {
      message: 'Message sent successfully',
      data: this.mapMessage(message),
    };
  }

  async getMessages(conversationId: string, userId: string, cursor?: string) {
    const conversation = await this.conversationsRepository.findById(conversationId);
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const isParticipant =
      conversation.participant1_id === userId ||
      conversation.participant2_id === userId;
    if (!isParticipant) {
      throw new ForbiddenException('You are not a participant of this conversation');
    }

    const messages = await this.messagesRepository.findByConversation(
      conversationId,
      userId,
      cursor,
    );

    return {
      message: 'Messages retrieved successfully',
      data: messages.map((m) => this.mapMessage(m)),
    };
  }

  async getConversationParticipants(conversationId: string, currentUserId: string) {
    const conversation = await this.conversationsRepository.findById(conversationId);
    if (!conversation) return null;

    const otherUserId =
      conversation.participant1_id === currentUserId
        ? conversation.participant2_id
        : conversation.participant1_id;

    return { otherUserId };
  }

  async editMessage(messageId: string, userId: string, content: string) {
    const message = await this.messagesRepository.findById(messageId);
    if (!message) throw new NotFoundException('Message not found');
    if (message.sender_id !== userId) throw new ForbiddenException('Can only edit your own messages');

    const editLimitMs = 15 * 60 * 1000;
    if (Date.now() - message.created_at.getTime() > editLimitMs) {
      throw new BadRequestException('Edit time limit exceeded (15 minutes)');
    }

    const updated = await this.messagesRepository.update(messageId, {
      content,
      is_edited: true,
      edited_at: new Date(),
    });

    return {
      message: 'Message edited successfully',
      data: this.mapMessage(updated),
    };
  }

  async deleteForMe(messageId: string, userId: string) {
    const message = await this.messagesRepository.findById(messageId);
    if (!message) throw new NotFoundException('Message not found');

    await this.messagesRepository.deleteForMe(messageId, userId);

    return { message: 'Message deleted for you', data: null };
  }

  async deleteForAll(messageId: string, userId: string) {
    const message = await this.messagesRepository.findById(messageId);
    if (!message) throw new NotFoundException('Message not found');
    if (message.sender_id !== userId) throw new ForbiddenException('Can only delete your own messages for everyone');

    await this.messagesRepository.deleteForAll(messageId);

    return {
      message: 'Message deleted for everyone',
      data: { messageId, conversationId: message.conversation_id },
    };
  }

  async addReaction(messageId: string, userId: string, emoji: string) {
    const message = await this.messagesRepository.findById(messageId);
    if (!message) throw new NotFoundException('Message not found');

    await this.messagesRepository.addReaction(messageId, userId, emoji);
    const reactions = await this.messagesRepository.getReactions(messageId);

    return {
      message: 'Reaction added',
      data: {
        messageId,
        conversationId: message.conversation_id,
        reactions: reactions.map((r) => ({
          emoji: r.emoji,
          userId: r.user_id,
          username: r.user.username,
        })),
      },
    };
  }

  async removeReaction(messageId: string, userId: string) {
    await this.messagesRepository.removeReaction(messageId, userId);
    return { message: 'Reaction removed', data: null };
  }

  async togglePin(messageId: string, userId: string) {
    const message = await this.messagesRepository.findById(messageId);
    if (!message) throw new NotFoundException('Message not found');

    if (!message.is_pinned) {
      const pinnedCount = await this.messagesRepository.countPinnedMessages(message.conversation_id);
      if (pinnedCount >= 5) {
        throw new BadRequestException('Maximum 5 pinned messages per conversation');
      }
    }

    const updated = await this.messagesRepository.update(messageId, {
      is_pinned: !message.is_pinned,
    });

    return {
      message: message.is_pinned ? 'Message unpinned' : 'Message pinned',
      data: this.mapMessage(updated),
    };
  }

  async getPinnedMessages(conversationId: string, userId: string) {
    const conversation = await this.conversationsRepository.findById(conversationId);
    if (!conversation) throw new NotFoundException('Conversation not found');

    const isParticipant = conversation.participant1_id === userId || conversation.participant2_id === userId;
    if (!isParticipant) throw new ForbiddenException('Not a participant');

    const pinned = await this.messagesRepository.getPinnedMessages(conversationId);
    return {
      message: 'Pinned messages retrieved',
      data: pinned.map((m) => this.mapMessage(m)),
    };
  }

  async markAsDelivered(messageId: string) {
    await this.messagesRepository.markAsDelivered(messageId);
  }

  async markAsRead(conversationId: string, userId: string) {
    const conversation = await this.conversationsRepository.findById(conversationId);
    if (!conversation) return;

    const otherUserId =
      conversation.participant1_id === userId
        ? conversation.participant2_id
        : conversation.participant1_id;

    await this.messagesRepository.markConversationAsRead(conversationId, otherUserId);

    return {
      conversationId,
      userId,
      readAt: new Date().toISOString(),
    };
  }

  private mapMessage(message: {
    id: string;
    conversation_id: string;
    content: string | null;
    type: string;
    media_url: string | null;
    is_edited: boolean;
    is_pinned: boolean;
    deleted_for_all: boolean;
    delivered_at: Date | null;
    read_at: Date | null;
    created_at: Date;
    sender: { id: string; username: string; display_name: string; avatar_url: string | null };
    reply_to?: { id: string; content: string | null; sender_id: string; type: string } | null;
    reactions?: { emoji: string; user_id: string; user: { id: string; username: string; display_name: string } }[];
  }): MessageResponse {
    let status: 'sent' | 'delivered' | 'read' = 'sent';
    if (message.read_at) status = 'read';
    else if (message.delivered_at) status = 'delivered';

    return {
      id: message.id,
      conversationId: message.conversation_id,
      content: message.content,
      type: message.type,
      mediaUrl: message.media_url,
      isEdited: message.is_edited,
      isPinned: message.is_pinned,
      deletedForAll: message.deleted_for_all,
      status,
      createdAt: message.created_at,
      sender: {
        id: message.sender.id,
        username: message.sender.username,
        displayName: message.sender.display_name,
        avatarUrl: message.sender.avatar_url,
      },
      replyTo: message.reply_to
        ? {
            id: message.reply_to.id,
            content: message.reply_to.content,
            senderId: message.reply_to.sender_id,
            type: message.reply_to.type,
          }
        : null,
      reactions: (message.reactions ?? []).map((r) => ({
        emoji: r.emoji,
        userId: r.user_id,
        username: r.user.username,
      })),
    };
  }
}
