import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ChatGateway } from './chat.gateway';
import { UsersRepository } from '../users/users.repository';

describe('ChatGateway', () => {
  let gateway: ChatGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn().mockReturnValue({ sub: 'user-1' }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-secret'),
          },
        },
        {
          provide: UsersRepository,
          useValue: {
            setOnlineStatus: jest.fn().mockResolvedValue({}),
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

  it('should log on afterInit', () => {
    const logSpy = jest.spyOn(gateway['logger'], 'log');
    gateway.afterInit();
    expect(logSpy).toHaveBeenCalledWith('WebSocket Gateway initialized');
  });

  it('should respond pong to ping', () => {
    const mockSocket = { id: 'test-socket-id' } as never;
    const result = gateway.handlePing(mockSocket, { msg: 'hello' });
    expect(result).toEqual({ event: 'pong', data: 'pong' });
  });

  it('should track online status', () => {
    expect(gateway.isUserOnline('nonexistent')).toBe(false);
  });
});
