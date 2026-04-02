import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

const MESSAGE_INCLUDE = {
  sender: {
    select: { id: true, username: true, display_name: true, avatar_url: true },
  },
  reply_to: {
    select: { id: true, content: true, sender_id: true, type: true },
  },
  reactions: {
    include: {
      user: {
        select: { id: true, username: true, display_name: true },
      },
    },
  },
} as const;

@Injectable()
export class MessagesRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: {
    conversationId: string;
    senderId: string;
    content?: string;
    type?: string;
    mediaUrl?: string;
    replyToId?: string;
  }) {
    return this.prisma.message.create({
      data: {
        conversation_id: data.conversationId,
        sender_id: data.senderId,
        content: data.content ?? null,
        type: (data.type as never) ?? 'TEXT',
        media_url: data.mediaUrl ?? null,
        reply_to_id: data.replyToId ?? null,
      },
      include: MESSAGE_INCLUDE,
    });
  }

  findByConversation(
    conversationId: string,
    userId: string,
    cursor?: string,
    take = 50,
  ) {
    return this.prisma.message.findMany({
      where: {
        conversation_id: conversationId,
        deleted_for_all: false,
        NOT: {
          deleted_by: { some: { user_id: userId } },
        },
      },
      include: MESSAGE_INCLUDE,
      orderBy: { created_at: 'desc' },
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
  }

  findById(id: string) {
    return this.prisma.message.findUnique({
      where: { id },
      include: MESSAGE_INCLUDE,
    });
  }

  markAsDelivered(messageId: string) {
    return this.prisma.message.update({
      where: { id: messageId },
      data: { delivered_at: new Date() },
    });
  }

  markConversationAsRead(conversationId: string, senderId: string) {
    return this.prisma.message.updateMany({
      where: {
        conversation_id: conversationId,
        sender_id: senderId,
        read_at: null,
      },
      data: { read_at: new Date() },
    });
  }

  update(id: string, data: Record<string, unknown>) {
    return this.prisma.message.update({
      where: { id },
      data,
      include: MESSAGE_INCLUDE,
    });
  }

  deleteForMe(messageId: string, userId: string) {
    return this.prisma.deletedMessage.create({
      data: { message_id: messageId, user_id: userId },
    });
  }

  deleteForAll(messageId: string) {
    return this.prisma.message.update({
      where: { id: messageId },
      data: { deleted_for_all: true },
    });
  }

  addReaction(messageId: string, userId: string, emoji: string) {
    return this.prisma.messageReaction.upsert({
      where: { message_id_user_id: { message_id: messageId, user_id: userId } },
      create: { message_id: messageId, user_id: userId, emoji },
      update: { emoji },
    });
  }

  removeReaction(messageId: string, userId: string) {
    return this.prisma.messageReaction.delete({
      where: { message_id_user_id: { message_id: messageId, user_id: userId } },
    });
  }

  getReactions(messageId: string) {
    return this.prisma.messageReaction.findMany({
      where: { message_id: messageId },
      include: {
        user: {
          select: { id: true, username: true, display_name: true },
        },
      },
    });
  }

  searchInConversation(conversationId: string, query: string, userId: string) {
    return this.prisma.message.findMany({
      where: {
        conversation_id: conversationId,
        content: { contains: query, mode: 'insensitive' },
        deleted_for_all: false,
        NOT: { deleted_by: { some: { user_id: userId } } },
      },
      include: MESSAGE_INCLUDE,
      orderBy: { created_at: 'desc' },
      take: 20,
    });
  }

  countPinnedMessages(conversationId: string) {
    return this.prisma.message.count({
      where: { conversation_id: conversationId, is_pinned: true },
    });
  }

  getPinnedMessages(conversationId: string) {
    return this.prisma.message.findMany({
      where: { conversation_id: conversationId, is_pinned: true },
      include: MESSAGE_INCLUDE,
      orderBy: { created_at: 'desc' },
    });
  }
}
