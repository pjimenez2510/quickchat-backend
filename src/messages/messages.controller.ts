import { Controller, Post, Get, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { MessagesService } from './messages.service.js';
import { SendMessageDto } from './dto/send-message.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Messages')
@Controller('messages')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  @ApiOperation({ summary: 'Send a message' })
  async sendMessage(
    @CurrentUser('userId') userId: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messagesService.sendMessage(userId, dto);
  }

  @Get('conversation/:conversationId')
  @ApiOperation({ summary: 'Get messages for a conversation (cursor-based pagination)' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Message ID cursor for pagination' })
  async getMessages(
    @CurrentUser('userId') userId: string,
    @Param('conversationId') conversationId: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.messagesService.getMessages(conversationId, userId, cursor);
  }
}
