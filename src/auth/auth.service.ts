import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { encryptAtRest, decryptAtRest } from '../common/crypto/keys.js';

interface TokenPayload {
  sub: string;
  username: string;
}

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserResponse {
  id: string;
  email: string | null;
  phone: string | null;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  customStatus: string | null;
  customStatusEmoji: string | null;
  activityVisibility: string;
  isOnline: boolean;
  createdAt: Date;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    if (!dto.email && !dto.phone) {
      throw new ConflictException('Email or phone number is required');
    }

    if (dto.email) {
      const existingEmail = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (existingEmail) {
        throw new ConflictException('Email already registered');
      }
    }

    if (dto.phone) {
      const existingPhone = await this.prisma.user.findUnique({
        where: { phone: dto.phone },
      });
      if (existingPhone) {
        throw new ConflictException('Phone number already registered');
      }
    }

    const existingUsername = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (existingUsername) {
      throw new ConflictException('Username already taken');
    }

    const encryptedPassword = encryptAtRest(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        password: encryptedPassword,
        username: dto.username,
        display_name: dto.displayName,
      },
    });

    const tokens = await this.generateTokens({
      sub: user.id,
      username: user.username,
    });

    await this.storeRefreshToken(user.id, tokens.refreshToken);

    this.logger.log(`User registered: ${user.username}`);

    return {
      message: 'Account created successfully',
      data: {
        user: this.mapUserResponse(user),
        ...tokens,
      },
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.identifier }, { phone: dto.identifier }],
        deleted_at: null,
      },
    });

    if (!user) {
      this.logger.warn(`Login failed: user not found for ${dto.identifier}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const storedPassword = decryptAtRest(user.password);
    if (storedPassword !== dto.password) {
      this.logger.warn(`Login failed: invalid password for ${user.username}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens({
      sub: user.id,
      username: user.username,
    });

    await this.storeRefreshToken(user.id, tokens.refreshToken);

    this.logger.log(`Login successful: ${user.username}`);

    return {
      message: 'Login successful',
      data: {
        user: this.mapUserResponse(user),
        ...tokens,
      },
    };
  }

  async refresh(refreshToken: string) {
    const storedTokens = await this.prisma.refreshToken.findMany({
      where: {
        user_id: { not: undefined },
        revoked_at: null,
      },
      include: { user: true },
    });

    let matchedToken: (typeof storedTokens)[number] | null = null;
    for (const stored of storedTokens) {
      const decrypted = decryptAtRest(stored.token_hash);
      if (decrypted === refreshToken) {
        matchedToken = stored;
        break;
      }
    }

    // Validation 1: Token exists
    if (!matchedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Validation 2: Not revoked (already filtered above, but explicit)
    if (matchedToken.revoked_at) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    // Validation 3: Not expired
    if (matchedToken.expires_at < new Date()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    // Validation 4: Hash matches (already validated in loop)

    // Revoke old token
    await this.prisma.refreshToken.update({
      where: { id: matchedToken.id },
      data: { revoked_at: new Date() },
    });

    // Generate new tokens
    const tokens = await this.generateTokens({
      sub: matchedToken.user.id,
      username: matchedToken.user.username,
    });

    await this.storeRefreshToken(matchedToken.user.id, tokens.refreshToken);

    return {
      message: 'Token refreshed successfully',
      data: {
        user: this.mapUserResponse(matchedToken.user),
        ...tokens,
      },
    };
  }

  async logout(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { user_id: userId, revoked_at: null },
      data: { revoked_at: new Date() },
    });

    this.logger.log(`User logged out: ${userId}`);

    return {
      message: 'Logged out successfully',
      data: null,
    };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId, deleted_at: null },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      message: 'User profile retrieved',
      data: { user: this.mapUserResponse(user) },
    };
  }

  private async generateTokens(payload: TokenPayload): Promise<AuthTokens> {
    const accessExpiresIn = this.configService.get<string>('JWT_ACCESS_EXPIRES_IN') ?? '15m';
    const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync({ ...payload }, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: accessExpiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
      }),
      this.jwtService.signAsync({ ...payload }, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshExpiresIn as `${number}${'s' | 'm' | 'h' | 'd'}`,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const encryptedToken = encryptAtRest(refreshToken);
    const expiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
    const expiresAt = new Date();
    const days = parseInt(expiresIn.replace('d', ''), 10) || 7;
    expiresAt.setDate(expiresAt.getDate() + days);

    await this.prisma.refreshToken.create({
      data: {
        user_id: userId,
        token_hash: encryptedToken,
        expires_at: expiresAt,
      },
    });
  }

  private mapUserResponse(user: {
    id: string;
    email: string | null;
    phone: string | null;
    username: string;
    display_name: string;
    avatar_url: string | null;
    bio: string | null;
    custom_status: string | null;
    custom_status_emoji: string | null;
    activity_visibility: string;
    is_online: boolean;
    created_at: Date;
  }): UserResponse {
    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      username: user.username,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      bio: user.bio,
      customStatus: user.custom_status,
      customStatusEmoji: user.custom_status_emoji,
      activityVisibility: user.activity_visibility,
      isOnline: user.is_online,
      createdAt: user.created_at,
    };
  }
}
