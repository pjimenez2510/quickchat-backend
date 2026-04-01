import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  phone: null,
  password: 'hashed',
  username: 'testuser',
  display_name: 'Test User',
  avatar_url: null,
  bio: null,
  custom_status: null,
  custom_status_emoji: null,
  activity_visibility: 'ALL',
  is_online: false,
  last_seen_at: null,
  deleted_at: null,
  created_at: new Date(),
  updated_at: new Date(),
};

describe('UsersService', () => {
  let service: UsersService;
  let repository: UsersRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UsersRepository,
          useValue: {
            findById: jest.fn().mockResolvedValue(mockUser),
            findByUsername: jest.fn().mockResolvedValue(null),
            update: jest.fn().mockResolvedValue(mockUser),
            searchByUsername: jest.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get<UsersRepository>(UsersRepository);
  });

  describe('updateProfile', () => {
    it('should update displayName and bio', async () => {
      const updated = { ...mockUser, display_name: 'New Name', bio: 'Hello' };
      (repository.update as jest.Mock).mockResolvedValue(updated);

      const result = await service.updateProfile('user-1', {
        displayName: 'New Name',
        bio: 'Hello',
      });

      expect(result.message).toBe('Profile updated successfully');
      expect(result.data.user.displayName).toBe('New Name');
    });

    it('should throw if user not found', async () => {
      (repository.findById as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateProfile('invalid', { displayName: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw if username taken', async () => {
      (repository.findByUsername as jest.Mock).mockResolvedValue({ id: 'other' });

      await expect(
        service.updateProfile('user-1', { username: 'taken' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should update custom status', async () => {
      const updated = {
        ...mockUser,
        custom_status: 'Working',
        custom_status_emoji: '💼',
      };
      (repository.update as jest.Mock).mockResolvedValue(updated);

      const result = await service.updateProfile('user-1', {
        customStatus: 'Working',
        customStatusEmoji: '💼',
      });

      expect(result.data.user.customStatus).toBe('Working');
      expect(result.data.user.customStatusEmoji).toBe('💼');
    });

    it('should update activity visibility', async () => {
      const updated = { ...mockUser, activity_visibility: 'CONTACTS_ONLY' };
      (repository.update as jest.Mock).mockResolvedValue(updated);

      const result = await service.updateProfile('user-1', {
        activityVisibility: 'CONTACTS_ONLY' as never,
      });

      expect(result.data.user.activityVisibility).toBe('CONTACTS_ONLY');
    });
  });

  describe('searchUsers', () => {
    it('should return mapped users', async () => {
      (repository.searchByUsername as jest.Mock).mockResolvedValue([
        {
          id: 'u2',
          username: 'jane',
          display_name: 'Jane',
          avatar_url: null,
          is_online: true,
          custom_status: null,
          custom_status_emoji: null,
        },
      ]);

      const result = await service.searchUsers('jan', 'user-1');

      expect(result.data).toHaveLength(1);
      expect(result.data[0].username).toBe('jane');
      expect(result.data[0].displayName).toBe('Jane');
    });
  });
});
