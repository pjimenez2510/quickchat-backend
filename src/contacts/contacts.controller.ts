import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ContactsService } from './contacts.service.js';
import { AddContactDto } from './dto/add-contact.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Contacts')
@Controller('contacts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all contacts for current user' })
  async getContacts(@CurrentUser('userId') userId: string) {
    return this.contactsService.getContacts(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Add a contact (bidirectional)' })
  async addContact(
    @CurrentUser('userId') userId: string,
    @Body() dto: AddContactDto,
  ) {
    return this.contactsService.addContact(userId, dto.contactId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a contact (silent, bidirectional)' })
  async removeContact(
    @CurrentUser('userId') userId: string,
    @Param('id') contactId: string,
  ) {
    return this.contactsService.removeContact(userId, contactId);
  }
}
