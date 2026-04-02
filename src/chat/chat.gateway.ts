import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { UsersRepository } from '../users/users.repository.js';
import { MessagesService } from '../messages/messages.service.js';

@WebSocketGateway({
  cors: {
    origin: process.env['CORS_ORIGINS']?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  },
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private readonly connectedUsers = new Map<string, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersRepository: UsersRepository,
    private readonly messagesService: MessagesService,
  ) {}

  async afterInit() {
    // Reset all users to offline on server start (cleanup stale status)
    await this.usersRepository.resetAllOnlineStatus();
    this.logger.log('WebSocket Gateway initialized — all users reset to offline');
  }

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth as { token?: string }).token ??
        client.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify<{ sub: string }>(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      const userId = payload.sub;
      client.data = { userId };

      // Track connected sockets per user
      if (!this.connectedUsers.has(userId)) {
        this.connectedUsers.set(userId, new Set());
      }
      this.connectedUsers.get(userId)!.add(client.id);

      // Set online if first connection
      if (this.connectedUsers.get(userId)!.size === 1) {
        await this.usersRepository.setOnlineStatus(userId, true);
        this.server.emit('user:online', {
          userId,
          isOnline: true,
          lastSeenAt: new Date().toISOString(),
        });
      }

      this.logger.log(`Client connected: ${client.id} (user: ${userId})`);
    } catch {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = (client.data as { userId?: string })?.userId;
    if (!userId) return;

    const userSockets = this.connectedUsers.get(userId);
    if (userSockets) {
      userSockets.delete(client.id);

      // Set offline if no more connections
      if (userSockets.size === 0) {
        this.connectedUsers.delete(userId);
        await this.usersRepository.setOnlineStatus(userId, false);
        this.server.emit('user:online', {
          userId,
          isOnline: false,
          lastSeenAt: new Date().toISOString(),
        });
      }
    }

    this.logger.log(`Client disconnected: ${client.id} (user: ${userId})`);
  }

  @SubscribeMessage('ping')
  handlePing(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: unknown,
  ): { event: string; data: string } {
    this.logger.debug(`Ping from ${client.id}: ${JSON.stringify(data)}`);
    return { event: 'pong', data: 'pong' };
  }

  @SubscribeMessage('message:send')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      conversationId: string;
      content?: string;
      type?: string;
      mediaUrl?: string;
      replyToId?: string;
    },
  ) {
    const userId = (client.data as { userId: string }).userId;

    try {
      const result = await this.messagesService.sendMessage(userId, {
        conversationId: data.conversationId,
        content: data.content,
        type: data.type as never,
        mediaUrl: data.mediaUrl,
        replyToId: data.replyToId,
      });

      // Emit to all clients
      this.server.emit('message:new', {
        conversationId: data.conversationId,
        message: result.data,
      });

      // Auto-deliver if recipient is online
      const conversation = await this.messagesService.getConversationParticipants(data.conversationId, userId);
      if (conversation && this.isUserOnline(conversation.otherUserId)) {
        await this.messagesService.markAsDelivered(result.data.id);
        this.server.emit('message:delivered', {
          messageId: result.data.id,
          conversationId: data.conversationId,
        });
      }

      return { event: 'message:sent', data: result.data };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send message';
      return { event: 'message:error', data: { message } };
    }
  }

  @SubscribeMessage('message:read')
  async handleMessageRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = (client.data as { userId: string }).userId;

    const result = await this.messagesService.markAsRead(data.conversationId, userId);
    if (result) {
      this.server.emit('message:read', {
        conversationId: data.conversationId,
        userId,
        readAt: result.readAt,
      });
    }
  }

  @SubscribeMessage('message:edit')
  async handleEditMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; content: string },
  ) {
    const userId = (client.data as { userId: string }).userId;
    try {
      const result = await this.messagesService.editMessage(data.messageId, userId, data.content);
      this.server.emit('message:updated', {
        messageId: data.messageId,
        content: data.content,
        isEdited: true,
      });
      return { event: 'message:edited', data: result.data };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to edit message';
      return { event: 'message:error', data: { message } };
    }
  }

  @SubscribeMessage('message:delete')
  async handleDeleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; deleteForAll: boolean },
  ) {
    const userId = (client.data as { userId: string }).userId;
    try {
      if (data.deleteForAll) {
        const result = await this.messagesService.deleteForAll(data.messageId, userId);
        this.server.emit('message:deleted', {
          messageId: data.messageId,
          conversationId: result.data?.conversationId,
          deletedForAll: true,
        });
      } else {
        await this.messagesService.deleteForMe(data.messageId, userId);
      }
      return { event: 'message:deleted:ack', data: { messageId: data.messageId } };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete message';
      return { event: 'message:error', data: { message } };
    }
  }

  @SubscribeMessage('message:reaction')
  async handleReaction(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { messageId: string; emoji: string },
  ) {
    const userId = (client.data as { userId: string }).userId;
    try {
      const result = await this.messagesService.addReaction(data.messageId, userId, data.emoji);
      this.server.emit('message:reaction', result.data);
      return { event: 'message:reaction:ack', data: result.data };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to react';
      return { event: 'message:error', data: { message } };
    }
  }

  @SubscribeMessage('typing:start')
  handleTypingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = (client.data as { userId: string }).userId;
    this.server.emit('user:typing', {
      conversationId: data.conversationId,
      userId,
      isTyping: true,
    });
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    const userId = (client.data as { userId: string }).userId;
    this.server.emit('user:typing', {
      conversationId: data.conversationId,
      userId,
      isTyping: false,
    });
  }

  isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }
}
