import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { encryptAtRest, decryptAtRest } from '../common/crypto/keys.js';

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

interface MessageRow {
  content: string | null;
  reply_to?: { content: string | null } | null;
}

function decryptRow<T extends MessageRow>(row: T): T {
  row.content = decryptAtRest(row.content);
  if (row.reply_to) {
    row.reply_to.content = decryptAtRest(row.reply_to.content);
  }
  return row;
}

function decryptRows<T extends MessageRow>(rows: T[]): T[] {
  for (const row of rows) decryptRow(row);
  return rows;
}

@Injectable()
export class MessagesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    conversationId: string;
    senderId: string;
    content?: string;
    type?: string;
    mediaUrl?: string;
    replyToId?: string;
  }) {
    const storedContent =
      data.content != null ? encryptAtRest(data.content) : null;

    const message = await this.prisma.message.create({
      data: {
        conversation_id: data.conversationId,
        sender_id: data.senderId,
        content: storedContent,
        type: (data.type as never) ?? 'TEXT',
        media_url: data.mediaUrl ?? null,
        reply_to_id: data.replyToId ?? null,
      },
      include: MESSAGE_INCLUDE,
    });

    return decryptRow(message);
  }

  async findByConversation(
    conversationId: string,
    userId: string,
    cursor?: string,
    take = 50,
  ) {
    const messages = await this.prisma.message.findMany({
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
    return decryptRows(messages);
  }

  async findById(id: string) {
    const message = await this.prisma.message.findUnique({
      where: { id },
      include: MESSAGE_INCLUDE,
    });
    return message ? decryptRow(message) : null;
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

  async update(id: string, data: Record<string, unknown>) {
    const patch: Record<string, unknown> = { ...data };
    if (typeof patch['content'] === 'string') {
      patch['content'] = encryptAtRest(patch['content']);
    }

    const message = await this.prisma.message.update({
      where: { id },
      data: patch,
      include: MESSAGE_INCLUDE,
    });
    return decryptRow(message);
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

  /**
   * Búsqueda sobre contenido cifrado at-rest.
   * Traemos todos los mensajes de la conversación, descifra en memoria
   * y filtra. Funciona pero NO escala bien (acorde a la naturaleza
   * académica del proyecto).
   */
  async searchInConversation(
    conversationId: string,
    query: string,
    userId: string,
  ) {
    const all = await this.prisma.message.findMany({
      where: {
        conversation_id: conversationId,
        deleted_for_all: false,
        NOT: { deleted_by: { some: { user_id: userId } } },
        content: { not: null },
      },
      include: MESSAGE_INCLUDE,
      orderBy: { created_at: 'desc' },
    });

    const decrypted = decryptRows(all);
    const needle = query.toLowerCase();
    return decrypted
      .filter((m) => (m.content ?? '').toLowerCase().includes(needle))
      .slice(0, 20);
  }

  countPinnedMessages(conversationId: string) {
    return this.prisma.message.count({
      where: { conversation_id: conversationId, is_pinned: true },
    });
  }

  async getPinnedMessages(conversationId: string) {
    const messages = await this.prisma.message.findMany({
      where: { conversation_id: conversationId, is_pinned: true },
      include: MESSAGE_INCLUDE,
      orderBy: { created_at: 'desc' },
    });
    return decryptRows(messages);
  }
}
