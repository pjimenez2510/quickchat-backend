import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ContactsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findContact(userId: string, contactId: string) {
    return this.prisma.contact.findUnique({
      where: { user_id_contact_id: { user_id: userId, contact_id: contactId } },
    });
  }

  findAllByUser(userId: string) {
    return this.prisma.contact.findMany({
      where: { user_id: userId },
      include: {
        contact: {
          select: {
            id: true,
            username: true,
            display_name: true,
            avatar_url: true,
            is_online: true,
            last_seen_at: true,
            custom_status: true,
            custom_status_emoji: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async addContact(userId: string, contactId: string) {
    await this.prisma.$transaction([
      this.prisma.contact.create({
        data: { user_id: userId, contact_id: contactId },
      }),
      this.prisma.contact.create({
        data: { user_id: contactId, contact_id: userId },
      }),
    ]);
  }

  async removeContact(userId: string, contactId: string) {
    await this.prisma.$transaction([
      this.prisma.contact.deleteMany({
        where: { user_id: userId, contact_id: contactId },
      }),
      this.prisma.contact.deleteMany({
        where: { user_id: contactId, contact_id: userId },
      }),
    ]);
  }
}
