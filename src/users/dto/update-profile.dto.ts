import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength, MinLength, Matches, IsEnum } from 'class-validator';

export enum ActivityVisibilityDto {
  ALL = 'ALL',
  CONTACTS_ONLY = 'CONTACTS_ONLY',
  SELECTED_CONTACTS = 'SELECTED_CONTACTS',
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'juan_perez', minLength: 3, maxLength: 30 })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'username must contain only letters, numbers, and underscores',
  })
  username?: string;

  @ApiPropertyOptional({ example: 'Juan Perez', maxLength: 50 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  displayName?: string;

  @ApiPropertyOptional({ example: 'https://s3.amazonaws.com/quickchat/avatars/photo.jpg' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  avatarUrl?: string;

  @ApiPropertyOptional({ example: 'Hola, estoy usando QuickChat!', maxLength: 150 })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  bio?: string;

  @ApiPropertyOptional({ example: 'Trabajando', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  customStatus?: string;

  @ApiPropertyOptional({ example: '💼', maxLength: 10 })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  customStatusEmoji?: string;

  @ApiPropertyOptional({ enum: ActivityVisibilityDto, example: 'ALL' })
  @IsOptional()
  @IsEnum(ActivityVisibilityDto)
  activityVisibility?: ActivityVisibilityDto;
}
