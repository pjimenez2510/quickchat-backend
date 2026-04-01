import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { ContactsRepository } from './contacts.repository';
import { BlockedUsersRepository } from '../blocked-users/blocked-users.repository';

describe('ContactsService', () => {
  let service: ContactsService;
  let contactsRepo: ContactsRepository;
  let blockedRepo: BlockedUsersRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactsService,
        {
          provide: ContactsRepository,
          useValue: {
            findContact: jest.fn().mockResolvedValue(null),
            findAllByUser: jest.fn().mockResolvedValue([]),
            addContact: jest.fn().mockResolvedValue(undefined),
            removeContact: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: BlockedUsersRepository,
          useValue: {
            isBlocked: jest.fn().mockResolvedValue(false),
          },
        },
      ],
    }).compile();

    service = module.get<ContactsService>(ContactsService);
    contactsRepo = module.get<ContactsRepository>(ContactsRepository);
    blockedRepo = module.get<BlockedUsersRepository>(BlockedUsersRepository);
  });

  it('should add a contact', async () => {
    const result = await service.addContact('user-1', 'user-2');
    expect(result.message).toBe('Contact added successfully');
    expect(contactsRepo.addContact).toHaveBeenCalledWith('user-1', 'user-2');
  });

  it('should throw when adding self', async () => {
    await expect(service.addContact('user-1', 'user-1')).rejects.toThrow(
      ConflictException,
    );
  });

  it('should throw when contact already exists', async () => {
    (contactsRepo.findContact as jest.Mock).mockResolvedValue({ user_id: 'user-1' });
    await expect(service.addContact('user-1', 'user-2')).rejects.toThrow(
      ConflictException,
    );
  });

  it('should throw when adding blocked user', async () => {
    (blockedRepo.isBlocked as jest.Mock).mockResolvedValue(true);
    await expect(service.addContact('user-1', 'user-2')).rejects.toThrow(
      ConflictException,
    );
  });

  it('should remove a contact', async () => {
    (contactsRepo.findContact as jest.Mock).mockResolvedValue({ user_id: 'user-1' });
    const result = await service.removeContact('user-1', 'user-2');
    expect(result.message).toBe('Contact removed successfully');
  });

  it('should throw when removing non-existent contact', async () => {
    await expect(service.removeContact('user-1', 'user-2')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should get contacts list', async () => {
    (contactsRepo.findAllByUser as jest.Mock).mockResolvedValue([
      {
        contact: {
          id: 'u2',
          username: 'jane',
          display_name: 'Jane',
          avatar_url: null,
          is_online: true,
          last_seen_at: null,
          custom_status: null,
          custom_status_emoji: null,
        },
      },
    ]);

    const result = await service.getContacts('user-1');
    expect(result.data).toHaveLength(1);
    expect(result.data[0].displayName).toBe('Jane');
  });
});
