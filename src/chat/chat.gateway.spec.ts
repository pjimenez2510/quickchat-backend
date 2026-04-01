import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ChatGateway } from './chat.gateway';
import { UsersRepository } from '../users/users.repository';
import { MessagesService } from '../messages/messages.service';

describe('ChatGateway', () => {
  let gateway: ChatGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        {
          provide: JwtService,
          useValue: { verify: jest.fn().mockReturnValue({ sub: 'user-1' }) },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('test-secret') },
        },
        {
          provide: UsersRepository,
          useValue: { setOnlineStatus: jest.fn().mockResolvedValue({}) },
        },
        {
          provide: MessagesService,
          useValue: {
            sendMessage: jest.fn().mockResolvedValue({
              message: 'Message sent',
              data: { id: 'msg-1', content: 'Hello' },
            }),
          },
        },
      ],
    }).compile();

    gateway = module.get<ChatGateway>(ChatGateway);
    gateway.server = { emit: jest.fn() } as never;
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  it('should respond pong to ping', () => {
    const mockSocket = { id: 'test-id' } as never;
    const result = gateway.handlePing(mockSocket, {});
    expect(result).toEqual({ event: 'pong', data: 'pong' });
  });

  it('should handle message:send', async () => {
    const mockSocket = { id: 'test-id', data: { userId: 'user-1' } } as never;
    const result = await gateway.handleSendMessage(mockSocket, {
      conversationId: 'conv-1',
      content: 'Hello',
    });
    expect(result.event).toBe('message:sent');
  });

  it('should handle typing:start', () => {
    const mockSocket = { id: 'test-id', data: { userId: 'user-1' } } as never;
    gateway.handleTypingStart(mockSocket, { conversationId: 'conv-1' });
    expect(gateway.server.emit).toHaveBeenCalledWith('user:typing', {
      conversationId: 'conv-1',
      userId: 'user-1',
      isTyping: true,
    });
  });

  it('should track online status', () => {
    expect(gateway.isUserOnline('nonexistent')).toBe(false);
  });
});
