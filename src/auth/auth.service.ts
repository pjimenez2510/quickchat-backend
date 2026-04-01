import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';

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
  isOnline: boolean;
  createdAt: Date;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly BCRYPT_ROUNDS = 12;

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

    const hashedPassword = await bcrypt.hash(dto.password, this.BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        password: hashedPassword,
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

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      this.logger.warn(`Login failed: invalid password for ${user.username}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens({
      sub: user.id,
      username: user.username,
    });

    await this.storeRefreshToken(user.id, tokens.refreshToken);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { is_online: true, last_seen_at: new Date() },
    });

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
    const tokenHash = await bcrypt.hash(refreshToken, this.BCRYPT_ROUNDS);

    const storedTokens = await this.prisma.refreshToken.findMany({
      where: {
        user_id: { not: undefined },
        revoked_at: null,
      },
      include: { user: true },
    });

    let matchedToken: (typeof storedTokens)[number] | null = null;
    for (const stored of storedTokens) {
      const isMatch = await bcrypt.compare(refreshToken, stored.token_hash);
      if (isMatch) {
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

    await this.prisma.user.update({
      where: { id: userId },
      data: { is_online: false, last_seen_at: new Date() },
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
    const tokenHash = await bcrypt.hash(refreshToken, this.BCRYPT_ROUNDS);
    const expiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
    const expiresAt = new Date();
    const days = parseInt(expiresIn.replace('d', ''), 10) || 7;
    expiresAt.setDate(expiresAt.getDate() + days);

    await this.prisma.refreshToken.create({
      data: {
        user_id: userId,
        token_hash: tokenHash,
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
      isOnline: user.is_online,
      createdAt: user.created_at,
    };
  }
}
