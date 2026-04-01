import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export enum MessageTypeDto {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  VOICE = 'VOICE',
  GIF = 'GIF',
  STICKER = 'STICKER',
  FILE = 'FILE',
}

export class SendMessageDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  conversationId!: string;

  @ApiPropertyOptional({ example: 'Hello, how are you?' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  content?: string;

  @ApiPropertyOptional({ enum: MessageTypeDto, default: 'TEXT' })
  @IsOptional()
  @IsEnum(MessageTypeDto)
  type?: MessageTypeDto;

  @ApiPropertyOptional({ example: 'https://s3.amazonaws.com/quickchat/...' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  mediaUrl?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsUUID()
  replyToId?: string;
}
