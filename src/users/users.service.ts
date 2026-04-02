import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UsersRepository } from './users.repository.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';

export interface UserProfileResponse {
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
  lastSeenAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.username && dto.username !== user.username) {
      const existing = await this.usersRepository.findByUsername(dto.username);
      if (existing) {
        throw new ConflictException('Username already taken');
      }
    }

    const updateData: Record<string, unknown> = {};
    if (dto.username !== undefined) updateData['username'] = dto.username;
    if (dto.displayName !== undefined) updateData['display_name'] = dto.displayName;
    if (dto.avatarUrl !== undefined) updateData['avatar_url'] = dto.avatarUrl;
    if (dto.bio !== undefined) updateData['bio'] = dto.bio;
    if (dto.customStatus !== undefined) updateData['custom_status'] = dto.customStatus;
    if (dto.customStatusEmoji !== undefined) updateData['custom_status_emoji'] = dto.customStatusEmoji;
    if (dto.activityVisibility !== undefined) updateData['activity_visibility'] = dto.activityVisibility;

    const updated = await this.usersRepository.update(userId, updateData);

    return {
      message: 'Profile updated successfully',
      data: { user: this.mapProfile(updated) },
    };
  }

  async searchUsers(query: string, currentUserId: string) {
    const users = await this.usersRepository.searchByUsername(
      query,
      currentUserId,
    );

    return {
      message: 'Users found',
      data: users.map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.display_name,
        avatarUrl: u.avatar_url,
        isOnline: u.is_online,
        customStatus: u.custom_status,
        customStatusEmoji: u.custom_status_emoji,
      })),
    };
  }

  private mapProfile(user: {
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
    last_seen_at: Date | null;
    created_at: Date;
  }): UserProfileResponse {
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
      lastSeenAt: user.last_seen_at,
      createdAt: user.created_at,
    };
  }
}
