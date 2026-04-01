import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class BlockedUsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async isBlocked(userId: string, otherUserId: string): Promise<boolean> {
    const blocked = await this.prisma.blockedUser.findUnique({
      where: {
        user_id_blocked_user_id: {
          user_id: userId,
          blocked_user_id: otherUserId,
        },
      },
    });
    return !!blocked;
  }

  async isEitherBlocked(userA: string, userB: string): Promise<boolean> {
    const count = await this.prisma.blockedUser.count({
      where: {
        OR: [
          { user_id: userA, blocked_user_id: userB },
          { user_id: userB, blocked_user_id: userA },
        ],
      },
    });
    return count > 0;
  }

  block(userId: string, blockedUserId: string) {
    return this.prisma.blockedUser.create({
      data: { user_id: userId, blocked_user_id: blockedUserId },
    });
  }

  unblock(userId: string, blockedUserId: string) {
    return this.prisma.blockedUser.delete({
      where: {
        user_id_blocked_user_id: {
          user_id: userId,
          blocked_user_id: blockedUserId,
        },
      },
    });
  }

  findAllByUser(userId: string) {
    return this.prisma.blockedUser.findMany({
      where: { user_id: userId },
      include: {
        blocked_user: {
          select: {
            id: true,
            username: true,
            display_name: true,
            avatar_url: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }
}
