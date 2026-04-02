import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class ReactionDto {
  @ApiProperty({ example: '👍', description: 'Emoji reaction' })
  @IsString()
  @MaxLength(10)
  emoji!: string;
}
