import { Test, TestingModule } from '@nestjs/testing';
import { ChatGateway } from './chat.gateway';

describe('ChatGateway', () => {
  let gateway: ChatGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChatGateway],
    }).compile();

    gateway = module.get<ChatGateway>(ChatGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  it('should log on afterInit', () => {
    const logSpy = jest.spyOn(gateway['logger'], 'log');
    gateway.afterInit();
    expect(logSpy).toHaveBeenCalledWith('WebSocket Gateway initialized');
  });

  it('should log on handleConnection', () => {
    const logSpy = jest.spyOn(gateway['logger'], 'log');
    const mockSocket = { id: 'test-socket-id' } as never;
    gateway.handleConnection(mockSocket);
    expect(logSpy).toHaveBeenCalledWith('Client connected: test-socket-id');
  });

  it('should log on handleDisconnect', () => {
    const logSpy = jest.spyOn(gateway['logger'], 'log');
    const mockSocket = { id: 'test-socket-id' } as never;
    gateway.handleDisconnect(mockSocket);
    expect(logSpy).toHaveBeenCalledWith('Client disconnected: test-socket-id');
  });

  it('should respond pong to ping', () => {
    const mockSocket = { id: 'test-socket-id' } as never;
    const result = gateway.handlePing(mockSocket, { msg: 'hello' });
    expect(result).toEqual({ event: 'pong', data: 'pong' });
  });
});
