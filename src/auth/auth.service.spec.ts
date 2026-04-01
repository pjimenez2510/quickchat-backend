jest.mock('../generated/prisma/client', () => ({
  PrismaClient: class MockPrismaClient {
    $connect = jest.fn().mockResolvedValue(undefined);
    $disconnect = jest.fn().mockResolvedValue(undefined);
  },
}));

jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed_value'),
  compare: jest.fn().mockResolvedValue(true),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

const mockUser = {
  id: 'user-uuid-1',
  email: 'test@example.com',
  phone: null,
  password: 'hashed_password',
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

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            refreshToken: {
              create: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
            },
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('mock-jwt-token'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string> = {
                JWT_SECRET: 'test-secret',
                JWT_REFRESH_SECRET: 'test-refresh-secret',
                JWT_ACCESS_EXPIRES_IN: '15m',
                JWT_REFRESH_EXPIRES_IN: '7d',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
  });

  describe('register', () => {
    it('should register a user with email', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});

      const result = await service.register({
        email: 'test@example.com',
        password: 'Password123',
        username: 'testuser',
        displayName: 'Test User',
      });

      expect(result.message).toBe('Account created successfully');
      expect(result.data.user.email).toBe('test@example.com');
      expect(result.data.accessToken).toBe('mock-jwt-token');
    });

    it('should register a user with phone', async () => {
      const phoneUser = { ...mockUser, email: null, phone: '+1234567890' };
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue(phoneUser);
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});

      const result = await service.register({
        phone: '+1234567890',
        password: 'Password123',
        username: 'testuser',
        displayName: 'Test User',
      });

      expect(result.message).toBe('Account created successfully');
      expect(result.data.user.phone).toBe('+1234567890');
    });

    it('should throw if no email or phone provided', async () => {
      await expect(
        service.register({
          password: 'Password123',
          username: 'testuser',
          displayName: 'Test User',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw if email already exists', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(mockUser);

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'Password123',
          username: 'testuser',
          displayName: 'Test User',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw if username already exists', async () => {
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(null) // email check
        .mockResolvedValueOnce(mockUser); // username check

      await expect(
        service.register({
          email: 'new@example.com',
          password: 'Password123',
          username: 'testuser',
          displayName: 'Test User',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should login with valid credentials', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});

      const result = await service.login({
        identifier: 'test@example.com',
        password: 'Password123',
      });

      expect(result.message).toBe('Login successful');
      expect(result.data.user.username).toBe('testuser');
      expect(result.data.accessToken).toBe('mock-jwt-token');
    });

    it('should throw on invalid user', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.login({
          identifier: 'nonexistent@example.com',
          password: 'Password123',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw on invalid password', async () => {
      (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);

      await expect(
        service.login({
          identifier: 'test@example.com',
          password: 'WrongPassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should revoke all refresh tokens and set offline', async () => {
      (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.logout('user-uuid-1');

      expect(result.message).toBe('Logged out successfully');
      expect(result.data).toBeNull();
      expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
    });
  });

  describe('getMe', () => {
    it('should return user from database', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.getMe('user-uuid-1');

      expect(result.data.user.username).toBe('testuser');
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1', deleted_at: null },
      });
    });

    it('should throw if user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getMe('invalid-id')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
