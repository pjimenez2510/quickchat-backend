import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ConversationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByParticipants(userId1: string, userId2: string) {
    return this.prisma.conversation.findFirst({
      where: {
        OR: [
          { participant1_id: userId1, participant2_id: userId2 },
          { participant1_id: userId2, participant2_id: userId1 },
        ],
      },
    });
  }

  findById(id: string) {
    return this.prisma.conversation.findUnique({
      where: { id },
      include: {
        participant1: {
          select: { id: true, username: true, display_name: true, avatar_url: true, is_online: true, last_seen_at: true },
        },
        participant2: {
          select: { id: true, username: true, display_name: true, avatar_url: true, is_online: true, last_seen_at: true },
        },
        last_message: {
          select: { id: true, content: true, type: true, sender_id: true, created_at: true },
        },
      },
    });
  }

  findAllByUser(userId: string) {
    return this.prisma.conversation.findMany({
      where: {
        OR: [
          { participant1_id: userId },
          { participant2_id: userId },
        ],
        NOT: { archived_by: { has: userId } },
      },
      include: {
        participant1: {
          select: { id: true, username: true, display_name: true, avatar_url: true, is_online: true, last_seen_at: true },
        },
        participant2: {
          select: { id: true, username: true, display_name: true, avatar_url: true, is_online: true, last_seen_at: true },
        },
        last_message: {
          select: { id: true, content: true, type: true, sender_id: true, created_at: true },
        },
      },
      orderBy: { updated_at: 'desc' },
    });
  }

  create(participant1Id: string, participant2Id: string) {
    return this.prisma.conversation.create({
      data: {
        participant1_id: participant1Id,
        participant2_id: participant2Id,
      },
      include: {
        participant1: {
          select: { id: true, username: true, display_name: true, avatar_url: true, is_online: true, last_seen_at: true },
        },
        participant2: {
          select: { id: true, username: true, display_name: true, avatar_url: true, is_online: true, last_seen_at: true },
        },
      },
    });
  }

  updateLastMessage(conversationId: string, messageId: string) {
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { last_message_id: messageId },
    });
  }

  async archive(conversationId: string, userId: string) {
    const conv = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conv) return null;
    const archivedBy = conv.archived_by.includes(userId)
      ? conv.archived_by
      : [...conv.archived_by, userId];
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { archived_by: archivedBy },
    });
  }

  async unarchive(conversationId: string, userId: string) {
    const conv = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conv) return null;
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { archived_by: conv.archived_by.filter((id) => id !== userId) },
    });
  }

  async markUnread(conversationId: string, userId: string) {
    const conv = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conv) return null;
    const markedUnreadBy = conv.marked_unread_by.includes(userId)
      ? conv.marked_unread_by
      : [...conv.marked_unread_by, userId];
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { marked_unread_by: markedUnreadBy },
    });
  }

  async clearUnread(conversationId: string, userId: string) {
    const conv = await this.prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conv) return null;
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { marked_unread_by: conv.marked_unread_by.filter((id) => id !== userId) },
    });
  }

  findArchivedByUser(userId: string) {
    return this.prisma.conversation.findMany({
      where: {
        OR: [
          { participant1_id: userId },
          { participant2_id: userId },
        ],
        archived_by: { has: userId },
      },
      include: {
        participant1: {
          select: { id: true, username: true, display_name: true, avatar_url: true, is_online: true, last_seen_at: true },
        },
        participant2: {
          select: { id: true, username: true, display_name: true, avatar_url: true, is_online: true, last_seen_at: true },
        },
        last_message: {
          select: { id: true, content: true, type: true, sender_id: true, created_at: true },
        },
      },
      orderBy: { updated_at: 'desc' },
    });
  }
}
