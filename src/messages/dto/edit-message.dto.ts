import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class EditMessageDto {
  @ApiProperty({ example: 'Updated message content' })
  @IsString()
  @MaxLength(5000)
  content!: string;
}
