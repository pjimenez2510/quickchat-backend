import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

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
      include: {
        sender: {
          select: { id: true, username: true, display_name: true, avatar_url: true },
        },
        reply_to: {
          select: { id: true, content: true, sender_id: true, type: true },
        },
      },
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
      include: {
        sender: {
          select: { id: true, username: true, display_name: true, avatar_url: true },
        },
        reply_to: {
          select: { id: true, content: true, sender_id: true, type: true },
        },
      },
      orderBy: { created_at: 'desc' },
      take,
      ...(cursor
        ? { cursor: { id: cursor }, skip: 1 }
        : {}),
    });
  }

  findById(id: string) {
    return this.prisma.message.findUnique({
      where: { id },
      include: {
        sender: {
          select: { id: true, username: true, display_name: true, avatar_url: true },
        },
      },
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
}
