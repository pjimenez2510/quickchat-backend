import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id, deleted_at: null },
    });
  }

  findByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
    });
  }

  update(id: string, data: Record<string, unknown>) {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  searchByUsername(query: string, excludeUserId: string, limit = 10) {
    return this.prisma.user.findMany({
      where: {
        username: { contains: query, mode: 'insensitive' },
        id: { not: excludeUserId },
        deleted_at: null,
      },
      take: limit,
      select: {
        id: true,
        username: true,
        display_name: true,
        avatar_url: true,
        is_online: true,
        custom_status: true,
        custom_status_emoji: true,
      },
    });
  }

  setOnlineStatus(id: string, isOnline: boolean) {
    return this.prisma.user.update({
      where: { id },
      data: {
        is_online: isOnline,
        last_seen_at: new Date(),
      },
    });
  }
}
