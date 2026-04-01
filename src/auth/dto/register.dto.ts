import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

export class RegisterDto {
  @ApiPropertyOptional({ example: 'juan@example.com' })
  @IsEmail()
  @IsOptional()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: '+593987654321' })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  @Matches(/^\+?[1-9]\d{6,14}$/, {
    message: 'phone must be a valid phone number',
  })
  phone?: string;

  @ApiProperty({ example: 'MiPassword123!', minLength: 8, maxLength: 72 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message:
      'password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  password!: string;

  @ApiProperty({ example: 'juan_perez', minLength: 3, maxLength: 30 })
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'username must contain only letters, numbers, and underscores',
  })
  username!: string;

  @ApiProperty({ example: 'Juan Perez', minLength: 1, maxLength: 50 })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  displayName!: string;
}
