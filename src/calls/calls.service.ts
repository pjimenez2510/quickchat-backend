import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CallsRepository } from './calls.repository.js';
import { ConversationsRepository } from '../conversations/conversations.repository.js';
import { BlockedUsersRepository } from '../blocked-users/blocked-users.repository.js';

export interface CallResponse {
  id: string;
  callerId: string;
  calleeId: string;
  conversationId: string;
  type: 'AUDIO' | 'VIDEO';
  status: string;
  startedAt: Date;
  answeredAt: Date | null;
  endedAt: Date | null;
  durationSeconds: number;
  caller: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  callee: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
}

interface CallRecord {
  id: string;
  caller_id: string;
  callee_id: string;
  conversation_id: string;
  type: 'AUDIO' | 'VIDEO';
  status: string;
  started_at: Date;
  answered_at: Date | null;
  ended_at: Date | null;
  duration_seconds: number;
  caller: { id: string; username: string; display_name: string; avatar_url: string | null };
  callee: { id: string; username: string; display_name: string; avatar_url: string | null };
}

@Injectable()
export class CallsService {
  constructor(
    private readonly callsRepository: CallsRepository,
    private readonly conversationsRepository: ConversationsRepository,
    private readonly blockedUsersRepository: BlockedUsersRepository,
  ) {}

  async initiateCall(callerId: string, conversationId: string, type: 'AUDIO' | 'VIDEO') {
    const conversation = await this.conversationsRepository.findById(conversationId);
    if (!conversation) throw new NotFoundException('Conversation not found');

    const isParticipant =
      conversation.participant1_id === callerId || conversation.participant2_id === callerId;
    if (!isParticipant) throw new ForbiddenException('Not a participant');

    const calleeId =
      conversation.participant1_id === callerId
        ? conversation.participant2_id
        : conversation.participant1_id;

    const isBlocked = await this.blockedUsersRepository.isEitherBlocked(callerId, calleeId);
    if (isBlocked) throw new ForbiddenException('Cannot call this user');

    const call = await this.callsRepository.create({
      callerId,
      calleeId,
      conversationId,
      type,
    });

    return { message: 'Call initiated', data: this.mapCall(call) };
  }

  async answerCall(callId: string, userId: string) {
    const call = await this.callsRepository.findById(callId);
    if (!call) throw new NotFoundException('Call not found');
    if (call.callee_id !== userId) throw new ForbiddenException('Not the callee');

    const updated = await this.callsRepository.updateStatus(callId, 'ANSWERED', {
      answeredAt: new Date(),
    });

    return { message: 'Call answered', data: this.mapCall(updated) };
  }

  async rejectCall(callId: string, userId: string) {
    const call = await this.callsRepository.findById(callId);
    if (!call) throw new NotFoundException('Call not found');
    if (call.callee_id !== userId) throw new ForbiddenException('Not the callee');

    const updated = await this.callsRepository.updateStatus(callId, 'REJECTED', {
      endedAt: new Date(),
    });

    return { message: 'Call rejected', data: this.mapCall(updated) };
  }

  async endCall(callId: string, userId: string) {
    const call = await this.callsRepository.findById(callId);
    if (!call) throw new NotFoundException('Call not found');
    if (call.caller_id !== userId && call.callee_id !== userId) {
      throw new ForbiddenException('Not a participant');
    }

    const endedAt = new Date();
    const startReference = call.answered_at ?? call.started_at;
    const durationSeconds = Math.floor((endedAt.getTime() - startReference.getTime()) / 1000);

    // Status: if never answered, it's MISSED; otherwise ENDED
    const status = call.answered_at ? 'ENDED' : 'MISSED';

    const updated = await this.callsRepository.updateStatus(callId, status, {
      endedAt,
      durationSeconds: call.answered_at ? durationSeconds : 0,
    });

    return { message: 'Call ended', data: this.mapCall(updated) };
  }

  async getCallHistory(conversationId: string, userId: string) {
    const conversation = await this.conversationsRepository.findById(conversationId);
    if (!conversation) throw new NotFoundException('Conversation not found');

    const isParticipant =
      conversation.participant1_id === userId || conversation.participant2_id === userId;
    if (!isParticipant) throw new ForbiddenException('Not a participant');

    const calls = await this.callsRepository.findByConversation(conversationId);
    return {
      message: 'Call history retrieved',
      data: calls.map((c) => this.mapCall(c)),
    };
  }

  private mapCall(call: CallRecord): CallResponse {
    return {
      id: call.id,
      callerId: call.caller_id,
      calleeId: call.callee_id,
      conversationId: call.conversation_id,
      type: call.type,
      status: call.status,
      startedAt: call.started_at,
      answeredAt: call.answered_at,
      endedAt: call.ended_at,
      durationSeconds: call.duration_seconds,
      caller: {
        id: call.caller.id,
        username: call.caller.username,
        displayName: call.caller.display_name,
        avatarUrl: call.caller.avatar_url,
      },
      callee: {
        id: call.callee.id,
        username: call.callee.username,
        displayName: call.callee.display_name,
        avatarUrl: call.callee.avatar_url,
      },
    };
  }
}
