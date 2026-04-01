import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { BlockedUsersRepository } from './blocked-users.repository.js';

export interface BlockedUserResponse {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

@Injectable()
export class BlockedUsersService {
  constructor(
    private readonly blockedUsersRepository: BlockedUsersRepository,
  ) {}

  async getBlockedUsers(userId: string) {
    const blocked = await this.blockedUsersRepository.findAllByUser(userId);

    return {
      message: 'Blocked users retrieved successfully',
      data: blocked.map((b) => ({
        id: b.blocked_user.id,
        username: b.blocked_user.username,
        displayName: b.blocked_user.display_name,
        avatarUrl: b.blocked_user.avatar_url,
        blockedAt: b.created_at,
      })),
    };
  }

  async blockUser(userId: string, blockedUserId: string) {
    if (userId === blockedUserId) {
      throw new ConflictException('Cannot block yourself');
    }

    const alreadyBlocked = await this.blockedUsersRepository.isBlocked(
      userId,
      blockedUserId,
    );
    if (alreadyBlocked) {
      throw new ConflictException('User already blocked');
    }

    await this.blockedUsersRepository.block(userId, blockedUserId);

    return {
      message: 'User blocked successfully',
      data: null,
    };
  }

  async unblockUser(userId: string, blockedUserId: string) {
    const isBlocked = await this.blockedUsersRepository.isBlocked(
      userId,
      blockedUserId,
    );
    if (!isBlocked) {
      throw new NotFoundException('User is not blocked');
    }

    await this.blockedUsersRepository.unblock(userId, blockedUserId);

    return {
      message: 'User unblocked successfully',
      data: null,
    };
  }
}
