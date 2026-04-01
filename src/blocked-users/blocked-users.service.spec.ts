import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { BlockedUsersService } from './blocked-users.service';
import { BlockedUsersRepository } from './blocked-users.repository';

describe('BlockedUsersService', () => {
  let service: BlockedUsersService;
  let repository: BlockedUsersRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockedUsersService,
        {
          provide: BlockedUsersRepository,
          useValue: {
            isBlocked: jest.fn().mockResolvedValue(false),
            block: jest.fn().mockResolvedValue({}),
            unblock: jest.fn().mockResolvedValue({}),
            findAllByUser: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get<BlockedUsersService>(BlockedUsersService);
    repository = module.get<BlockedUsersRepository>(BlockedUsersRepository);
  });

  it('should block a user', async () => {
    const result = await service.blockUser('user-1', 'user-2');
    expect(result.message).toBe('User blocked successfully');
  });

  it('should throw when blocking self', async () => {
    await expect(service.blockUser('user-1', 'user-1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('should throw when already blocked', async () => {
    (repository.isBlocked as jest.Mock).mockResolvedValue(true);
    await expect(service.blockUser('user-1', 'user-2')).rejects.toThrow(
      ConflictException,
    );
  });

  it('should unblock a user', async () => {
    (repository.isBlocked as jest.Mock).mockResolvedValue(true);
    const result = await service.unblockUser('user-1', 'user-2');
    expect(result.message).toBe('User unblocked successfully');
  });

  it('should throw when unblocking not-blocked user', async () => {
    await expect(service.unblockUser('user-1', 'user-2')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should get blocked users list', async () => {
    (repository.findAllByUser as jest.Mock).mockResolvedValue([
      {
        blocked_user: {
          id: 'u2',
          username: 'bad_user',
          display_name: 'Bad',
          avatar_url: null,
        },
        created_at: new Date(),
      },
    ]);

    const result = await service.getBlockedUsers('user-1');
    expect(result.data).toHaveLength(1);
    expect(result.data[0].username).toBe('bad_user');
  });
});
