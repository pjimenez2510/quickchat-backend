import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

const CALL_INCLUDE = {
  caller: {
    select: { id: true, username: true, display_name: true, avatar_url: true },
  },
  callee: {
    select: { id: true, username: true, display_name: true, avatar_url: true },
  },
} as const;

@Injectable()
export class CallsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: {
    callerId: string;
    calleeId: string;
    conversationId: string;
    type: 'AUDIO' | 'VIDEO';
  }) {
    return this.prisma.call.create({
      data: {
        caller_id: data.callerId,
        callee_id: data.calleeId,
        conversation_id: data.conversationId,
        type: data.type,
      },
      include: CALL_INCLUDE,
    });
  }

  findById(id: string) {
    return this.prisma.call.findUnique({
      where: { id },
      include: CALL_INCLUDE,
    });
  }

  updateStatus(id: string, status: 'ANSWERED' | 'REJECTED' | 'MISSED' | 'ENDED', extras?: { answeredAt?: Date; endedAt?: Date; durationSeconds?: number }) {
    return this.prisma.call.update({
      where: { id },
      data: {
        status,
        ...(extras?.answeredAt && { answered_at: extras.answeredAt }),
        ...(extras?.endedAt && { ended_at: extras.endedAt }),
        ...(extras?.durationSeconds !== undefined && { duration_seconds: extras.durationSeconds }),
      },
      include: CALL_INCLUDE,
    });
  }

  findByConversation(conversationId: string, take = 50) {
    return this.prisma.call.findMany({
      where: { conversation_id: conversationId },
      include: CALL_INCLUDE,
      orderBy: { started_at: 'desc' },
      take,
    });
  }
}
