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
  ) {}

  afterInit() {
    this.logger.log('WebSocket Gateway initialized');
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

  isUserOnline(userId: string): boolean {
    return this.connectedUsers.has(userId);
  }
}
