import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'juan@example.com',
    description: 'Email or phone number',
  })
  @IsString()
  @MaxLength(255)
  identifier!: string;

  @ApiProperty({ example: 'MiPassword123!' })
  @IsString()
  @MaxLength(72)
  password!: string;
}
