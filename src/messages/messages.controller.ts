import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { MessagesService } from './messages.service.js';
import { SendMessageDto } from './dto/send-message.dto.js';
import { EditMessageDto } from './dto/edit-message.dto.js';
import { ReactionDto } from './dto/reaction.dto.js';
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
  @ApiOperation({ summary: 'Get messages (cursor-based pagination)' })
  @ApiQuery({ name: 'cursor', required: false })
  async getMessages(
    @CurrentUser('userId') userId: string,
    @Param('conversationId') conversationId: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.messagesService.getMessages(conversationId, userId, cursor);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit a message (within 15 min)' })
  async editMessage(
    @CurrentUser('userId') userId: string,
    @Param('id') messageId: string,
    @Body() dto: EditMessageDto,
  ) {
    return this.messagesService.editMessage(messageId, userId, dto.content);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete message for me' })
  async deleteForMe(
    @CurrentUser('userId') userId: string,
    @Param('id') messageId: string,
  ) {
    return this.messagesService.deleteForMe(messageId, userId);
  }

  @Delete(':id/all')
  @ApiOperation({ summary: 'Delete message for everyone (sender only)' })
  async deleteForAll(
    @CurrentUser('userId') userId: string,
    @Param('id') messageId: string,
  ) {
    return this.messagesService.deleteForAll(messageId, userId);
  }

  @Post(':id/reactions')
  @ApiOperation({ summary: 'React to a message with emoji' })
  async addReaction(
    @CurrentUser('userId') userId: string,
    @Param('id') messageId: string,
    @Body() dto: ReactionDto,
  ) {
    return this.messagesService.addReaction(messageId, userId, dto.emoji);
  }

  @Delete(':id/reactions')
  @ApiOperation({ summary: 'Remove your reaction' })
  async removeReaction(
    @CurrentUser('userId') userId: string,
    @Param('id') messageId: string,
  ) {
    return this.messagesService.removeReaction(messageId, userId);
  }

  @Patch(':id/pin')
  @ApiOperation({ summary: 'Toggle pin/unpin message (max 5)' })
  async togglePin(
    @CurrentUser('userId') userId: string,
    @Param('id') messageId: string,
  ) {
    return this.messagesService.togglePin(messageId, userId);
  }

  @Get('conversation/:conversationId/pinned')
  @ApiOperation({ summary: 'Get pinned messages in conversation' })
  async getPinnedMessages(
    @CurrentUser('userId') userId: string,
    @Param('conversationId') conversationId: string,
  ) {
    return this.messagesService.getPinnedMessages(conversationId, userId);
  }
}
