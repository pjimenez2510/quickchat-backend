import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ConversationsService } from './conversations.service.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

class CreateConversationDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  otherUserId!: string;
}

@ApiTags('Conversations')
@Controller('conversations')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  @ApiOperation({ summary: 'List all conversations for current user' })
  async getConversations(@CurrentUser('userId') userId: string) {
    return this.conversationsService.getConversations(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Get or create a conversation with another user' })
  async createConversation(
    @CurrentUser('userId') userId: string,
    @Body() dto: CreateConversationDto,
  ) {
    return this.conversationsService.getOrCreateConversation(userId, dto.otherUserId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get conversation by ID' })
  async getConversation(
    @CurrentUser('userId') userId: string,
    @Param('id') conversationId: string,
  ) {
    return this.conversationsService.getConversationById(conversationId, userId);
  }
}
